import base64
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
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

    def test_new_device_has_class_and_agenda_notifications_enabled_by_default(self):
        subscription = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-token",
            "keys": {"p256dh": b64url(b"p" * 65), "auth": b64url(b"a" * 16)},
        }
        save_subscription(self.db, "user-a", subscription)
        self.assertEqual(get_preferences(self.db, "user-a"), {
            "classes": True, "agenda": True, "subscribed": True,
        })

    def test_notification_test_endpoint_is_removed(self):
        client = create_app({"TESTING": True}).test_client()
        response = client.post("/api/push/test", json={})
        self.assertEqual(response.status_code, 404)

    def test_sync_keeps_class_names_and_times_and_agenda_dates(self):
        import sqlite3
        # Existing installations have the original start-only schema; sync must migrate it.
        with sqlite3.connect(self.db) as db:
            db.execute("CREATE TABLE push_classes (user_id TEXT NOT NULL, day INTEGER NOT NULL, class_time TEXT NOT NULL, PRIMARY KEY(user_id, day, class_time))")
        sync_reminders(self.db, "user-a", [
            {"day": 1, "time": "08:30", "finish": "09:50", "course": "PRIVATE COURSE NAME"},
            {"day": 8, "time": "08:30"},
            {"day": 2, "time": "bad"},
        ], [
            {"key": "event-1", "date": (datetime.now(CHILE).date() + timedelta(days=2)).isoformat(),
             "time": "12:15", "hasTime": True, "completed": False, "notes": "private notes"},
            {"key": "all-day", "date": (datetime.now(CHILE).date() + timedelta(days=3)).isoformat(),
             "hasTime": False, "completed": False},
            {"key": "far-future", "date": "2099-01-01", "time": "12:15", "hasTime": True, "completed": False},
        ])
        with sqlite3.connect(self.db) as db:
            classes = db.execute("SELECT day,class_time,class_finish,course_name FROM push_classes WHERE user_id=?", ("user-a",)).fetchall()
            agenda = db.execute("SELECT event_key,event_at FROM push_agenda WHERE user_id=?", ("user-a",)).fetchall()
            class_columns = [row[1] for row in db.execute("PRAGMA table_info(push_classes)")]
            agenda_columns = [row[1] for row in db.execute("PRAGMA table_info(push_agenda)")]
        self.assertEqual(classes, [(1, "08:30", "09:50", "PRIVATE COURSE NAME")])
        self.assertEqual(len(agenda), 2)
        self.assertTrue(all(len(row[0]) == 64 for row in agenda))  # Only one-way event identifiers are persisted.
        all_day_date = datetime.now(CHILE).date() + timedelta(days=3)
        expected_all_day_at = int(datetime(all_day_date.year, all_day_date.month, all_day_date.day,
                                            8, 0, tzinfo=CHILE).timestamp())
        self.assertIn(expected_all_day_at, {row[1] for row in agenda})
        self.assertEqual(class_columns, ["user_id", "day", "class_time", "class_finish", "course_name"])
        self.assertEqual(agenda_columns, ["user_id", "event_key", "event_at"])

    def test_class_end_and_interclass_break_notifications(self):
        import json

        save_subscription(self.db, "user-a", {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-token",
            "keys": {"p256dh": b64url(b"p" * 65), "auth": b64url(b"a" * 16)},
        })
        sync_reminders(self.db, "user-a", [
            {"day": 1, "time": "14:30", "finish": "15:50", "course": "Cálculo"},
            {"day": 1, "time": "16:00", "finish": "17:20", "course": "Álgebra"},
            {"day": 1, "time": "17:25", "finish": "18:45"},
        ], [])

        def deliver_at(local_hour, local_minute):
            instant = datetime(2026, 10, 5, local_hour, local_minute, tzinfo=CHILE).astimezone(timezone.utc)

            class FrozenDateTime(datetime):
                @classmethod
                def now(cls, tz=None):
                    return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

            with patch("app.services.push_notifications.datetime", FrozenDateTime), \
                 patch("app.services.push_notifications._send_push", return_value="sent") as sender:
                deliver_due(self.db, "/unused", "public-key", "https://horarios.dev/")
            return [json.loads(call.args[3])["body"] for call in sender.call_args_list]

        self.assertEqual(deliver_at(15, 40), ["Tu clase termina en 10 minutos."])
        at_ten_minute_gap = deliver_at(15, 50)
        self.assertIn("Comienza tu descanso de 10 minutos antes de tu próxima clase.", at_ten_minute_gap)
        self.assertIn("Tu próxima clase comienza en 10 minutos.", at_ten_minute_gap)
        self.assertEqual(deliver_at(16, 0), ["Tu clase de Álgebra ha comenzado."])
        self.assertEqual(deliver_at(17, 25), ["Tu clase ha comenzado."])
        self.assertEqual(deliver_at(17, 20), ["Comienza tu descanso de 5 minutos antes de tu próxima clase."])
        self.assertEqual(deliver_at(18, 45), ["Tu jornada de clases terminó por hoy."])

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
