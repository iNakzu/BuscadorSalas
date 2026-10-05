import base64
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from app import create_app
from app.services.push_notifications import (
    CHILE, _send_push, get_preferences, save_subscription,
    deliver_due, set_preferences, sync_reminders,
)


def b64url(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


class PushNotificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.temp.name) / "push.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_rejects_non_push_hosts(self):
        subscription = {
            "endpoint": "https://attacker.example/fcm/send",
            "keys": {"p256dh": b64url(b"p" * 65), "auth": b64url(b"a" * 16)},
        }
        with self.assertRaises(ValueError):
            save_subscription(self.db, "user-a", subscription)

    @patch("app.services.push_notifications.webpush")
    def test_push_sender_passes_the_protected_pem_path(self, webpush_mock):
        result = _send_push("https://fcm.googleapis.com/fcm/send/token", "p", "a", "{}",
                            "/etc/buscadorsalas/vapid_private.pem", "https://horarios.dev/")
        self.assertEqual(result, "sent")
        self.assertEqual(webpush_mock.call_args.kwargs["vapid_private_key"], "/etc/buscadorsalas/vapid_private.pem")
        self.assertEqual(webpush_mock.call_args.kwargs["headers"], {"Urgency": "high"})

    def test_preferences_require_registered_device(self):
        with self.assertRaises(RuntimeError):
            set_preferences(self.db, "user-a", True, False)

    def test_notification_test_endpoint_is_removed(self):
        client = create_app({"TESTING": True}).test_client()
        response = client.post("/api/push/test", json={})
        self.assertEqual(response.status_code, 404)

    def test_sync_keeps_only_class_times_and_agenda_dates(self):
        sync_reminders(self.db, "user-a", [
            {"day": 1, "time": "08:30", "course": "PRIVATE COURSE NAME"},
            {"day": 8, "time": "08:30"},
            {"day": 2, "time": "bad"},
        ], [
            {"key": "event-1", "date": (datetime.now(CHILE).date() + timedelta(days=2)).isoformat(),
             "time": "12:15", "hasTime": True, "completed": False, "notes": "private notes"},
            {"key": "far-future", "date": "2099-01-01", "time": "12:15", "hasTime": True, "completed": False},
        ])
        import sqlite3
        with sqlite3.connect(self.db) as db:
            classes = db.execute("SELECT day,class_time FROM push_classes WHERE user_id=?", ("user-a",)).fetchall()
            agenda = db.execute("SELECT event_key,event_at FROM push_agenda WHERE user_id=?", ("user-a",)).fetchall()
            class_columns = [row[1] for row in db.execute("PRAGMA table_info(push_classes)")]
            agenda_columns = [row[1] for row in db.execute("PRAGMA table_info(push_agenda)")]
        self.assertEqual(classes, [(1, "08:30")])
        self.assertEqual(len(agenda), 1)
        self.assertEqual(len(agenda[0][0]), 64)  # Only a one-way event identifier is persisted.
        self.assertEqual(class_columns, ["user_id", "day", "class_time"])
        self.assertEqual(agenda_columns, ["user_id", "event_key", "event_at"])

    @patch("app.blueprints.push_api.requests.get")
    def test_api_derives_user_from_validated_supabase_token(self, auth_get):
        class AuthResponse:
            ok = True
            def json(self):
                return {"id": "trusted-user-id"}

        auth_get.return_value = AuthResponse()
        app = create_app({"TESTING": True, "SUPABASE_URL": "https://example.supabase.co",
                          "SUPABASE_ANON_KEY": "public", "PUSH_DB_PATH": self.db,
                          "PUSH_VAPID_PUBLIC_KEY": "public-key"})
        client = app.test_client()
        self.assertEqual(client.get("/api/push/subscribe").status_code, 401)
        response = client.get("/api/push/subscribe", headers={"Authorization": "Bearer valid-token"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["subscribed"], False)
        auth_get.assert_called_once()


if __name__ == "__main__":
    unittest.main()
