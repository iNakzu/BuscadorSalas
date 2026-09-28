from flask import Blueprint, current_app, render_template

from app.services.schedule import STANDARD_BLOCKS, dm, obtener_salas

web = Blueprint("web", __name__)


@web.get("/")
def index():
    selected = {"dia": "1", "hora": "8:30:00", "facultad": "INGENIERIA", "profe": ""}
    free, occupied, free_info = obtener_salas(selected["dia"], selected["hora"], selected["facultad"])
    return render_template(
        "index.html",
        vacias=free,
        ocupadas=occupied,
        vacias_info=free_info,
        resultados_profe=[],
        busqueda_realizada=True,
        sel=selected,
        modo="salas",
        bloques=STANDARD_BLOCKS,
        status=dm.get_status(),
        solemne_status=getattr(dm, "solemne_days", {}),
        todas_las_salas=dm.all_rooms,
        client_config={
            "supabaseUrl": current_app.config["SUPABASE_URL"],
            "supabaseAnonKey": current_app.config["SUPABASE_ANON_KEY"],
            "publicOrigin": current_app.config["PUBLIC_ORIGIN"],
        },
    )


@web.get("/sw.js")
def service_worker():
    return current_app.send_static_file("sw.js")


@web.get("/manifest.json")
def manifest():
    return current_app.send_static_file("manifest.json")
