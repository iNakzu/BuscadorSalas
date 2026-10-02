import hashlib
import os
import sqlite3
import time

import requests
from flask import Blueprint, current_app, jsonify, request

from app.services.gemini_schedule import GeminiScheduleError, extract_schedule_from_image

from app.services.schedule import (
    DIAS_SEMANA, MESES_ES, MALLA_ICIT, calcular_bloque_actual, dm,
    format_time, get_chile_now, horario_de_sala, nombre_dia, normalize_str,
    obtener_clases_malla, obtener_salas, buscar_curso, buscar_profesor, asignaciones_sala_seccion,
)

academic_api = Blueprint("academic_api", __name__)

_IMPORT_RATE_LIMIT = 4
_IMPORT_RATE_WINDOW_SECONDS = 60
_SYNC_COOLDOWN_SECONDS = 20


def _consume_rate_limit(scope, actor, limit, window_seconds):
    """Atomically share API limits across Gunicorn workers and restarts."""
    database = current_app.config["RATE_LIMIT_DB"]
    os.makedirs(os.path.dirname(database) or ".", mode=0o700, exist_ok=True)
    actor_hash = hashlib.sha256(str(actor).encode("utf-8")).hexdigest()
    now = time.time()
    with sqlite3.connect(database, timeout=5) as connection:
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute(
            "CREATE TABLE IF NOT EXISTS api_rate_limit_events ("
            "scope TEXT NOT NULL, actor_hash TEXT NOT NULL, occurred_at REAL NOT NULL)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS api_rate_limit_lookup "
            "ON api_rate_limit_events(scope, actor_hash, occurred_at)"
        )
        connection.execute("BEGIN IMMEDIATE")
        connection.execute("DELETE FROM api_rate_limit_events WHERE occurred_at < ?", (now - 3600,))
        recent = connection.execute(
            "SELECT occurred_at FROM api_rate_limit_events "
            "WHERE scope = ? AND actor_hash = ? AND occurred_at >= ? ORDER BY occurred_at",
            (scope, actor_hash, now - window_seconds),
        ).fetchall()
        if len(recent) >= limit:
            retry_after = max(1, int(window_seconds - (now - recent[0][0]) + 0.999))
            connection.commit()
            return False, retry_after
        connection.execute(
            "INSERT INTO api_rate_limit_events(scope, actor_hash, occurred_at) VALUES (?, ?, ?)",
            (scope, actor_hash, now),
        )
        connection.commit()
        os.chmod(database, 0o600)
        return True, 0


def _valid_image_signature(data, mime_type):
    if mime_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if mime_type in ("image/heic", "image/heif"):
        return len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in {
            b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1",
        }
    return False


def _allow_schedule_import(user_id):
    allowed, _ = _consume_rate_limit("schedule-import", user_id, _IMPORT_RATE_LIMIT, _IMPORT_RATE_WINDOW_SECONDS)
    return allowed

@academic_api.route("/status", methods=["GET"])
def api_status():
    return jsonify(dm.get_status())

@academic_api.route("/sync", methods=["POST"])
def api_sync():
    try:
        allowed, wait_seconds = _consume_rate_limit("schedule-sync", "global", 1, _SYNC_COOLDOWN_SECONDS)
    except (OSError, sqlite3.Error):
        current_app.logger.exception("Rate-limit storage is unavailable")
        return jsonify({"success": False, "message": "No se pudo validar el límite de solicitudes."}), 503
    if not allowed:
        response = jsonify({"success": False, "message": "Espera unos segundos antes de volver a sincronizar."})
        response.status_code = 429
        response.headers["Retry-After"] = str(wait_seconds)
        return response
    ok = dm.sync_from_remote()
    return jsonify({
        "success": ok,
        "message": "Datos sincronizados exitosamente desde salas.docencia-eit.cl" if ok else "No se pudo sincronizar; usando respaldo local.",
        "status": dm.get_status()
    })


@academic_api.route("/import_schedule", methods=["POST"])
def api_import_schedule():
    authorization = request.headers.get("Authorization", "")
    scheme, _, access_token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not access_token.strip():
        return jsonify({"error": "Inicia sesión para importar tu horario."}), 401

    supabase_url = current_app.config.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = current_app.config.get("SUPABASE_ANON_KEY", "")
    if not supabase_url or not supabase_key:
        return jsonify({"error": "El acceso personal no está configurado en el servidor."}), 503
    try:
        auth_response = requests.get(
            f"{supabase_url}/auth/v1/user",
            headers={"apikey": supabase_key, "Authorization": f"Bearer {access_token.strip()}"},
            timeout=(4, 8),
        )
    except requests.RequestException:
        return jsonify({"error": "No pude validar tu sesión. Inténtalo de nuevo."}), 503
    if not auth_response.ok:
        return jsonify({"error": "Tu sesión venció. Inicia sesión de nuevo."}), 401
    try:
        user = auth_response.json()
    except ValueError:
        return jsonify({"error": "No pude validar tu sesión. Inicia sesión de nuevo."}), 401
    user_id = user.get("id") if isinstance(user, dict) else None
    if not user_id:
        return jsonify({"error": "No pude validar tu sesión. Inicia sesión de nuevo."}), 401
    try:
        import_allowed = _allow_schedule_import(str(user_id))
    except (OSError, sqlite3.Error):
        current_app.logger.exception("Rate-limit storage is unavailable")
        return jsonify({"error": "No se pudo validar el límite de importaciones."}), 503
    if not import_allowed:
        return jsonify({"error": "Has realizado varias importaciones. Espera un minuto y prueba de nuevo."}), 429

    image = request.files.get("image")
    if not image or not image.filename:
        return jsonify({"error": "Selecciona una imagen de tu horario."}), 400
    mime_type = (image.mimetype or "").lower()
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
    if mime_type not in allowed_types:
        return jsonify({"error": "Usa una foto JPG, PNG, WebP o HEIC."}), 415
    image_bytes = image.stream.read(9 * 1024 * 1024 + 1)
    if len(image_bytes) > 9 * 1024 * 1024:
        return jsonify({"error": "La imagen supera el límite de 9 MB."}), 413
    if not _valid_image_signature(image_bytes, mime_type):
        return jsonify({"error": "El archivo no parece ser una imagen válida. Vuelve a seleccionarla."}), 415
    if not current_app.config.get("GEMINI_API_KEY"):
        return jsonify({"error": "La importación con IA no está configurada en este servidor."}), 503

    try:
        classes = extract_schedule_from_image(
            image_bytes,
            mime_type,
            current_app.config["GEMINI_API_KEY"],
            current_app.config.get("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        )
    except GeminiScheduleError as error:
        return jsonify({"error": str(error)}), error.status_code

    # Images are processed in memory and are never persisted by this endpoint.
    return jsonify({"clases": classes, "total": len(classes)})

@academic_api.route("/salas", methods=["GET"])
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


@academic_api.route("/sync_horario", methods=["POST"])
def api_sync_horario():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "El formato del horario no es válido."}), 400
    horario_usuario = data.get("clases", [])
    if not isinstance(horario_usuario, list) or any(not isinstance(item, dict) for item in horario_usuario):
        return jsonify({"error": "La lista de clases no es válida."}), 400
    if len(horario_usuario) > 100:
        return jsonify({"error": "El horario supera el máximo permitido de 100 clases."}), 413
    if not horario_usuario:
        return jsonify([])
        
    clases_reales = dm.get_classes()
    resultados = []
    
    import re as re_local
    
    for c_user in horario_usuario:
        # El usuario nos manda el curso y la seccion
        # Tratamos de hacer match
        curso_q = normalize_str(c_user.get('curso', ''))
        sec_q = str(c_user.get('seccion', '')).lower().replace('sección', '').replace('sec', '').strip()
        dia_user = c_user.get('dia')
        hora_user = str(c_user.get('horaInicio', '')).strip()
        
        matched_node = None
        
        for c in clases_reales:
            n = c.get('node', {})
            # Match de dia
            if dia_user and n.get('day') != dia_user:
                continue
                
            # Match de hora
            c_start = format_time(n.get('start', ''))
            if hora_user and not (hora_user.startswith(c_start) or c_start.startswith(hora_user.replace(":00", "")) or hora_user in n.get('start', '')):
                continue
                
            # Match de curso
            curso_n = normalize_str(n.get('course', ''))
            if curso_q not in curso_n:
                continue
                
            # Match de seccion
            sec_n = str(n.get('section', '')).lower()
            sections_n = [s.strip() for s in re_local.split(r'[,/]', sec_n)] if sec_n else []
            if sec_q and sec_q not in sections_n and sec_q != sec_n:
                # Si no hace match exacto, puede que sea ayudantia sin seccion clara, pero el dia y hora ya mandan
                # Para estar seguros, si tiene seccion preferimos que haga match
                pass
                
            matched_node = n
            break
            
        if matched_node:
            c_user['sala'] = matched_node.get('place', '-')
            c_user['profesor'] = matched_node.get('teacher', '')
            c_user['horaInicio'] = format_time(matched_node.get('start', ''))
            c_user['horaFin'] = format_time(matched_node.get('finish', ''))
            
        resultados.append(c_user)
        
    return jsonify(resultados)

@academic_api.route("/ahora", methods=["GET"])
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
        "hora_actual": now_chile.strftime("%H:%M"),
        "fecha_chile": f"{DIAS_SEMANA.get(dia_actual, '')} {now_chile.day} de {MESES_ES.get(now_chile.month, '')} de {now_chile.year}",
        "facultad": facultad,
        "total_libres": len(vacias),
        "total_ocupadas": len(ocupadas),
        "vacias": vacias,
        "vacias_info": vacias_info,
        "ocupadas": ocupadas
    })

@academic_api.route("/search", methods=["GET"])
def api_search():
    q = request.args.get("q", "").strip()
    dia = request.args.get("dia", "").strip()
    hora = request.args.get("hora", "").strip()
    if not q and not (dia and hora):
        return jsonify({"query": q, "dia": dia, "hora": hora, "profesores": [], "cursos": [], "salas": []})

    profes = buscar_profesor(q, dia_filtro=dia, hora_filtro=hora) if q and len(q) >= 2 else []
    cursos = buscar_curso(q, dia_filtro=dia, hora_filtro=hora)
    salas_coincidentes = [s for s in dm.all_rooms if normalize_str(q) in normalize_str(s)] if q and len(q) >= 2 else []

    return jsonify({
        "query": q,
        "dia": dia,
        "hora": hora,
        "profesores": profes[:50],
        "cursos": cursos[:60],
        "ramos": cursos[:60],
        "salas": salas_coincidentes[:25]
    })


@academic_api.route("/sala/<nombre_sala>", methods=["GET"])
def api_horario_sala(nombre_sala):
    horario = horario_de_sala(nombre_sala)
    return jsonify({
        "sala": nombre_sala.upper(),
        "horario": horario
    })

@academic_api.route("/malla", methods=["GET"])
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


@academic_api.get("/solemnes_status")
def api_solemnes_status():
    return jsonify(getattr(dm, "solemne_days", {}))
