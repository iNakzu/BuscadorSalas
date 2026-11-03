import logging
import os

from app.services.push_notifications import deliver_due


def main():
    try:
        deliver_due(
            os.environ["PUSH_DB_PATH"],
            os.environ["PUSH_VAPID_PRIVATE_KEY_FILE"],
            os.environ["PUSH_VAPID_PUBLIC_KEY"],
            os.environ.get("PUSH_VAPID_SUBJECT", "https://horarios.dev/"),
        )
    except Exception:
        # A later timer run retries transient database/network failures.
        logging.exception("Push delivery run failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
