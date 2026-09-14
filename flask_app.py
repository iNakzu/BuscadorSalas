import os
import json
import time
import datetime
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
                self.last_synced = datetime.datetime.fromtimestamp(os.path.getmtime(LOCAL_DATA_FILE)).strftime("%d/%m/%Y %H:%M:%S")
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
                self.last_synced = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
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

    now = datetime.datetime.now()
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
    busqueda = normalize_str(nombre_buscado)
    if not busqueda:
        return []

    dia_int = None
    if dia_filtro and str(dia_filtro).strip().isdigit():
        d_val = int(dia_filtro)
        if 1 <= d_val <= 7:
            dia_int = d_val

    for clase in clases:
        nodo = clase.get('node', {})
        profe = nodo.get('teacher', "")
        if busqueda in normalize_str(profe):
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
    q = normalize_str(query)
    if not q:
        return []

    dia_int = None
    if dia_filtro:
        d_str = str(dia_filtro).strip().lower()
        if d_str == 'hoy':
            now = datetime.datetime.now()
            d_val = now.weekday() + 1
            dia_int = d_val if d_val <= 5 else 1
        elif d_str.isdigit() and 1 <= int(d_str) <= 7:
            dia_int = int(d_str)

    for clase in clases:
        nodo = clase.get('node', {})
        curso = nodo.get('course', "")
        codigo = nodo.get('code', "")
        if q in normalize_str(curso) or q in normalize_str(codigo):
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
            now = datetime.datetime.now()
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

def calcular_bloque_actual():
    """Determina el día y bloque correspondiente a la hora local actual de Chile."""
    now = datetime.datetime.now()
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
    dia_actual, bloque_actual, en_horario_valido, mensaje_horario = calcular_bloque_actual()
    vacias, ocupadas, vacias_info = obtener_salas(dia_actual, bloque_actual['id'], facultad)
    
    return jsonify({
        "dia": dia_actual,
        "dia_nombre": nombre_dia(dia_actual),
        "bloque": bloque_actual,
        "en_horario_valido": en_horario_valido,
        "mensaje_horario": mensaje_horario,
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
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GEMINI_API_KEY="):
                            key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
            except Exception:
                pass
    return key

def responder_con_ia(mensaje_usuario):
    api_key = get_api_key()
    if not api_key:
        return (
            "⚠️ **API Key no configurada**\n\n"
            "Para activar el asistente inteligente de **Disponibilidad de Salas**, necesitas configurar tu API Key gratuita de Google AI Studio.\n\n"
            "**Cómo obtenerla y configurarla:**\n"
            "1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey) e inicia sesión con tu cuenta de Google.\n"
            "2. Haz clic en **Create API key** y copia la clave generada.\n"
            "3. En tu terminal (PowerShell), ejecútala antes de iniciar la app:\n"
            "```powershell\n"
            "$env:GEMINI_API_KEY=\"AIzaSy...\"\n"
            "python flask_app.py\n"
            "```\n"
            "O guárdala en un archivo `.env` en la raíz del proyecto:\n"
            "```text\n"
            "GEMINI_API_KEY=AIzaSy...\n"
            "```"
        )

    # Recopilar contexto en tiempo real
    dia_actual, bloque_actual, en_horario, msg_horario = calcular_bloque_actual()
    info_ahora = f"Día actual: {nombre_dia(dia_actual)} (id {dia_actual}), Bloque: {bloque_actual['label']}. Estado: {msg_horario or 'En horario lectivo'}."
    
    # Extraer entidades consultadas
    palabras = [p for p in mensaje_usuario.split() if len(p) >= 3]
    coincidencias_profes = []
    coincidencias_cursos = []
    coincidencias_salas = []
    
    for p in palabras:
        norm_p = normalize_str(p)
        for sala in dm.all_rooms:
            if norm_p in normalize_str(sala) and sala not in coincidencias_salas:
                coincidencias_salas.append(sala)
        for pr in buscar_profesor(p)[:5]:
            if pr not in coincidencias_profes:
                coincidencias_profes.append(pr)
        for cr in buscar_curso(p)[:5]:
            if cr not in coincidencias_cursos:
                coincidencias_cursos.append(cr)
    
    vacias_ahora, _, _ = obtener_salas(dia_actual, bloque_actual['id'], "INGENIERIA")
    resumen_salas_libres = f"Salas libres en el bloque actual ({bloque_actual['label']}): {', '.join(vacias_ahora[:15])} (Total libres: {len(vacias_ahora)})."
    
    contexto_datos = (
        f"ESTADO ACTUAL:\n- {info_ahora}\n- {resumen_salas_libres}\n\n"
        f"RESULTADOS RELEVANTES DE LA BASE DE DATOS:\n"
        f"- Profesores encontrados: {json.dumps(coincidencias_profes[:8], ensure_ascii=False)}\n"
        f"- Asignaturas encontradas: {json.dumps(coincidencias_cursos[:8], ensure_ascii=False)}\n"
        f"- Horario de salas mencionadas: {json.dumps({s: horario_de_sala(s) for s in coincidencias_salas[:2]}, ensure_ascii=False)}\n"
    )

    prompt_sistema = (
        "Eres el asistente virtual inteligente de Disponibilidad de Salas.\n"
        "Tu misión es ayudar a estudiantes, profesores y visitantes a encontrar salas disponibles, verificar horarios de clases, ubicar a profesores y consultar información de asignaturas.\n\n"
        "Reglas fundamentales:\n"
        "1. NUNCA menciones la sigla UDP ni 'Universidad Diego Portales', refiérete al sistema únicamente como 'Disponibilidad de Salas'.\n"
        "2. Sé conciso, claro, estructurado y muy amable. Usa viñetas y formato Markdown (negritas, listas, tablas si corresponde).\n"
        "3. Basa tus respuestas en los datos provistos en el contexto en tiempo real. Si no hay clases o datos para lo solicitado, dilo cordialmente.\n"
        "4. Especifica siempre sala, día, bloque horario y docente cuando la información esté disponible."
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
            "temperature": 0.3,
            "maxOutputTokens": 1000
        }
    }

    # Intentar con gemini-3.6-flash, gemini-2.0-flash y gemini-1.5-flash
    modelos = ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"]
    ultimo_error = ""
    for modelo in modelos:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={api_key}"
            req = Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
            with urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                texto_respuesta = res_data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                if texto_respuesta:
                    return texto_respuesta
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