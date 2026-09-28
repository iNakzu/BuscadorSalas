from flask import Blueprint, jsonify, request

from app.services.schedule import (
    DIAS_SEMANA, MESES_ES, MALLA_ICIT, calcular_bloque_actual, dm,
    format_time, get_chile_now, horario_de_sala, nombre_dia, normalize_str,
    obtener_clases_malla, obtener_salas, buscar_curso, buscar_profesor, asignaciones_sala_seccion,
)

academic_api = Blueprint("academic_api", __name__)

@academic_api.route("/status", methods=["GET"])
def api_status():
    return jsonify(dm.get_status())

@academic_api.route("/sync", methods=["POST", "GET"])
def api_sync():
    ok = dm.sync_from_remote()
    return jsonify({
        "success": ok,
        "message": "Datos sincronizados exitosamente desde salas.docencia-eit.cl" if ok else "No se pudo sincronizar; usando respaldo local.",
        "status": dm.get_status()
    })

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
    data = request.get_json() or {}
    horario_usuario = data.get("clases", [])
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
