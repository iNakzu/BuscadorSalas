import os
import re
import json
import time
import datetime
import difflib
from urllib.request import Request, urlopen
from urllib.error import URLError
from flask import Flask, request, render_template, jsonify

app = Flask(__name__)

REMOTE_URL = "https://salas.docencia-eit.cl/data.json"
LOCAL_DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')

# Definición de bloques horarios estándar UDP
STANDARD_BLOCKS = [
    {"id": "8:30:00", "label": "08:30 - 09:50", "start": "08:30:00", "finish": "09:50:00", "start_min": 8 * 60 + 30, "end_min": 9 * 60 + 50},
    {"id": "10:00:00", "label": "10:00 - 11:20", "start": "10:00:00", "finish": "11:20:00", "start_min": 10 * 60, "end_min": 11 * 60 + 20},
    {"id": "11:30:00", "label": "11:30 - 12:50", "start": "11:30:00", "finish": "12:50:00", "start_min": 11 * 60 + 30, "end_min": 12 * 60 + 50},
    {"id": "13:00:00", "label": "13:00 - 14:20", "start": "13:00:00", "finish": "14:20:00", "start_min": 13 * 60, "end_min": 14 * 60 + 20},
    {"id": "14:30:00", "label": "14:30 - 15:50", "start": "14:30:00", "finish": "15:50:00", "start_min": 14 * 60 + 30, "end_min": 15 * 60 + 50},
    {"id": "16:00:00", "label": "16:00 - 17:20", "start": "16:00:00", "finish": "17:20:00", "start_min": 16 * 60, "end_min": 17 * 60 + 20},
    {"id": "17:25:00", "label": "17:25 - 18:45", "start": "17:25:00", "finish": "18:45:00", "start_min": 17 * 60 + 25, "end_min": 18 * 60 + 45}
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
    def __init__(self):
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
        if os.path.exists(LOCAL_DATA_FILE):
            try:
                with open(LOCAL_DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.cache = data
                self.last_synced = datetime.datetime.fromtimestamp(os.path.getmtime(LOCAL_DATA_FILE), tz=CHILE_TZ).strftime("%d/%m/%Y %H:%M:%S")
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
                    with open(LOCAL_DATA_FILE, 'w', encoding='utf-8') as f:
                        f.write(content)
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
        for e in edges:
            p = e.get('node', {}).get('place')
            if p:
                rooms_set.add(p)
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
    return f in nombre_sala.upper()

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
        nombre_sala = nodo.get('place')
        if not nombre_sala:
            continue

        if not coincide_facultad(nombre_sala, filtro_facultad):
            continue

        todas_las_salas.add(nombre_sala)

        if nodo.get('day') == dia_int:
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
                'section': nodo.get('section', '-'),
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
                tiempo_str = f"{hrs}h{mins:02d}" if mins else f"{hrs}h"
            else:
                tiempo_str = f"{diff}m"

            vacias_info[s] = {
                'proxima_hora': prox['start'],
                'proximo_curso': prox['course'],
                'minutos_hasta_proxima': diff,
                'libre_todo_el_dia': False,
                'texto': f"Hasta las {prox['start']} ({tiempo_str})"
            }
        else:
            vacias_info[s] = {
                'proxima_hora': None,
                'proximo_curso': None,
                'minutos_hasta_proxima': None,
                'libre_todo_el_dia': True,
                'texto': "Libre el resto del día"
            }

    vacias_ordenadas = sorted(
        vacias,
        key=lambda s: (
            0 if vacias_info[s]['libre_todo_el_dia'] else 1,
            -(vacias_info[s]['minutos_hasta_proxima'] or 0),
            s
        )
    )

    ocupadas_ordenadas = dict(sorted(ocupadas_dict.items()))
    return vacias_ordenadas, ocupadas_ordenadas, vacias_info

import unicodedata

def normalize_str(s):
    if not s:
        return ""
    nfkd = unicodedata.normalize('NFD', str(s))
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()

def buscar_profesor(nombre_buscado, dia_filtro=None, hora_filtro=None):
    clases = dm.get_classes()
    resultados = []
    tokens = [t for t in normalize_str(nombre_buscado).split() if len(t) > 0]
    if not tokens:
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
        if all(t in norm_p for t in tokens):
            if dia_int is not None and nodo.get('day') != dia_int:
                continue
            c_start = format_time(nodo.get('start', ''))
            if hora_filtro:
                h_q = str(hora_filtro).strip()
                if not (h_q.startswith(c_start) or c_start.startswith(h_q.replace(":00", "")) or h_q in nodo.get('start', '')):
                    continue
            resultados.append({
                'sala': nodo.get('place', '-'),
                'curso': nodo.get('course', '-'),
                'seccion': nodo.get('section', '-'),
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
    tokens = [t for t in normalize_str(query).split() if len(t) > 0]
    if not tokens:
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
        norm_c = normalize_str(curso)
        norm_code = normalize_str(codigo)
        if all(t in norm_c for t in tokens) or all(t in norm_code for t in tokens):
            if dia_int is not None and nodo.get('day') != dia_int:
                continue
            c_start = format_time(nodo.get('start', ''))
            if hora_filtro:
                h_q = str(hora_filtro).strip()
                if not (h_q.startswith(c_start) or c_start.startswith(h_q.replace(":00", "")) or h_q in nodo.get('start', '')):
                    continue
            resultados.append({
                'sala': nodo.get('place', '-'),
                'curso': curso,
                'codigo': codigo,
                'seccion': nodo.get('section', '-'),
                'profe': nodo.get('teacher', 'No informado'),
                'dia': nombre_dia(nodo.get('day')),
                'dia_numero': nodo.get('day'),
                'hora_inicio': c_start,
                'hora_termino': format_time(nodo.get('finish', '')),
            })
    resultados.sort(key=lambda x: (x['curso'], x['dia_numero'], to_minutes(x['hora_inicio'])))
    return resultados

MALLA_ICIT = {
    1: {
        "nombre": "Semestre I",
        "ramos": [
            {"nombre": "Álgebra y Geometría", "keywords": ["algebra y geometria", "introduccion al algebra"]},
            {"nombre": "Cálculo I", "keywords": ["introduccion al calculo", "calculo i"]},
            {"nombre": "Química", "keywords": ["quimica"]},
            {"nombre": "Programación", "keywords": ["programacion"]},
            {"nombre": "Comunicación para la Ingeniería", "keywords": ["comunicacion para la ingenieria", "habilidades"]}
        ]
    },
    2: {
        "nombre": "Semestre II",
        "ramos": [
            {"nombre": "Álgebra Lineal", "keywords": ["algebra lineal"]},
            {"nombre": "Cálculo II", "keywords": ["calculo diferencial e integral"]},
            {"nombre": "Mecánica", "keywords": ["mecanica"]},
            {"nombre": "Programación Avanzada", "keywords": ["programacion avanzada"]}
        ]
    },
    3: {
        "nombre": "Semestre III",
        "ramos": [
            {"nombre": "Ecuaciones Diferenciales", "keywords": ["ecuaciones diferenciales"]},
            {"nombre": "Cálculo III", "keywords": ["calculo iii"]},
            {"nombre": "Calor y Ondas", "keywords": ["calor y ondas"]},
            {"nombre": "Estructuras de Datos y Algoritmos", "keywords": ["estructuras de datos", "estructura de datos"]},
            {"nombre": "Redes de Datos", "keywords": ["redes de datos"]}
        ]
    },
    4: {
        "nombre": "Semestre IV",
        "ramos": [
            {"nombre": "Probabilidades y Estadísticas", "keywords": ["probabilidades y estadistica", "probabilidades y estadisticas"]},
            {"nombre": "Electrónica y Electrotecnia", "keywords": ["electronica y electrotecnia"]},
            {"nombre": "Electricidad y Magnetismo", "keywords": ["electricidad y magnetismo"]},
            {"nombre": "Bases de Datos", "keywords": ["bases de datos"]},
            {"nombre": "Desarrollo Web y Móvil", "keywords": ["desarrollo web"]},
            {"nombre": "Inglés I", "keywords": ["ingles i"]}
        ]
    },
    5: {
        "nombre": "Semestre V",
        "ramos": [
            {"nombre": "Optimización", "keywords": ["optimizacion"]},
            {"nombre": "Taller de Redes y Servicios", "keywords": ["taller de redes"]},
            {"nombre": "Proyecto en TICs I", "keywords": ["proyecto en tics i", "proyecto tic i"]},
            {"nombre": "Bases de Datos Avanzadas", "keywords": ["bases de datos avanzadas"]},
            {"nombre": "Inglés II", "keywords": ["ingles ii"]}
        ]
    },
    6: {
        "nombre": "Semestre VI",
        "ramos": [
            {"nombre": "Contabilidad y Costos", "keywords": ["contabilidad y costos"]},
            {"nombre": "Arquitectura y Organización de Computadores", "keywords": ["arquitectura y organiz"]},
            {"nombre": "Señales y Sistemas", "keywords": ["senales y sistemas"]},
            {"nombre": "Sistemas Operativos", "keywords": ["sistemas operativos"]},
            {"nombre": "Inglés III", "keywords": ["ingles iii"]}
        ]
    },
    7: {
        "nombre": "Semestre VII",
        "ramos": [
            {"nombre": "Gestión Organizacional", "keywords": ["gestion organizacional"]},
            {"nombre": "Sistemas Distribuidos", "keywords": ["sistemas distribuidos"]},
            {"nombre": "Comunicaciones Digitales", "keywords": ["comunicaciones digitales"]},
            {"nombre": "Ingeniería de Software", "keywords": ["ingenieria de software"]}
        ]
    },
    8: {
        "nombre": "Semestre VIII",
        "ramos": [
            {"nombre": "Introducción a la Economía", "keywords": ["introduccion  a la economia", "introduccion a la economia", "microeconomia"]},
            {"nombre": "Tecnologías Inalámbricas", "keywords": ["tecnologias inalambricas"]},
            {"nombre": "Criptografía y Seguridad de Redes", "keywords": ["criptografia y seguridad en redes", "criptografia"]},
            {"nombre": "Inteligencia Artificial", "keywords": ["inteligencia artificial"]},
            {"nombre": "Evaluación de Proyectos TIC", "keywords": ["evaluacion de proyectos tic"]}
        ]
    },
    9: {
        "nombre": "Semestre IX",
        "ramos": [
            {"nombre": "Arquitecturas Emergentes", "keywords": ["arquitecturas emergentes"]},
            {"nombre": "Arquitectura de Software", "keywords": ["arquitectura de software"]},
            {"nombre": "Data Science", "keywords": ["data science"]}
        ]
    },
    10: {
        "nombre": "Semestre X",
        "ramos": [
            {"nombre": "Proyecto en TICs II", "keywords": ["proyecto en tics ii", "proyecto tic ii"]}
        ]
    },
    11: {
        "nombre": "Semestre XI",
        "ramos": [
            {"nombre": "Actividad de Titulación", "keywords": ["titulacion", "memoria"]}
        ]
    }
}

def obtener_clases_malla(semestre=8, dia_filtro=None, ramo_filtro=None, hora_filtro=None):
    sem_info = MALLA_ICIT.get(int(semestre))
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

    ramo_q = normalize_str(ramo_filtro) if ramo_filtro else None

    for c in clases:
        n = c.get('node', {})
        curso_oficial = n.get('course', '')
        curso_norm = normalize_str(curso_oficial)
        
        matched_ramo = None
        for r in sem_info['ramos']:
            if any(k in curso_norm for k in r['keywords']):
                matched_ramo = r['nombre']
                break
                
        if not matched_ramo:
            continue
            
        if ramo_q and ramo_q not in normalize_str(matched_ramo):
            continue
            
        if dia_int is not None and n.get('day') != dia_int:
            continue

        c_start = format_time(n.get('start', ''))
        if hora_filtro:
            h_q = str(hora_filtro).strip()
            if not (h_q.startswith(c_start) or c_start.startswith(h_q.replace(":00", "")) or h_q in n.get('start', '')):
                continue

        resultados.append({
            'ramo_malla': matched_ramo,
            'curso_oficial': curso_oficial,
            'seccion': n.get('section', '-'),
            'codigo': n.get('code', '-'),
            'dia': nombre_dia(n.get('day')),
            'dia_numero': n.get('day'),
            'hora_inicio': c_start,
            'hora_termino': format_time(n.get('finish', '')),
            'sala': n.get('place', '-'),
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
        if nodo.get('place', '').upper() == nombre_clean:
            dia = nodo.get('day')
            if dia in horario_semanal:
                horario_semanal[dia].append({
                    'curso': nodo.get('course', '-'),
                    'codigo': nodo.get('code', '-'),
                    'seccion': nodo.get('section', '-'),
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
    ultimo_bloque_min = STANDARD_BLOCKS[-1]["end_min"]   # 18:45 (1125 min)
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

# --- RUTAS Y ENDPOINTS ---

@app.after_request
def add_no_cache_headers(response):
    if request.path == "/" or request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

@app.route("/", methods=["GET", "POST"])
def inicio():
    vacias = []
    ocupadas = {}
    resultados_profe = []
    busqueda_realizada = False
    modo = "salas"

    seleccion = {
        'dia': '1',
        'hora': '8:30:00',
        'facultad': 'INGENIERIA',
        'profe': ''
    }

    if request.method == "POST":
        seleccion['dia'] = request.form.get("dia", seleccion['dia'])
        seleccion['hora'] = request.form.get("hora", seleccion['hora'])
        seleccion['facultad'] = request.form.get("facultad", "")
        seleccion['profe'] = request.form.get("profe", "")

        if seleccion['profe'] and seleccion['profe'].strip() != "":
            modo = "profesor"
            resultados_profe = buscar_profesor(seleccion['profe'])
        else:
            modo = "salas"
            vacias, ocupadas, vacias_info = obtener_salas(seleccion['dia'], seleccion['hora'], seleccion['facultad'])

        busqueda_realizada = True
    else:
        # Consulta por defecto: Lunes a las 08:30
        vacias, ocupadas, vacias_info = obtener_salas(seleccion['dia'], seleccion['hora'], seleccion['facultad'])
        busqueda_realizada = True

    return render_template(
        "index.html",
        vacias=vacias,
        ocupadas=ocupadas,
        vacias_info=vacias_info,
        resultados_profe=resultados_profe,
        busqueda_realizada=busqueda_realizada,
        sel=seleccion,
        modo=modo,
        bloques=STANDARD_BLOCKS,
        status=dm.get_status(),
        todas_las_salas=dm.all_rooms
    )

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify(dm.get_status())

@app.route("/api/sync", methods=["POST", "GET"])
def api_sync():
    ok = dm.sync_from_remote()
    return jsonify({
        "success": ok,
        "message": "Datos sincronizados exitosamente desde salas.docencia-eit.cl" if ok else "No se pudo sincronizar; usando respaldo local.",
        "status": dm.get_status()
    })

@app.route("/api/salas", methods=["GET"])
def api_salas():
    dia = request.args.get("dia", "1")
    hora = request.args.get("hora", "8:30:00")
    facultad = request.args.get("facultad", "")
    
    vacias, ocupadas, vacias_info = obtener_salas(dia, hora, facultad)
    return jsonify({
        "dia": int(dia),
        "dia_nombre": nombre_dia(dia),
        "hora": hora,
        "facultad": facultad,
        "total_libres": len(vacias),
        "total_ocupadas": len(ocupadas),
        "vacias": vacias,
        "vacias_info": vacias_info,
        "ocupadas": ocupadas
    })

@app.route("/api/ahora", methods=["GET"])
def api_ahora():
    facultad = request.args.get("facultad", "INGENIERIA")
    now_chile = get_chile_now()
    dia_actual, bloque_actual, en_horario_valido, mensaje_horario = calcular_bloque_actual(now_chile)
    vacias, ocupadas, vacias_info = obtener_salas(dia_actual, bloque_actual['id'], facultad)
    
    return jsonify({
        "dia": dia_actual,
        "dia_nombre": nombre_dia(dia_actual),
        "bloque": bloque_actual,
        "en_horario_valido": en_horario_valido,
        "mensaje_horario": mensaje_horario,
        "hora_chile": now_chile.strftime("%H:%M:%S"),
        "fecha_chile": f"{DIAS_SEMANA.get(dia_actual, '')} {now_chile.day} de {MESES_ES.get(now_chile.month, '')} de {now_chile.year}",
        "facultad": facultad,
        "total_libres": len(vacias),
        "total_ocupadas": len(ocupadas),
        "vacias": vacias,
        "vacias_info": vacias_info,
        "ocupadas": ocupadas
    })

@app.route("/api/search", methods=["GET"])
def api_search():
    q = request.args.get("q", "").strip()
    dia = request.args.get("dia", "").strip()
    hora = request.args.get("hora", "").strip()
    if not q or len(q) < 2:
        return jsonify({"query": q, "dia": dia, "hora": hora, "profesores": [], "cursos": [], "salas": []})

    profes = buscar_profesor(q, dia_filtro=dia, hora_filtro=hora)
    cursos = buscar_curso(q, dia_filtro=dia, hora_filtro=hora)
    salas_coincidentes = [s for s in dm.all_rooms if normalize_str(q) in normalize_str(s)]

    return jsonify({
        "query": q,
        "dia": dia,
        "hora": hora,
        "profesores": profes[:50],
        "cursos": cursos[:60],
        "ramos": cursos[:60],
        "salas": salas_coincidentes[:25]
    })

@app.route("/api/sala/<nombre_sala>", methods=["GET"])
def api_horario_sala(nombre_sala):
    horario = horario_de_sala(nombre_sala)
    return jsonify({
        "sala": nombre_sala.upper(),
        "horario": horario
    })

@app.route("/api/malla", methods=["GET"])
def api_malla():
    semestre = request.args.get("semestre", "8")
    dia = request.args.get("dia", "").strip()
    ramo = request.args.get("ramo", "").strip()
    hora = request.args.get("hora", "").strip()

    try:
        sem_num = int(semestre)
    except ValueError:
        sem_num = 8

    sem_info = MALLA_ICIT.get(sem_num, MALLA_ICIT[8])
    clases_malla = obtener_clases_malla(sem_num, dia_filtro=dia, ramo_filtro=ramo, hora_filtro=hora)
    semestres_disponibles = [{"numero": k, "nombre": v["nombre"]} for k, v in sorted(MALLA_ICIT.items())]

    return jsonify({
        "semestre": sem_num,
        "semestre_nombre": sem_info["nombre"],
        "carrera": "Ingeniería Civil en Informática y Telecomunicaciones",
        "semestres_disponibles": semestres_disponibles,
        "ramos_del_semestre": [r["nombre"] for r in sem_info["ramos"]],
        "dia_filtro": dia,
        "ramo_filtro": ramo,
        "hora_filtro": hora,
        "total_clases": len(clases_malla),
        "clases": clases_malla
    })

def get_api_key():
    # 1. Priorizar lectura directa desde archivo .env en varias rutas posibles
    posibles_rutas = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
        os.path.join(os.getcwd(), '.env'),
        '.env'
    ]
    for env_path in posibles_rutas:
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r', encoding='utf-8-sig') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GEMINI_API_KEY="):
                            key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if key:
                                return key
            except Exception:
                pass

    # 2. Fallback a variable de entorno del sistema
    return os.environ.get("GEMINI_API_KEY", "").strip()

STOPWORDS = {
    'de', 'la', 'las', 'los', 'el', 'en', 'del', 'y', 'para', 'con', 'un', 'una', 'por', 'a', 'al', 'o',
    'dime', 'que', 'cual', 'cuales', 'hay', 'donde', 'sala', 'salas', 'ver', 'busca', 'buscar',
    'horario', 'horarios', 'profe', 'profesor', 'profesora', 'ramo', 'ramos', 'curso', 'cursos',
    'clase', 'clases', 'disponible', 'disponibles', 'libre', 'libres', 'vacia', 'vacias', 'desocupada',
    'desocupadas', 'ahora', 'hoy', 'manana', 'mañana', 'toda', 'todas', 'todo', 'todos', 'lista', 'listame', 'porfa',
    'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'como', 'estas', 'quien', 'eres', 'puedes', 'hacer',
    'ayuda', 'gracias', 'favor', 'saludos', 'funciona'
}

def clean_tokens(text):
    text_norm = normalize_str(text)
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', text_norm)
    return [w for w in cleaned.split() if w]

def format_title(s):
    if not s:
        return ""
    words = s.lower().split()
    menores = {'de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'e', 'para', 'con', 'a', 'o'}
    resultado = []
    for i, w in enumerate(words):
        if i == 0 or w not in menores:
            resultado.append(w.capitalize())
        else:
            resultado.append(w)
    return ' '.join(resultado)

def extraer_dia_semana(texto):
    texto_norm = normalize_str(texto)
    dia_map = {'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6, 'domingo': 7}
    for d_nom, d_id in dia_map.items():
        if re.search(rf'\b{d_nom}\b', texto_norm):
            return d_id, DIAS_SEMANA[d_id]
    if re.search(r'\bhoy\b', texto_norm):
        now = get_chile_now()
        d_val = now.weekday() + 1
        return (d_val if d_val <= 5 else 1), "Hoy"
    if re.search(r'\bmanana\b', texto_norm):
        now = get_chile_now()
        d_val = (now.weekday() + 1) % 7 + 1
        return (d_val if d_val <= 5 else 1), "Mañana"
    if any(p in texto_norm for p in ['toda la semana', 'toda semana', 'todos los dias', 'semana completa']):
        return 'TODOS', "Toda la semana"
    return None, None

def extraer_hora_y_bloque(texto):
    texto_lower = texto.lower()
    
    # 1. Bloque explícito: bloque 1 .. bloque 7
    m_bloque = re.search(r'\bbloque\s*([1-7])\b', texto_lower)
    if m_bloque:
        idx = int(m_bloque.group(1)) - 1
        return STANDARD_BLOCKS[idx], f'Bloque {idx+1}'

    # 2. Hora con minutos: 08:30, 8:30, 14.30, 14:30:00
    m = re.search(r'\b(\d{1,2})[:.](\d{2})(?::\d{2})?\b', texto_lower)
    if m:
        h = int(m.group(1))
        mins = int(m.group(2))
        if 1 <= h <= 6:
            h += 12
        total_mins = h * 60 + mins
        for b in STANDARD_BLOCKS:
            if b["start_min"] <= total_mins <= b["end_min"]:
                return b, f"{h:02d}:{mins:02d}"
        mejor_b = min(STANDARD_BLOCKS, key=lambda b: abs(b["start_min"] - total_mins))
        return mejor_b, f"{h:02d}:{mins:02d}"

    # 3. a las 14, a las 2, a las 10
    m_h = re.search(r'\ba\s+las?\s+(\d{1,2})(?:\s*(?:horas?|hrs?))?\b', texto_lower)
    if m_h:
        h = int(m_h.group(1))
        if 1 <= h <= 6:
            h += 12
        total_mins = h * 60
        mejor_b = min(STANDARD_BLOCKS, key=lambda b: abs(b["start_min"] - total_mins))
        return mejor_b, f"{h:02d}:00"

    # 4. 14 hrs, 2pm, 10am
    m_ampm = re.search(r'\b(\d{1,2})\s*(pm|am|hrs?|horas?)\b', texto_lower)
    if m_ampm:
        h = int(m_ampm.group(1))
        mod = m_ampm.group(2)
        if mod == 'pm' and h < 12:
            h += 12
        elif 1 <= h <= 6:
            h += 12
        total_mins = h * 60
        mejor_b = min(STANDARD_BLOCKS, key=lambda b: abs(b["start_min"] - total_mins))
        return mejor_b, f"{h:02d}:00"

    return None, None

def buscar_sala_en_texto(texto):
    texto_norm = normalize_str(texto)
    # Coincidencia directa exacta con límites de palabra para no confundir palabras comunes (ej. 'loca') con salas (ej. 'LOC')
    for s in dm.all_rooms:
        s_norm = normalize_str(s)
        if '.' in s_norm or '-' in s_norm:
            if s_norm in texto_norm or s_norm.replace('.', '') in texto_norm.replace('.', ''):
                return s
        else:
            if re.search(rf'\b{re.escape(s_norm)}\b', texto_norm):
                return s

    tokens = [w for w in clean_tokens(texto) if w not in STOPWORDS]
    if not tokens:
        return None

    candidatos = []
    for s in dm.all_rooms:
        s_tokens = clean_tokens(s)
        matches = [t for t in s_tokens if any(t == w for w in tokens)]
        if matches:
            score = len(matches) / len(s_tokens)
            candidatos.append((len(matches), score, s))

    if candidatos:
        candidatos.sort(key=lambda x: (-x[0], -x[1]))
        best = candidatos[0]
        if best[0] >= 2 or (len(clean_tokens(best[2])) == 1 and best[2].lower() in tokens and len(best[2]) >= 4):
            return best[2]
    return None

def consultar_estado_sala(sala_code, dia_id=None, bloque=None):
    dia_actual, bloque_actual, en_horario, msg_horario = calcular_bloque_actual()
    dia_evaluar = dia_id if dia_id else dia_actual
    bloque_evaluar = bloque if bloque else bloque_actual

    dia_nom = nombre_dia(dia_evaluar)
    vacias, ocupadas, vacias_info = obtener_salas(dia_evaluar, bloque_evaluar['id'], "")

    lineas = []
    if sala_code in ocupadas:
        info = ocupadas[sala_code]
        curso = format_title(info.get('curso', ''))
        profe = info.get('profe', '').title()
        sec = info.get('seccion', '')
        lineas.append(f"La sala `{sala_code}` se encuentra **OCUPADA** para el **{dia_nom}** en el bloque de **{bloque_evaluar['label']}**:\n")
        lineas.append(f"* Clase: **{curso}**")
        if profe and profe != 'No Informado':
            lineas.append(f"* Docente: **{profe}**")
        if sec and sec != '-':
            lineas.append(f"* Sección: **Sec. {sec}**")
    else:
        lineas.append(f"La sala `{sala_code}` se encuentra **DISPONIBLE** para el **{dia_nom}** en el bloque de **{bloque_evaluar['label']}**.\n")
        lineas.append("No registra clases programadas en ese bloque horario.")

    botones = f"[ACCION:horario sala {sala_code}|Ver horario completo de {sala_code}] [ACCION:salas libres ahora|Ver salas libres ahora]"
    lineas.append(f"\n{botones}")
    return "\n".join(lineas)

def consultar_docente_en_vivo(p_name):
    clases_profe = buscar_profesor(p_name)
    if not clases_profe:
        return f"No encontré clases registradas para **{p_name}**."

    nombre_display = p_name.title()
    dia_actual, bloque_actual, en_horario, msg_horario = calcular_bloque_actual()
    dia_nom = nombre_dia(dia_actual)

    clases_hoy = [c for c in clases_profe if c['dia_numero'] == dia_actual]
    clase_actual = None
    for c in clases_hoy:
        ini = to_minutes(c['hora_inicio'])
        fin = to_minutes(c['hora_termino'])
        if ini <= bloque_actual['end_min'] and fin >= bloque_actual['start_min']:
            clase_actual = c
            break

    lineas = []
    if clase_actual:
        curso = format_title(clase_actual['curso'])
        sec = f"Sec. {clase_actual['seccion']}" if clase_actual['seccion'] != '-' else ""
        sala = clase_actual['sala']
        hora = f"{clase_actual['hora_inicio']} - {clase_actual['hora_termino']}"
        lineas.append(f"El/la docente **{nombre_display}** se encuentra dictando clases en este momento ({dia_nom}, bloque {bloque_actual['label']}):\n")
        lineas.append(f"* [CLASE] {hora} | `{sala}` | {curso} | {sec}\n")
    else:
        lineas.append(f"El/la docente **{nombre_display}** **no tiene clases en este momento** ({dia_nom}, bloque {bloque_actual['label']}).")
        if clases_hoy:
            proximas = [c for c in clases_hoy if to_minutes(c['hora_inicio']) > bloque_actual['start_min']]
            if proximas:
                proximas.sort(key=lambda x: to_minutes(x['hora_inicio']))
                prox = proximas[0]
                lineas.append(f"Su próxima clase de hoy es a las **{prox['hora_inicio']}** en la sala `{prox['sala']}` ({format_title(prox['curso'])}).\n")
            else:
                lineas.append(f"Sus clases programadas para hoy ya concluyeron.\n")
        else:
            lineas.append(f"No tiene clases programadas para el día de hoy ({dia_nom}).\n")

    botones = f"[ACCION:{nombre_display} hoy|Ver horario de hoy] [ACCION:{nombre_display} toda la semana|Ver toda la semana]"
    lineas.append(f"{botones}")
    return "\n".join(lineas)

def generar_respuesta_horario_sala(sala_sel, dia_id=None):
    horario = horario_de_sala(sala_sel)

    if dia_id is None:
        botones = ' '.join(f"[ACCION:horario sala {sala_sel} {DIAS_SEMANA[d].lower()}|{DIAS_SEMANA[d]}]" for d in range(1, 6))
        botones += f" [ACCION:horario sala {sala_sel} toda la semana|Ver toda la semana]"
        return (
            f"Encontré la sala `{sala_sel}`.\n\n"
            f"¿Para qué día deseas consultar su programación de clases?\n\n"
            f"{botones}"
        )

    if dia_id == 'TODOS':
        lineas = [f"Horario semanal completo para la sala `{sala_sel}`:\n"]
        for d in range(1, 6):
            cl_dia = horario.get(d, [])
            lineas.append(f"### {nombre_dia(d)}")
            if cl_dia:
                for c in cl_dia:
                    sec = f"Sec. {c['seccion']}" if c['seccion'] != '-' else ""
                    lineas.append(f"* [CLASE] {c['start']} - {c['finish']} | `{sala_sel}` | {format_title(c['curso'])} | {sec}")
            else:
                lineas.append("* Sin clases programadas (sala desocupada todo el día)")
            lineas.append("")
        return "\n".join(lineas)

    dia_nom = nombre_dia(dia_id)
    cl_dia = horario.get(dia_id, [])
    lineas = [f"Programación de clases para la sala `{sala_sel}` el día **{dia_nom}**:\n"]
    if cl_dia:
        for c in cl_dia:
            sec = f"Sec. {c['seccion']}" if c['seccion'] != '-' else ""
            lineas.append(f"* [CLASE] {c['start']} - {c['finish']} | `{sala_sel}` | {format_title(c['curso'])} | {sec}")
    else:
        lineas.append("* Sin clases programadas en este día (sala disponible toda la jornada).")

    otros_dias = [d for d in range(1, 6) if d != dia_id]
    botones = ' '.join(f"[ACCION:horario sala {sala_sel} {DIAS_SEMANA[d].lower()}|{DIAS_SEMANA[d]}]" for d in otros_dias)
    botones += f" [ACCION:horario sala {sala_sel} toda la semana|Ver toda la semana]"
    lineas.append(f"\n{botones}")
    return "\n".join(lineas)

def generar_listado_todas_las_salas():
    edificios_map = {
        'E441': 'Edificio Ejército 441 (Facultad de Ingeniería)',
        'V432': 'Edificio Vergara 432 (Facultad de Ingeniería)',
        'E306': 'Edificio Ejército 306',
        'E326': 'Edificio Ejército 326',
        'E333': 'Edificio Ejército 333',
        'E278A': 'Edificio Ejército 278A',
        'E278B': 'Edificio Ejército 278B',
        'M253A': 'Edificio Manuel Rodríguez 253A',
        'M253B': 'Edificio Manuel Rodríguez 253B',
        'V275': 'Edificio Vergara 275',
        'V210': 'Edificio Vergara 210',
        'R105': 'Edificio República 105',
        'LOC': 'Local Externo',
        'ONLINE': 'Virtual / Online'
    }
    agrupadas = {}
    for s in dm.all_rooms:
        pref = s.split('.')[0]
        agrupadas.setdefault(pref, []).append(s)

    lineas = [
        f"El sistema cuenta con un total de **{len(dm.all_rooms)} salas registradas**.",
        "A continuación tienes el listado completo organizado por edificio:\n"
    ]
    for pref, salas in sorted(agrupadas.items(), key=lambda x: (-len(x[1]), x[0])):
        nombre_edif = edificios_map.get(pref, f"Edificio {pref}")
        pills = " ".join(f"`{s}`" for s in salas)
        lineas.append(f"### {nombre_edif} ({len(salas)} salas)")
        lineas.append(f"{pills}\n")

    return "\n".join(lineas)

def generar_respuesta_salas_libres(dia_id, dia_nom, bloque_ref, es_en_vivo=False, msg_horario=None, sugerir_otros_dias=False):
    vacias_ing, ocup_ing, info_ing = obtener_salas(dia_id, bloque_ref['id'], "INGENIERIA")
    vacias_todas, ocup_todas, info_todas = obtener_salas(dia_id, bloque_ref['id'], "")

    titulo = f"Para el **{dia_nom}** en el bloque de **{bloque_ref['label']}**"
    if es_en_vivo:
        titulo = f"Estado en vivo ({dia_nom}, bloque **{bloque_ref['label']}**)"
        if msg_horario:
            titulo += f" — *{msg_horario}*"

    lineas = [
        f"{titulo}, se registraron **{len(vacias_ing)} salas disponibles** en la Facultad de Ingeniería (y {len(vacias_todas)} en todo el campus):\n"
    ]
    if vacias_ing:
        e441_salas = [s for s in vacias_ing if s.startswith('E441')]
        v432_salas = [s for s in vacias_ing if s.startswith('V432')]
        otras_ing = [s for s in vacias_ing if not s.startswith('E441') and not s.startswith('V432')]

        if e441_salas:
            lineas.append(f"### Edificio Ejército 441 ({len(e441_salas)} libres)")
            lineas.append(" ".join(f"`{s}`" for s in e441_salas) + "\n")
        if v432_salas:
            lineas.append(f"### Edificio Vergara 432 ({len(v432_salas)} libres)")
            lineas.append(" ".join(f"`{s}`" for s in v432_salas) + "\n")
        if otras_ing:
            lineas.append(f"### Otras dependencias Ingeniería ({len(otras_ing)} libres)")
            lineas.append(" ".join(f"`{s}`" for s in otras_ing) + "\n")
    else:
        lineas.append("*No se registran salas completamente libres en los edificios de Ingeniería para este bloque.*\n")

    otras_vacias = [s for s in vacias_todas if s not in vacias_ing]
    if otras_vacias:
        lineas.append(f"### Otras salas disponibles en el campus ({len(otras_vacias)} libres)")
        pills = " ".join(f"`{s}`" for s in otras_vacias[:18])
        lineas.append(pills)
        if len(otras_vacias) > 18:
            lineas.append(f"... y {len(otras_vacias) - 18} salas más.")
        lineas.append("")

    dia_param = dia_nom.lower() if dia_nom != "Hoy" else "hoy"
    botones = []
    if sugerir_otros_dias:
        dias_lista = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
        for d in dias_lista:
            botones.append(f"[ACCION:salas libres {d} {bloque_ref['id']}|{d.capitalize()}]")
        botones.append("[ACCION:salas libres|Ver otros horarios]")
    else:
        otros_bloques = [b for b in STANDARD_BLOCKS if b['id'] != bloque_ref['id']]
        for b in otros_bloques[:3]:
            botones.append(f"[ACCION:salas libres {dia_param} {b['id']}|{b['label'][:5]}]")
        botones.append(f"[ACCION:salas libres {dia_param}|Más horarios]")
        botones.append("[ACCION:salas libres|Elegir otro día]")

    if botones:
        lineas.append("\n" + " ".join(botones))

    return "\n".join(lineas)

def generar_respuesta_profesor(p_name, dia_id=None):
    clases_profe = buscar_profesor(p_name)
    if not clases_profe:
        return f"No encontré clases registradas para **{p_name}** en la base de datos."

    nombre_display = p_name.title()
    dias_num = sorted(list(set(c['dia_numero'] for c in clases_profe)))
    dias_nombres = [nombre_dia(d) for d in dias_num]
    cursos_unicos = sorted(list(set(format_title(c['curso']) for c in clases_profe)))

    # Si no se especificó día, preguntar para qué día quiere ver
    if dia_id is None:
        dias_texto = ", ".join(dias_nombres[:-1]) + (" y " if len(dias_nombres) > 1 else "") + dias_nombres[-1]
        cursos_texto = ", ".join(cursos_unicos[:2])
        botones = " ".join(f"[ACCION:{nombre_display} {d.lower()}|{d}]" for d in dias_nombres)
        if len(dias_nombres) > 1:
            botones += f" [ACCION:{nombre_display} toda la semana|Ver toda la semana]"

        return (
            f"Encontré al/a la docente **{nombre_display}**, quien dicta **{cursos_texto}** los días **{dias_texto}**.\n\n"
            f"¿Para qué día quieres ver su horario de clases?\n\n"
            f"{botones}"
        )

    # Si se pide toda la semana
    if dia_id == 'TODOS':
        lineas = [f"Horarios de clases de la semana para **{nombre_display}**:\n"]
        for d in dias_num:
            clases_d = [c for c in clases_profe if c['dia_numero'] == d]
            clases_d.sort(key=lambda x: to_minutes(x['hora_inicio']))
            lineas.append(f"### {nombre_dia(d)}")
            for c in clases_d:
                hora = f"{c['hora_inicio']} - {c['hora_termino']}"
                sala = f"`{c['sala']}`"
                curso = format_title(c['curso'])
                sec = f"Sec. {c['seccion']}" if c['seccion'] != '-' else ""
                lineas.append(f"* [CLASE] {hora} | {sala} | {curso} | {sec}")
            lineas.append("")
        return "\n".join(lineas)

    # Si se especificó un día en particular
    clases_dia = [c for c in clases_profe if c['dia_numero'] == dia_id]
    dia_nom = nombre_dia(dia_id)
    if not clases_dia:
        dias_texto = ", ".join(dias_nombres[:-1]) + (" y " if len(dias_nombres) > 1 else "") + dias_nombres[-1]
        botones = " ".join(f"[ACCION:{nombre_display} {d.lower()}|{d}]" for d in dias_nombres)
        return (
            f"El/la docente **{nombre_display}** no dicta clases los días **{dia_nom}**.\n\n"
            f"Sus clases se dictan los días **{dias_texto}**:\n\n"
            f"{botones}"
        )

    clases_dia.sort(key=lambda x: to_minutes(x['hora_inicio']))
    lineas = [f"Horarios de clases para **{nombre_display}** el día **{dia_nom}**:\n"]
    for c in clases_dia:
        hora = f"{c['hora_inicio']} - {c['hora_termino']}"
        sala = f"`{c['sala']}`"
        curso = format_title(c['curso'])
        sec = f"Sec. {c['seccion']}" if c['seccion'] != '-' else ""
        lineas.append(f"* [CLASE] {hora} | {sala} | {curso} | {sec}")

    otros_dias = [d for d in dias_nombres if d != dia_nom]
    if otros_dias:
        botones = " ".join(f"[ACCION:{nombre_display} {d.lower()}|Ver {d}]" for d in otros_dias)
        botones += f" [ACCION:{nombre_display} toda la semana|Ver toda la semana]"
        lineas.append(f"\n{botones}")

    return "\n".join(lineas)

def generar_respuesta_curso(c_name, dia_id=None):
    clases_curso = buscar_curso(c_name)
    if not clases_curso:
        return f"No encontré clases registradas para la asignatura **{c_name}**."

    nombre_display = format_title(c_name)
    dias_num = sorted(list(set(c['dia_numero'] for c in clases_curso)))
    dias_nombres = [nombre_dia(d) for d in dias_num]

    if dia_id is None:
        dias_texto = ", ".join(dias_nombres[:-1]) + (" y " if len(dias_nombres) > 1 else "") + dias_nombres[-1]
        botones = " ".join(f"[ACCION:{nombre_display} {d.lower()}|{d}]" for d in dias_nombres)
        if len(dias_nombres) > 1:
            botones += f" [ACCION:{nombre_display} toda la semana|Ver toda la semana]"

        return (
            f"Encontré la asignatura **{nombre_display}**, impartida los días **{dias_texto}**.\n\n"
            f"¿Para qué día quieres consultar los horarios y salas de las secciones?\n\n"
            f"{botones}"
        )

    if dia_id == 'TODOS':
        lineas = [f"Horarios y salas de la semana para **{nombre_display}**:\n"]
        for d in dias_num:
            clases_d = [c for c in clases_curso if c['dia_numero'] == d]
            clases_d.sort(key=lambda x: to_minutes(x['hora_inicio']))
            lineas.append(f"### {nombre_dia(d)}")
            for c in clases_d:
                hora = f"{c['hora_inicio']} - {c['hora_termino']}"
                sala = f"`{c['sala']}`"
                profe = c['profe'].title() if c['profe'] != 'No informado' else ""
                curso_label = f"{nombre_display} ({profe})" if profe else nombre_display
                sec = f"Sec. {c['seccion']}" if c['seccion'] != '-' else ""
                lineas.append(f"* [CLASE] {hora} | {sala} | {curso_label} | {sec}")
            lineas.append("")
        return "\n".join(lineas)

    clases_dia = [c for c in clases_curso if c['dia_numero'] == dia_id]
    dia_nom = nombre_dia(dia_id)
    if not clases_dia:
        dias_texto = ", ".join(dias_nombres[:-1]) + (" y " if len(dias_nombres) > 1 else "") + dias_nombres[-1]
        botones = " ".join(f"[ACCION:{nombre_display} {d.lower()}|{d}]" for d in dias_nombres)
        return (
            f"La asignatura **{nombre_display}** no tiene secciones los días **{dia_nom}**.\n\n"
            f"Se imparte los días **{dias_texto}**:\n\n"
            f"{botones}"
        )

    clases_dia.sort(key=lambda x: to_minutes(x['hora_inicio']))
    lineas = [f"Secciones de **{nombre_display}** para el día **{dia_nom}**:\n"]
    for c in clases_dia:
        hora = f"{c['hora_inicio']} - {c['hora_termino']}"
        sala = f"`{c['sala']}`"
        profe = c['profe'].title() if c['profe'] != 'No informado' else ""
        curso_label = f"{nombre_display} ({profe})" if profe else nombre_display
        sec = f"Sec. {c['seccion']}" if c['seccion'] != '-' else ""
        lineas.append(f"* [CLASE] {hora} | {sala} | {curso_label} | {sec}")

    otros_dias = [d for d in dias_nombres if d != dia_nom]
    if otros_dias:
        botones = " ".join(f"[ACCION:{nombre_display} {d.lower()}|Ver {d}]" for d in otros_dias)
        botones += f" [ACCION:{nombre_display} toda la semana|Ver toda la semana]"
        lineas.append(f"\n{botones}")

    return "\n".join(lineas)

def responder_con_ia(mensaje_usuario):
    api_key = get_api_key()
    if not api_key:
        return "Para activar el asistente inteligente de Disponibilidad de Salas, necesitas configurar tu API Key gratuita de Google AI Studio."

    norm_msg = normalize_str(mensaje_usuario)
    tokens_msg = clean_tokens(mensaje_usuario)
    sig_tokens = [w for w in tokens_msg if w not in STOPWORDS and len(w) >= 3]

    # 1. Saludos, Ayuda y Consultas de Inicio
    es_saludo_ayuda = any(frase in norm_msg for frase in [
        'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
        'que puedes hacer', 'como funciona', 'ayuda', 'que haces', 'opciones', 'empezar', 'inicio'
    ]) and len(sig_tokens) <= 2
    if es_saludo_ayuda:
        return (
            "¡Hola! Soy el asistente inteligente de **Disponibilidad de Salas**.\n\n"
            "Puedo ayudarte a encontrar salas libres en tiempo real, consultar los horarios y salas de tus asignaturas, "
            "revisar las clases de tus docentes y verificar el estado de cualquier espacio del campus.\n\n"
            "¿Qué te gustaría consultar?\n\n"
            "[ACCION:salas libres ahora|Salas libres ahora] "
            "[ACCION:salas libres|Salas por día/hora] "
            "[ACCION:todas las salas|Ver todas las salas] "
            "[ACCION:Rivero Rosa Elvira|Docente: Rosa Rivero] "
            "[ACCION:Calculo Diferencial e Integral|Ramo: Cálculo]"
        )

    # 2. ¿Pide listar todas las salas?
    pide_todas_salas = any(frase in norm_msg for frase in [
        'todas las salas', 'lista de salas', 'listame las salas', 'listame todas las salas',
        'que salas hay', 'cuales son las salas', 'cuales salas hay', 'todas las salas registradas',
        'cuales salas existen', 'que salas existen', 'mostrar todas las salas', 'ver todas las salas',
        'lista todas las salas'
    ])
    if pide_todas_salas:
        return generar_listado_todas_las_salas()

    # 3. Detección de día, hora y modo en vivo
    dia_detectado, dia_nombre_detectado = extraer_dia_semana(mensaje_usuario)
    bloque_detectado, hora_detectada = extraer_hora_y_bloque(mensaje_usuario)
    es_en_vivo = any(p in norm_msg for p in ['ahora', 'ahorita', 'en este momento', 'en vivo', 'actualmente', 'ya'])

    # 4. Coincidencia de sala específica por código (ej: V432.3.S315, E441.4.L.D)
    sala_especifica = buscar_sala_en_texto(mensaje_usuario)
    if sala_especifica:
        pide_estado = any(w in norm_msg for w in ['libre', 'ocupada', 'vacia', 'ahora', 'estado', 'disponible', 'desocupada'])
        if pide_estado or es_en_vivo:
            return consultar_estado_sala(sala_especifica, dia_id=dia_detectado, bloque=bloque_detectado)
        return generar_respuesta_horario_sala(sala_especifica, dia_id=dia_detectado)

    # 5. ¿Pide salas vacías / libres / disponibles? (Flujo dialógico interactivo)
    pide_salas_libres = any(w in tokens_msg for w in ['vacia', 'vacias', 'libre', 'libres', 'disponible', 'disponibles', 'desocupada', 'desocupadas']) or any(f in norm_msg for f in ['buscar sala', 'busco sala', 'salas libres', 'salas vacias', 'salas desocupadas'])
    if pide_salas_libres:
        # Caso 5.1: Consulta explícita "ahora" / "en vivo"
        if es_en_vivo:
            dia_actual, bloque_actual, en_horario, msg_horario = calcular_bloque_actual()
            dia_nom = nombre_dia(dia_actual)
            return generar_respuesta_salas_libres(dia_actual, dia_nom, bloque_actual, es_en_vivo=True, msg_horario=msg_horario)

        # Caso 5.2: NO especificó ni día ni hora -> Preguntar interactivamente con botones
        if dia_detectado is None and bloque_detectado is None:
            return (
                "¿Para qué día y horario necesitas consultar salas disponibles?\n\n"
                "Puedes consultar el estado en vivo ahora mismo o seleccionar un día de la semana:\n\n"
                "[ACCION:salas libres ahora|Ahora mismo] "
                "[ACCION:salas libres hoy|Hoy] "
                "[ACCION:salas libres lunes|Lunes] "
                "[ACCION:salas libres martes|Martes] "
                "[ACCION:salas libres miercoles|Miércoles] "
                "[ACCION:salas libres jueves|Jueves] "
                "[ACCION:salas libres viernes|Viernes] "
                "[ACCION:todas las salas|Ver todas las salas]"
            )

        # Caso 5.3: Especificó DÍA pero NO HORA -> Preguntar qué bloque de ese día
        if dia_detectado is not None and bloque_detectado is None:
            dia_param = dia_nombre_detectado.lower() if dia_nombre_detectado != "Hoy" else "hoy"
            botones = " ".join(f"[ACCION:salas libres {dia_param} {b['id']}|{b['label']}]" for b in STANDARD_BLOCKS)
            botones += f" [ACCION:salas libres|Elegir otro día]"
            return (
                f"¿En qué horario o bloque del día **{dia_nombre_detectado}** buscas salas disponibles?\n\n"
                f"Selecciona un bloque de clases:\n\n"
                f"{botones}"
            )

        # Caso 5.4: Especificó HORA pero NO DÍA -> Mostrar para Hoy con opciones para otros días
        if dia_detectado is None and bloque_detectado is not None:
            dia_actual, _, _, _ = calcular_bloque_actual()
            return generar_respuesta_salas_libres(dia_actual, "Hoy", bloque_detectado, sugerir_otros_dias=True)

        # Caso 5.5: Especificó AMBOS (Día y Hora) -> Mostrar resultado completo con botones
        return generar_respuesta_salas_libres(dia_detectado, dia_nombre_detectado, bloque_detectado)

    # 6. Detección de intenciones vs preguntas generales / conversacionales
    palabras_pregunta_general = [
        'que hora', 'la hora', 'hora es', 'hora actual', 'hora tienes', 'que dia', 'que fecha',
        'que es', 'que son', 'que significa', 'como funciona', 'como se hace', 'por que', 'porque',
        'quien fue', 'quien invento', 'donde queda', 'capital de', 'receta', 'clima', 'tiempo en',
        'cuenta un', 'cuentame', 'dime un', 'chiste', 'calcula', 'cuanto es', 'ayuda con'
    ]
    es_pregunta_general = any(p in norm_msg for p in palabras_pregunta_general) or norm_msg.startswith(('como ', 'cual ', 'cuales ', 'por que ', 'porque ', 'cuando ', 'cuanto ', 'explica ', 'explicame '))

    intencion_profesor = any(w in norm_msg for w in ['profe', 'profesor', 'profesora', 'docente', 'enseña', 'dicta', 'hace clases'])
    intencion_curso = any(w in norm_msg for w in ['ramo', 'curso', 'asignatura', 'materia', 'catedra', 'taller', 'seccion'])

    clases = dm.get_classes()
    if sig_tokens:
        # Coincidencia de profesor
        profes_map = {}
        for c in clases:
            p = c.get('node', {}).get('teacher', '')
            if p and p not in profes_map:
                profes_map[p] = [w for w in clean_tokens(p) if w not in STOPWORDS and len(w) >= 3]

        matched_profes = []
        for p_name, p_tokens in profes_map.items():
            if not p_tokens:
                continue
            matching = [
                t for t in p_tokens
                if any(t == w or (len(t) >= 4 and len(w) >= 4 and difflib.SequenceMatcher(None, t, w).ratio() >= 0.8) for w in sig_tokens)
            ]
            if matching:
                score = len(matching) / len(p_tokens)
                matched_profes.append((len(matching), score, p_name, matching))

        if matched_profes:
            matched_profes.sort(key=lambda x: (-x[0], -x[1]))
            best_match = matched_profes[0]
            # Solo asociar a profesor si hay intención explícita O no es pregunta general y tiene alta coincidencia
            es_match_prof_valido = False
            if intencion_profesor and best_match[0] >= 1:
                es_match_prof_valido = True
            elif not es_pregunta_general and not intencion_curso:
                if best_match[0] >= 2:
                    es_match_prof_valido = True
                elif len(sig_tokens) <= 2 and best_match[1] >= 0.5:
                    # Debe coincidir exactamente al menos un token de nombre (no fuzzy)
                    if any(m in sig_tokens for m in best_match[3]):
                        es_match_prof_valido = True

            if es_match_prof_valido:
                pide_donde_esta = any(f in norm_msg for f in ['donde esta', 'donde se encuentra', 'en que sala esta', 'ubicacion']) or (es_en_vivo and 'horario' not in norm_msg)
                if pide_donde_esta:
                    return consultar_docente_en_vivo(best_match[2])
                return generar_respuesta_profesor(best_match[2], dia_id=dia_detectado)

        # 7. Coincidencia de curso/asignatura
        cursos_map = {}
        for c in clases:
            cr = c.get('node', {}).get('course', '')
            if cr and cr not in cursos_map:
                cursos_map[cr] = [w for w in clean_tokens(cr) if w not in STOPWORDS and len(w) >= 3]

        matched_cursos = []
        for cr_name, cr_tokens in cursos_map.items():
            if not cr_tokens:
                continue
            matching = [
                t for t in cr_tokens
                if any(t == w or (len(t) >= 4 and len(w) >= 4 and difflib.SequenceMatcher(None, t, w).ratio() >= 0.8) for w in sig_tokens)
            ]
            if matching:
                score = len(matching) / len(cr_tokens)
                matched_cursos.append((len(matching), score, cr_name, matching))

        if matched_cursos:
            matched_cursos.sort(key=lambda x: (-x[0], -x[1]))
            best_match_cr = matched_cursos[0]
            es_match_curso_valido = False
            if intencion_curso and best_match_cr[0] >= 1:
                es_match_curso_valido = True
            elif not es_pregunta_general and not intencion_profesor:
                if best_match_cr[0] >= 2:
                    es_match_curso_valido = True
                elif len(sig_tokens) <= 2 and best_match_cr[1] >= 0.5:
                    if any(m in sig_tokens for m in best_match_cr[3]):
                        es_match_curso_valido = True

            if es_match_curso_valido:
                return generar_respuesta_curso(best_match_cr[2], dia_id=dia_detectado)

    # 8. Fallback general a la API de Gemini para consultas abiertas, hora en vivo y conocimiento general
    now_chile = get_chile_now()
    hora_actual_str = now_chile.strftime("%H:%M:%S")
    dia_num_actual = now_chile.weekday() + 1
    dia_nom_actual = DIAS_SEMANA.get(dia_num_actual, "Desconocido")
    mes_nom_actual = MESES_ES.get(now_chile.month, "")
    fecha_actual_str = f"{dia_nom_actual}, {now_chile.day} de {mes_nom_actual} de {now_chile.year}"

    dia_bloque, bloque_ref, en_horario, msg_horario = calcular_bloque_actual(now_chile)
    vacias_ref, _, _ = obtener_salas(dia_bloque, bloque_ref['id'], "INGENIERIA")

    contexto_datos = (
        f"HORA Y FECHA EN TIEMPO REAL (Santiago de Chile):\n"
        f"- Hora actual exacta de Chile: {hora_actual_str}\n"
        f"- Fecha de hoy: {fecha_actual_str}\n"
        f"- Bloque horario académico actual: {bloque_ref['label']} ({msg_horario or 'En horario lectivo'}).\n"
        f"- Salas libres en campus ahora: {len(vacias_ref)} salas disponibles en Ingeniería.\n"
        f"- Total salas registradas: {len(dm.all_rooms)} salas.\n"
        f"Día consultado o detectado: {nombre_dia(dia_detectado) if dia_detectado and dia_detectado != 'TODOS' else dia_nom_actual}\n"
    )

    prompt_sistema = (
        "Eres el asistente inteligente de 'Disponibilidad de Salas', y además un asistente general versátil, amable y culto.\n"
        "Directrices de respuesta:\n"
        "1. VERSATILIDAD Y AMPLITUD: Si el usuario te pregunta por la hora, fecha, dudas de asignaturas, programación, ciencias, matemáticas, cultura general, o cualquier tema no relacionado a las salas, RESPONDE DE FORMA DIRECTA, EXACTA Y ÚTIL a lo que preguntó. No restrinjas tu respuesta ni intentes forzar temas de salas si la pregunta no viene al caso.\n"
        "2. HORA Y FECHA EXACTA: Tienes la hora y fecha actual exacta de Santiago de Chile en el contexto ('HORA Y FECHA EN TIEMPO REAL'). Si el usuario te pregunta qué hora es, qué día es hoy o la fecha, responde con esa información exacta con total seguridad.\n"
        "3. DISPONIBILIDAD DE SALAS Y DOCENCIA: Si la pregunta sí trata sobre disponibilidad de salas, horarios, docentes o asignaturas, responde con precisión usando la información del sistema. NUNCA menciones la sigla 'UDP' ni 'Universidad Diego Portales'; refiérete únicamente como 'Disponibilidad de Salas'.\n"
        "4. DIRECTO AL GRANO: Responde de forma clara y concisa, sin saludos largos ni introducciones innecesarias.\n"
        "5. FORMATO DE CLASES Y RAMOS: Cuando listes clases o asignaturas, usa SIEMPRE este formato:\n"
        "* [CLASE] HH:MM - HH:MM | `CODIGO_SALA` | Nombre del Curso | Sec. X\n"
        "6. LENGUAJE NATURAL: NUNCA inventes comandos internos, ni uses la palabra 'ACCION:' ni 'consulta a enviar'. Responde en lenguaje natural fluido.\n"
        "7. FÓRMULAS MATEMÁTICAS Y CIENCIAS: La interfaz cuenta con renderizador KaTeX (LaTeX). Para fórmulas matemáticas, usa SIEMPRE notación LaTeX estándar con $$...$$ para fórmulas en bloque y $...$ para variables o expresiones en línea (por ejemplo: $x$, $f(x)$, $$\\int_{a}^{b} f(x)\\,dx$$, $$\\frac{df}{dx}$$).\n"
        "8. Proporciona EXCLUSIVAMENTE la respuesta final redactada para el usuario, sin notas de verificación interna ni etiquetas como <thought>."
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": f"{prompt_sistema}\n\n{contexto_datos}\n\nPREGUNTA DEL USUARIO:\n{mensaje_usuario}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048
        }
    }

    modelos = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.7-flash"]
    ultimo_error = ""
    for modelo in modelos:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={api_key}"
            req = Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
            with urlopen(req, timeout=18) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                parts = res_data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
                text_parts = []
                for p in parts:
                    if not p.get('thought', False) and 'text' in p:
                        text_parts.append(p['text'])
                texto_respuesta = "".join(text_parts).strip()
                if texto_respuesta:
                    texto_respuesta = re.sub(r'<thought>.*?</thought>', '', texto_respuesta, flags=re.DOTALL).strip()
                    # Sanitización exhaustiva contra residuos de placeholders o comandos internos
                    texto_respuesta = re.sub(r'\[\s*(?:ACCION|ACCIÓN)\s*:[^\]]*consulta a enviar[^\]]*\]', '', texto_respuesta, flags=re.IGNORECASE)
                    texto_respuesta = re.sub(r'(?:ACCION|ACCIÓN)\s*:\s*consulta a enviar[^\n]*', '', texto_respuesta, flags=re.IGNORECASE)
                    texto_respuesta = re.sub(r'consulta a enviar', '', texto_respuesta, flags=re.IGNORECASE)
                    return texto_respuesta.strip()
        except Exception as e:
            ultimo_error = str(e)
            continue

    return f"No fue posible conectar con la API de IA en este momento ({ultimo_error}). Por favor verifica tu API Key o conexión."

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json() or {}
    mensaje = data.get("mensaje", "").strip()
    if not mensaje:
        return jsonify({"respuesta": "Por favor escribe una consulta o pregunta."})

    respuesta = responder_con_ia(mensaje)
    return jsonify({"respuesta": respuesta})

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)