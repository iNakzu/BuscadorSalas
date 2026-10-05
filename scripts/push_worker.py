"""Standalone one-shot worker; loading the Flask app here would sync its data manager."""
import importlib.util
import logging
import os
from pathlib import Path


service_path = Path(__file__).resolve().parents[1] / "app" / "services" / "push_notifications.py"
spec = importlib.util.spec_from_file_location("portal_push_notifications", service_path)
push = importlib.util.module_from_spec(spec)
spec.loader.exec_module(push)


def main():
    try:
        push.deliver_due(
            os.environ["PUSH_DB_PATH"],
            os.environ["PUSH_VAPID_PRIVATE_KEY_FILE"],
            os.environ["PUSH_VAPID_PUBLIC_KEY"],
            os.environ.get("PUSH_VAPID_SUBJECT", "https://horarios.dev"),
        )
    except Exception:
        logging.exception("Push delivery run failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
