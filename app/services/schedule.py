import datetime
import json
import os
import re
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen

from app.services.curricula import get_curriculum

REMOTE_URL = os.getenv("SCHEDULE_DATA_URL", "https://salas.docencia-eit.cl/data.json")
PACKAGE_FALLBACK_FILE = Path(__file__).resolve().parents[2] / "data.json"
RUNTIME_DATA_FILE = Path(os.getenv("SCHEDULE_CACHE_FILE", "/var/lib/buscadorsalas/data.json"))

# Definición de bloques horarios estándar UDP
STANDARD_BLOCKS = [
    {"id": "8:30:00", "label": "08:30 - 09:50", "start": "08:30:00", "finish": "09:50:00", "start_min": 8 * 60 + 30, "end_min": 9 * 60 + 50},
    {"id": "10:00:00", "label": "10:00 - 11:20", "start": "10:00:00", "finish": "11:20:00", "start_min": 10 * 60, "end_min": 11 * 60 + 20},
    {"id": "11:30:00", "label": "11:30 - 12:50", "start": "11:30:00", "finish": "12:50:00", "start_min": 11 * 60 + 30, "end_min": 12 * 60 + 50},
    {"id": "13:00:00", "label": "13:00 - 14:20", "start": "13:00:00", "finish": "14:20:00", "start_min": 13 * 60, "end_min": 14 * 60 + 20},
    {"id": "14:30:00", "label": "14:30 - 15:50", "start": "14:30:00", "finish": "15:50:00", "start_min": 14 * 60 + 30, "end_min": 15 * 60 + 50},
    {"id": "16:00:00", "label": "16:00 - 17:20", "start": "16:00:00", "finish": "17:20:00", "start_min": 16 * 60, "end_min": 17 * 60 + 20},
    {"id": "17:25:00", "label": "17:25 - 18:45", "start": "17:25:00", "finish": "18:45:00", "start_min": 17 * 60 + 25, "end_min": 18 * 60 + 45},
    {"id": "08:30:00_S", "label": "08:30 - 10:30", "start": "08:30:00", "finish": "10:30:00", "start_min": 8 * 60 + 30, "end_min": 10 * 60 + 30},
    {"id": "10:45:00_S", "label": "10:45 - 12:45", "start": "10:45:00", "finish": "12:45:00", "start_min": 10 * 60 + 45, "end_min": 12 * 60 + 45},
    {"id": "13:00:00_S", "label": "13:00 - 15:00", "start": "13:00:00", "finish": "15:00:00", "start_min": 13 * 60, "end_min": 15 * 60},
    {"id": "15:15:00_S", "label": "15:15 - 17:15", "start": "15:15:00", "finish": "17:15:00", "start_min": 15 * 60 + 15, "end_min": 17 * 60 + 15},
    {"id": "17:30:00_S", "label": "17:30 - 19:30", "start": "17:30:00", "finish": "19:30:00", "start_min": 17 * 60 + 30, "end_min": 19 * 60 + 30},
]

DIAS_SEMANA = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    7: "Domingo"
}

MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

try:
    import zoneinfo
    CHILE_TZ = zoneinfo.ZoneInfo("America/Santiago")
    _ = datetime.datetime.now(CHILE_TZ)
except Exception:
    CHILE_TZ = datetime.timezone(datetime.timedelta(hours=-3))

def get_chile_now():
    """Retorna la fecha y hora actual garantizada en la zona horaria de Chile (America/Santiago)."""
    return datetime.datetime.now(CHILE_TZ)

def to_minutes(time_str):
    if not time_str:
        return 0
    try:
        parts = time_str.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def format_time(time_str):
    if not time_str:
        return ""
    try:
        parts = time_str.split(':')
        if len(parts) >= 2:
            return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    except Exception:
        pass
    return time_str

class DataManager:
    """Administra la carga, sincronización en vivo y caché de los datos de salas."""
    def __init__(self, cache_file=None):
        self.cache_file = Path(cache_file or RUNTIME_DATA_FILE)
        self.cache = None
        self.last_synced = None
        self.source = "none"
        self.ttl_seconds = 1800  # 30 minutos de caché en memoria
        self.total_classes = 0
        self.total_rooms = 0
        self.all_rooms = []
        self._init_data()

    def _init_data(self):
        # Intenta primero sincronizar con la web oficial; si falla, usa el archivo local
        if not self.sync_from_remote():
            self._load_from_local()

    def _load_from_local(self):
        source_file = self.cache_file if self.cache_file.exists() else PACKAGE_FALLBACK_FILE
        if source_file.exists():
            try:
                with source_file.open('r', encoding='utf-8') as f:
                    data = json.load(f)
                self.cache = data
                self.last_synced = datetime.datetime.fromtimestamp(source_file.stat().st_mtime, tz=CHILE_TZ).strftime("%d/%m/%Y %H:%M:%S")
                self.source = "local_cache"
                self._update_stats()
                print(f"[DataManager] Cargado desde local_cache ({self.total_classes} clases, {self.total_rooms} salas)")
                return True
            except Exception as e:
                print(f"[DataManager] Error al leer data.json local: {e}")
        return False

    def sync_from_remote(self):
        try:
            print(f"[DataManager] Sincronizando datos desde {REMOTE_URL} ...")
            req = Request(
                REMOTE_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BuscadorSalasUDP/2.0"}
            )
            with urlopen(req, timeout=8) as response:
                content = response.read().decode('utf-8')
                data = json.loads(content)
            
            # Validamos que tenga la estructura requerida
            if 'data' in data and 'allSalasUdps' in data['data']:
                self.cache = data
                self.last_synced = get_chile_now().strftime("%d/%m/%Y %H:%M:%S")
                self.source = "online_web"
                self._update_stats()

                # Guardamos como copia de respaldo local
                try:
                    self.cache_file.parent.mkdir(parents=True, exist_ok=True)
                    self.cache_file.write_text(content, encoding='utf-8')
                except Exception as save_err:
                    print(f"[DataManager] Advertencia al guardar localmente: {save_err}")

                print(f"[DataManager] Sincronización exitosa desde la web ({self.total_classes} clases, {self.total_rooms} salas)")
                return True
            else:
                print("[DataManager] Estructura de JSON remoto no coincide con lo esperado.")
                return False
        except Exception as e:
            print(f"[DataManager] Error al sincronizar desde la web: {e}")
            return False

    def _update_stats(self):
        if not self.cache:
            return
        edges = self.cache.get('data', {}).get('allSalasUdps', {}).get('edges', [])
        self.total_classes = len(edges)
        rooms_set = set()
        self.solemne_days = {d: False for d in range(1, 8)}
        for e in edges:
            node = e.get('node', {})
            p = node.get('place')
            d = node.get('day')
            s_time = node.get('start')
            
            if p:
                import re as re_local
                for sala in [s.strip() for s in re_local.split(r'[,/]', p) if s.strip()]:
                    rooms_set.add(sala)
            
            if d and s_time:
                c_start = to_minutes(s_time)
                # 645 = 10:45, 915 = 15:15, 1050 = 17:30
                if c_start in [645, 915, 1050]:
                    self.solemne_days[d] = True
                
        self.all_rooms = sorted(list(rooms_set))
        self.total_rooms = len(self.all_rooms)

    def get_classes(self):
        if not self.cache:
            self._init_data()
        return self.cache.get('data', {}).get('allSalasUdps', {}).get('edges', []) if self.cache else []

    def get_status(self):
        return {
            "source": self.source,
            "last_synced": self.last_synced,
            "total_classes": self.total_classes,
            "total_rooms": self.total_rooms,
            "remote_url": REMOTE_URL
        }

dm = DataManager()
def nombre_dia(n):
    return DIAS_SEMANA.get(int(n), str(n))

def coincide_facultad(nombre_sala, filtro_facultad):
    if not filtro_facultad or filtro_facultad == "TODAS":
        return True
    f = filtro_facultad.strip().upper()
    if f == "INGENIERIA":
        return nombre_sala.startswith("E441") or nombre_sala.startswith("V432")
    # Si es texto libre, aceptamos cualquier sala para evaluarla despues
    return True

def asignaciones_sala_seccion(nodo):
    """Devuelve una sala y una sección por asignación de una fila del feed."""
    raw_places = str(nodo.get('place') or '')
    raw_sections = str(nodo.get('section') or '-').strip() or '-'
    places = list(dict.fromkeys(p.strip() for p in re.split(r'[,/]', raw_places) if p.strip()))
    sections = list(dict.fromkeys(
        s.strip() for s in re.split(r'[,/;]|\s+y\s*|(?<=\d)\.(?=\d)', raw_sections, flags=re.IGNORECASE)
        if s.strip()
    ))

    if not places:
        return []
    if not sections:
        sections = ['-']

    if len(places) == len(sections):
        return list(zip(places, sections))
    if len(places) == 1:
        return [(places[0], section) for section in sections]
    if len(sections) == 1:
        return [(place, sections[0]) for place in places]

    # El feed no informa el emparejamiento exacto cuando las listas tienen
    # longitudes distintas; expone cada combinación por separado, sin agruparlas.
    return [(place, section) for place in places for section in sections]

def obtener_bloque_info(hora_id):
    for b in STANDARD_BLOCKS:
        if b["id"] == hora_id:
            return b
    # Si viene en formato simple "HH:MM"
    for b in STANDARD_BLOCKS:
        if b["start"].startswith(hora_id):
            return b
    # Default primer bloque
    return STANDARD_BLOCKS[0]

def salas_de_nodo(nodo):
    """Extrae todas las salas indicadas en la asignación original del feed."""
    raw_places = nodo.get('place')
    entries = raw_places if isinstance(raw_places, (list, tuple, set)) else [raw_places]
    salas = []
    for entry in entries:
        salas.extend(s.strip() for s in re.split(r'[,/]', str(entry or '')) if s.strip())
    return list(dict.fromkeys(salas))

def obtener_salas(dia_numero, hora_exacta, filtro_facultad):
    clases = dm.get_classes()
    bloque_ref = obtener_bloque_info(hora_exacta)
    b_start = bloque_ref["start_min"]
    b_end = bloque_ref["end_min"]
    dia_int = int(dia_numero)

    now = get_chile_now()
    now_min = now.hour * 60 + now.minute
    is_today = (now.weekday() + 1 == dia_int)

    todas_las_salas = set()
    ocupadas_dict = {}
    clases_por_sala = {}

    for clase in clases:
        nodo = clase.get('node', {})
        salas = salas_de_nodo(nodo)
        if not salas:
            continue

        asignaciones_seccion = dict(asignaciones_sala_seccion(nodo))
        try:
            dia_clase = int(nodo.get('day'))
        except (TypeError, ValueError):
            dia_clase = None

        for nombre_sala in salas:
            if not coincide_facultad(nombre_sala, filtro_facultad):
                continue

            todas_las_salas.add(nombre_sala)

            if dia_clase == dia_int:
                if nombre_sala not in clases_por_sala:
                    clases_por_sala[nombre_sala] = []

                start_str = nodo.get('start', '')
                finish_str = nodo.get('finish', '')
                c_start = to_minutes(start_str)
                c_finish = to_minutes(finish_str)

                if c_finish <= c_start:
                    c_finish = c_start + 80

                clases_por_sala[nombre_sala].append({
                    'start_min': c_start,
                    'end_min': c_finish,
                    'start': format_time(start_str),
                    'finish': format_time(finish_str),
                    'course': nodo.get('course', 'Sin curso'),
                    'teacher': nodo.get('teacher', 'No informado'),
                    'section': asignaciones_seccion.get(nombre_sala, nodo.get('section') or '-'),
                    'code': nodo.get('code', '-')
                })

    for s, cl_list in clases_por_sala.items():
        for c in cl_list:
            if not (c['end_min'] <= b_start or c['start_min'] >= b_end):
                ocupadas_dict[s] = {
                    'sala': s,
                    'curso': c['course'],
                    'profe': c['teacher'],
                    'seccion': c['section'],
                    'codigo': c['code'],
                    'horario': f"{c['start']} - {c['finish']}",
                    'start': c['start'],
                    'finish': c['finish'],
                    'start_min': c['start_min'],
                    'end_min': c['end_min']
                }
                break

    vacias = sorted(list(todas_las_salas - set(ocupadas_dict.keys())))
    vacias_info = {}

    for s in vacias:
        cl_list = clases_por_sala.get(s, [])
        futuras = [c for c in cl_list if c['start_min'] >= b_start]
        if futuras:
            prox = min(futuras, key=lambda x: x['start_min'])
            diff = prox['start_min'] - b_start
            if diff >= 60:
                hrs = diff // 60
                mins = diff % 60
                tiempo_str = f"{hrs}h {mins}m" if mins else f"{hrs}h"
            else:
                tiempo_str = f"{diff}m"

            vacias_info[s] = {
                'proxima_hora': prox['start'],
                'proximo_curso': prox['course'],
                'minutos_hasta_proxima': diff,
                'libre_todo_el_dia': False,
                'texto': f"{prox['start']} · {tiempo_str}"
            }
        else:
            vacias_info[s] = {
                'proxima_hora': None,
                'proximo_curso': None,
                'minutos_hasta_proxima': None,
                'libre_todo_el_dia': True,
                'texto': "Sin más clases"
            }

    # Aplicar el filtro de texto libre al resultado final
    filtro_f = (filtro_facultad or "").strip().upper()
    is_text_search = filtro_f and filtro_f not in ["TODAS", "INGENIERIA"]
    
    tokens = [t for t in normalize_str(filtro_f).split() if len(t) > 0] if is_text_search else []

    vacias_finales = []
    for s in vacias:
        if is_text_search:
            info = vacias_info[s]
            s_norm = normalize_str(s)
            c_norm = normalize_str(info.get('proximo_curso', ''))
            p_norm = "" # en vacias_info no guardamos profe por ahora, pero curso y sala sí
            if not all(t in s_norm or t in c_norm for t in tokens):
                continue
        elif filtro_f == "INGENIERIA" and not (s.startswith("E441") or s.startswith("V432")):
            continue
        vacias_finales.append(s)

    ocupadas_finales = {}
    for s, info in ocupadas_dict.items():
        if is_text_search:
            s_norm = normalize_str(s)
            c_norm = normalize_str(info.get('curso', ''))
            p_norm = normalize_str(info.get('profe', ''))
            if not all(t in s_norm or t in c_norm or t in p_norm for t in tokens):
                continue
        elif filtro_f == "INGENIERIA" and not (s.startswith("E441") or s.startswith("V432")):
            continue
        ocupadas_finales[s] = info

    vacias_ordenadas = sorted(
        vacias_finales,
        key=lambda s: (
            0 if vacias_info[s]['libre_todo_el_dia'] else 1,
            -(vacias_info[s]['minutos_hasta_proxima'] or 0),
            s
        )
    )

    ocupadas_ordenadas = dict(sorted(ocupadas_finales.items()))
    return vacias_ordenadas, ocupadas_ordenadas, vacias_info

def normalize_str(s):
    if not s:
        return ""
    nfkd = unicodedata.normalize('NFD', str(s))
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()

def _normalize_course_title(value):
    """Normalize punctuation and spacing while preserving full course words."""
    return " ".join(re.findall(r"[a-z0-9]+", normalize_str(value)))

_TEACHER_TITLE_TOKENS = {"prof", "profesor", "profesora", "dr", "dra", "doctor", "doctora", "ing"}

def _teacher_tokens(value):
    return [
        token for token in re.findall(r"[a-z0-9]+", normalize_str(value))
        if token not in _TEACHER_TITLE_TOKENS
    ]

def _token_edit_distance(left, right, limit):
    if abs(len(left) - len(right)) > limit:
        return None
    previous = list(range(len(right) + 1))
    for left_index, left_char in enumerate(left, start=1):
        current = [limit + 1] * (len(right) + 1)
        current[0] = left_index
        start = max(1, left_index - limit)
        end = min(len(right), left_index + limit)
        for right_index in range(start, end + 1):
            current[right_index] = min(
                previous[right_index] + 1,
                current[right_index - 1] + 1,
                previous[right_index - 1] + (left_char != right[right_index - 1]),
            )
        if min(current[start:end + 1] or [limit + 1]) > limit:
            return None
        previous = current
    return previous[len(right)] if previous[len(right)] <= limit else None

def distancia_nombre_profesor(left, right):
    """Order-independent, bounded token distance for OCR errors in names."""
    left_tokens = _teacher_tokens(left)
    right_tokens = _teacher_tokens(right)
    if not left_tokens or not right_tokens or len(str(left)) > 160 or len(str(right)) > 160:
        return None
    if len(left_tokens) > len(right_tokens) or len(left_tokens) > 10 or len(right_tokens) > 10:
        return None
    edges = []
    for token in left_tokens:
        choices = []
        for index, candidate in enumerate(right_tokens):
            if token == candidate:
                distance = 0
            else:
                tolerance = min(2, max(1, len(token) // 6)) if len(token) >= 5 else 0
                distance = _token_edit_distance(token, candidate, tolerance)
            if distance is not None:
                choices.append((distance, index))
        if not choices:
            return None
        edges.append(sorted(choices))

    # Assign every extracted name token to a different official name token.
    # The small cap keeps this bounded even for malformed client input.
    states = {0: 0}
    for choices in edges:
        next_states = {}
        for used_mask, score in states.items():
            for distance, index in choices:
                bit = 1 << index
                if used_mask & bit:
                    continue
                new_mask = used_mask | bit
                total = score + distance
                if total <= 4 and total < next_states.get(new_mask, 5):
                    next_states[new_mask] = total
        states = next_states
        if not states:
            return None
    return min(states.values())

def listar_profesores(clases=None):
    """Return the unique teacher names available to the professor selector."""
    if clases is None:
        clases = dm.get_classes()
    names = {}
    for clase in clases:
        nodo = clase.get("node", {}) if isinstance(clase, dict) else {}
        if not isinstance(nodo, dict):
            continue
        name = str(nodo.get("teacher") or "").strip()
        if len(name) > 160:
            continue
        normalized = normalize_str(name)
        if normalized:
            names.setdefault(normalized, name.upper())
    return list(names.values())

def buscar_nombres_profesores(query, clases=None):
    """Filter the selector's official teacher-name list, allowing OCR typos."""
    query = " ".join(str(query or "").split())
    if not query or len(query) > 160:
        return []
    query_normalized = normalize_str(query)
    tokens = query_normalized.split()
    matches = []
    for name in listar_profesores(clases):
        normalized = normalize_str(name)
        if all(token in normalized for token in tokens):
            distance = 0
        else:
            distance = distancia_nombre_profesor(query, name)
        if distance is not None:
            matches.append((distance, normalized, name))
    matches.sort(key=lambda item: (item[0], item[1]))
    return [name for _distance, _normalized, name in matches]

def mejor_coincidencia_profesor(query, clases=None):
    """Return one official name only when it is the unique closest match."""
    tokens = _teacher_tokens(query)
    if not tokens:
        return ""
    matches = []
    for name in listar_profesores(clases):
        distance = distancia_nombre_profesor(query, name)
        if distance is not None:
            matches.append((distance, normalize_str(name), name))
    if not matches:
        return ""
    best_distance = min(item[0] for item in matches)
    best = [item for item in matches if item[0] == best_distance]
    # A one-word OCR fragment is too weak to canonicalize unless it exactly
    # identifies one official token (distance zero).
    if len(tokens) == 1 and best_distance != 0:
        return ""
    return best[0][2] if len(best) == 1 else ""

def buscar_profesor(nombre_buscado, dia_filtro=None, hora_filtro=None):
    clases = dm.get_classes()
    resultados = []
    matched_names = {normalize_str(name) for name in buscar_nombres_profesores(nombre_buscado, clases)}
    if not matched_names:
        return []

    dia_int = None
    if dia_filtro and str(dia_filtro).strip().isdigit():
        d_val = int(dia_filtro)
        if 1 <= d_val <= 7:
            dia_int = d_val

    for clase in clases:
        nodo = clase.get('node', {})
        profe = nodo.get('teacher', "")
        norm_p = normalize_str(profe)
        if norm_p in matched_names:
            if dia_int is not None and nodo.get('day') != dia_int:
                continue
            c_start = format_time(nodo.get('start', ''))
            if hora_filtro:
                h_q = str(hora_filtro).strip()
                if not (h_q.startswith(c_start) or c_start.startswith(h_q.replace(":00", "")) or h_q in nodo.get('start', '')):
                    continue
            for sala, seccion in asignaciones_sala_seccion(nodo):
                resultados.append({
                    'sala': sala,
                    'curso': nodo.get('course', '-'),
                    'seccion': seccion,
                    'codigo': nodo.get('code', '-'),
                    'hora_inicio': c_start,
                    'hora_termino': format_time(nodo.get('finish', '')),
                    'dia_numero': nodo.get('day'),
                    'dia': nombre_dia(nodo.get('day')),
                    'profe': profe
                })
    # Ordenar por día y hora
    resultados.sort(key=lambda x: (x['dia_numero'], to_minutes(x['hora_inicio'])))
    return resultados

def buscar_curso(query, dia_filtro=None, hora_filtro=None):
    clases = dm.get_classes()
    resultados = []
    tokens = [t for t in normalize_str(query).split() if len(t) > 0] if query else []
    if not tokens and not (dia_filtro and hora_filtro):
        return []

    dia_int = None
    if dia_filtro:
        d_str = str(dia_filtro).strip().lower()
        if d_str == 'hoy':
            now = get_chile_now()
            d_val = now.weekday() + 1
            dia_int = d_val if d_val <= 5 else 1
        elif d_str.isdigit() and 1 <= int(d_str) <= 7:
            dia_int = int(d_str)

    for clase in clases:
        nodo = clase.get('node', {})
        curso = nodo.get('course', "")
        codigo = nodo.get('code', "")
        profe = nodo.get('teacher', "")
        norm_c = normalize_str(curso)
        norm_code = normalize_str(codigo)
        norm_p = normalize_str(profe)

        if tokens:
            if not (all(t in norm_c for t in tokens) or all(t in norm_code for t in tokens) or all(t in norm_p for t in tokens)):
                continue

        if dia_int is not None and nodo.get('day') != dia_int:
            continue
        c_start = format_time(nodo.get('start', ''))
        if hora_filtro:
            h_q = str(hora_filtro).strip()
            if not (h_q.startswith(c_start) or c_start.startswith(h_q.replace(":00", "")) or h_q in nodo.get('start', '')):
                continue

        for p, seccion in asignaciones_sala_seccion(nodo) or [('-', nodo.get('section', '-'))]:
            resultados.append({
                'sala': p,
                'curso': curso,
                'codigo': codigo,
                'seccion': seccion,
                'profe': nodo.get('teacher', 'No informado'),
                'dia': nombre_dia(nodo.get('day')),
                'dia_numero': nodo.get('day'),
                'hora_inicio': c_start,
                'hora_termino': format_time(nodo.get('finish', '')),
            })
    resultados.sort(key=lambda x: (x['curso'], x['dia_numero'], to_minutes(x['hora_inicio'])))
    return resultados

MALLA_ICIT = get_curriculum("ingenieria-civil-en-informatica-y-telecomunicaciones") or {}

def obtener_clases_malla(semestre=8, dia_filtro=None, ramo_filtro=None, hora_filtro=None, curriculum=None):
    curriculum = curriculum if curriculum is not None else MALLA_ICIT
    sem_info = curriculum.get(int(semestre))
    if not sem_info:
        return []
    
    clases = dm.get_classes()
    resultados = []
    
    dia_int = None
    if dia_filtro:
        d_str = str(dia_filtro).strip().lower()
        if d_str == 'hoy':
            now = get_chile_now()
            d_val = now.weekday() + 1
            dia_int = d_val if d_val <= 5 else 1
        elif d_str.isdigit() and 1 <= int(d_str) <= 7:
            dia_int = int(d_str)

    ramo_q = _normalize_course_title(ramo_filtro) if ramo_filtro else None

    for c in clases:
        n = c.get('node', {})
        curso_oficial = n.get('course', '')
        curso_norm = _normalize_course_title(curso_oficial)
        
        matched_ramo = None
        for r in sem_info['ramos']:
            if any(_normalize_course_title(k) == curso_norm for k in r['keywords']):
                matched_ramo = r['nombre']
                break
                
        if not matched_ramo:
            continue
            
        if ramo_q and ramo_q not in _normalize_course_title(matched_ramo):
            continue
            
        if dia_int is not None and n.get('day') != dia_int:
            continue

        c_start = format_time(n.get('start', ''))
        if hora_filtro:
            h_q = str(hora_filtro).strip()
            if not (h_q.startswith(c_start) or c_start.startswith(h_q.replace(":00", "")) or h_q in n.get('start', '')):
                continue

        for p, seccion in asignaciones_sala_seccion(n) or [('-', n.get('section', '-'))]:
            if not p: continue
            resultados.append({
                'ramo_malla': matched_ramo,
                'curso_oficial': curso_oficial,
                'seccion': seccion,
                'codigo': n.get('code', '-'),
                'dia': nombre_dia(n.get('day')),
                'dia_numero': n.get('day'),
                'hora_inicio': c_start,
                'hora_termino': format_time(n.get('finish', '')),
                'sala': p,
                'profe': n.get('teacher', 'No informado')
            })

    # Ordenar primero los ramos más temprano (8:30 en adelante), luego por día, nombre y sección
    def sort_key_malla(item):
        try:
            sec_num = int(str(item['seccion']).strip())
        except ValueError:
            sec_num = 999
        return (to_minutes(item['hora_inicio']), item['dia_numero'], item['ramo_malla'], sec_num)

    resultados.sort(key=sort_key_malla)
    return resultados

def horario_de_sala(nombre_sala):
    clases = dm.get_classes()
    nombre_clean = (nombre_sala or "").strip().upper()
    horario_semanal = {d: [] for d in range(1, 6)}  # Lunes a Viernes

    for clase in clases:
        nodo = clase.get('node', {})
        asignacion = next(
            ((sala, seccion) for sala, seccion in asignaciones_sala_seccion(nodo) if sala.upper() == nombre_clean),
            None
        )
        if asignacion:
            _, seccion = asignacion
            dia = nodo.get('day')
            if dia in horario_semanal:
                horario_semanal[dia].append({
                    'curso': nodo.get('course', '-'),
                    'codigo': nodo.get('code', '-'),
                    'seccion': seccion,
                    'profe': nodo.get('teacher', 'No informado'),
                    'start': format_time(nodo.get('start', '')),
                    'finish': format_time(nodo.get('finish', ''))
                })

    for dia in horario_semanal:
        horario_semanal[dia].sort(key=lambda x: to_minutes(x['start']))

    return horario_semanal

def calcular_bloque_actual(ref_datetime=None):
    """Determina el día y bloque correspondiente a la hora local actual de Chile (America/Santiago)."""
    now = ref_datetime or get_chile_now()
    dia_real = now.weekday() + 1
    current_min = now.hour * 60 + now.minute

    es_fin_de_semana = dia_real > 5
    primer_bloque_min = STANDARD_BLOCKS[0]["start_min"]  # 08:30 (510 min)
    ultimo_bloque_min = max(block["end_min"] for block in STANDARD_BLOCKS if not block["id"].endswith("_S"))  # 18:45
    fuera_de_hora = current_min < primer_bloque_min or current_min > ultimo_bloque_min

    en_horario_valido = (not es_fin_de_semana) and (not fuera_de_hora)

    dia_seleccionado = dia_real if not es_fin_de_semana else 1
    bloque_seleccionado = STANDARD_BLOCKS[0]

    for b in STANDARD_BLOCKS:
        if current_min <= b["end_min"]:
            bloque_seleccionado = b
            break
    else:
        bloque_seleccionado = STANDARD_BLOCKS[0] if fuera_de_hora else STANDARD_BLOCKS[-1]

    mensaje_horario = ""
    if es_fin_de_semana:
        mensaje_horario = "Actualmente es fin de semana. Las clases se dictan de lunes a viernes (08:30 - 18:45)."
    elif current_min < primer_bloque_min:
        mensaje_horario = "Aún no inicia el horario de clases de hoy (el primer bloque inicia a las 08:30)."
    elif current_min > ultimo_bloque_min:
        mensaje_horario = "La jornada de clases ya finalizó por hoy (el último bloque finalizó a las 18:45)."

    return dia_seleccionado, bloque_seleccionado, en_horario_valido, mensaje_horario
