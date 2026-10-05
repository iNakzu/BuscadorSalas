import os

from flask import Flask, request, url_for

from .blueprints.academic_api import academic_api
from .blueprints.push_api import push_api
from .blueprints.web import web


def create_app(test_config=None):
    app = Flask(
        __name__,
        instance_relative_config=True,
        template_folder="../templates",
        static_folder="../static",
        static_url_path="/static",
    )
    app.config.from_mapping(
        # No Flask sessions are used. Leave signing disabled unless a strong,
        # persistent key is explicitly configured; never fall back to a public key.
        SECRET_KEY=os.getenv("SECRET_KEY") or None,
        SUPABASE_URL=os.getenv("SUPABASE_URL", ""),
        SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY", ""),
        PUBLIC_ORIGIN=os.getenv("PUBLIC_ORIGIN", "https://horarios.dev"),
        GEMINI_API_KEY=os.getenv("GEMINI_API_KEY", ""),
        GEMINI_MODEL=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        PUSH_DB_PATH=os.getenv("PUSH_DB_PATH", os.path.join(app.instance_path, "push_notifications.sqlite3")),
        PUSH_VAPID_PRIVATE_KEY_FILE=os.getenv("PUSH_VAPID_PRIVATE_KEY_FILE", ""),
        PUSH_VAPID_PUBLIC_KEY=os.getenv("PUSH_VAPID_PUBLIC_KEY", ""),
        PUSH_VAPID_SUBJECT=os.getenv("PUSH_VAPID_SUBJECT", "https://horarios.dev"),
        RATE_LIMIT_DB=os.getenv("RATE_LIMIT_DB", os.path.join(app.instance_path, "rate_limits.sqlite3")),
        MAX_CONTENT_LENGTH=12 * 1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)

    app.register_blueprint(web)
    app.register_blueprint(academic_api, url_prefix="/api")
    app.register_blueprint(push_api, url_prefix="/api/push")

    @app.context_processor
    def asset_helpers():
        def dated_url_for(endpoint, **values):
            if endpoint == "static" and values.get("filename"):
                path = os.path.join(app.static_folder, values["filename"])
                if os.path.isfile(path):
                    values["v"] = int(os.stat(path).st_mtime)
            return url_for(endpoint, **values)

        return {"url_for": dated_url_for}

    @app.after_request
    def security_headers(response):
        if request.path == "/" or request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response

    return app
