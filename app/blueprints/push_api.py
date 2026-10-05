import requests
from flask import Blueprint, current_app, jsonify, request

from app.services.push_notifications import (
    get_preferences, remove_subscription, save_subscription,
    set_preferences, sync_reminders,
)

push_api = Blueprint("push_api", __name__)


@push_api.before_request
def limit_push_payload_size():
    if request.content_length is not None and request.content_length > 256 * 1024:
        return jsonify({"error": "La solicitud supera el tamaño permitido."}), 413


def _user_id():
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    url = current_app.config.get("SUPABASE_URL", "").rstrip("/")
    key = current_app.config.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        return None
    try:
        response = requests.get(f"{url}/auth/v1/user", headers={
            "apikey": key, "Authorization": f"Bearer {token.strip()}"
        }, timeout=(4, 8))
        if not response.ok:
            return None
        data = response.json()
        return str(data["id"]) if isinstance(data, dict) and data.get("id") else None
    except (requests.RequestException, ValueError, KeyError):
        return None


def _db_path():
    return current_app.config["PUSH_DB_PATH"]


@push_api.get("/config")
def config():
    return jsonify({"publicKey": current_app.config.get("PUSH_VAPID_PUBLIC_KEY", ""),
                    "supported": bool(current_app.config.get("PUSH_VAPID_PUBLIC_KEY"))})


@push_api.route("/subscribe", methods=["GET", "POST", "DELETE"])
def subscribe():
    user_id = _user_id()
    if not user_id:
        return jsonify({"error": "Inicia sesión para configurar notificaciones."}), 401
    if request.method == "GET":
        return jsonify(get_preferences(_db_path(), user_id))
    if request.method == "DELETE":
        payload = request.get_json(silent=True) or {}
        endpoint = payload.get("endpoint") if isinstance(payload, dict) else None
        if endpoint is not None and (not isinstance(endpoint, str) or len(endpoint) > 2048):
            return jsonify({"error": "Solicitud inválida."}), 400
        remove_subscription(_db_path(), user_id, endpoint)
        return jsonify({"success": True})
    payload = request.get_json(silent=True)
    try:
        if not isinstance(payload, dict):
            raise ValueError("invalid subscription")
        save_subscription(_db_path(), user_id, payload.get("subscription"))
    except OverflowError:
        return jsonify({"error": "Este perfil ya tiene el máximo de dispositivos registrados."}), 409
    except (ValueError, TypeError):
        return jsonify({"error": "No se pudo registrar este dispositivo."}), 400
    return jsonify({"success": True})


@push_api.patch("/settings")
def settings():
    user_id = _user_id()
    if not user_id:
        return jsonify({"error": "Inicia sesión para configurar notificaciones."}), 401
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("classes"), bool) or not isinstance(payload.get("agenda"), bool):
        return jsonify({"error": "Preferencias inválidas."}), 400
    try:
        set_preferences(_db_path(), user_id, payload["classes"], payload["agenda"])
    except RuntimeError:
        return jsonify({"error": "Activa las notificaciones en este dispositivo primero."}), 409
    return jsonify({"success": True})


@push_api.put("/schedule")
def sync_schedule():
    user_id = _user_id()
    if not user_id:
        return jsonify({"error": "Inicia sesión para sincronizar tus avisos."}), 401
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Datos inválidos."}), 400
    try:
        sync_reminders(_db_path(), user_id, payload.get("classes"), payload.get("agenda"))
    except ValueError:
        return jsonify({"error": "Los datos de recordatorios no son válidos."}), 400
    return jsonify({"success": True})
