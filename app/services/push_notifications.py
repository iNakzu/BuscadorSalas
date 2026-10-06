"""Minimal, account-scoped Web Push storage and delivery helpers."""
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from pywebpush import WebPushException, webpush


CHILE = ZoneInfo("America/Santiago")
ALLOWED_PUSH_HOSTS = ("fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com")
def _connect(path):
    parent = os.path.dirname(path)
    os.makedirs(parent, mode=0o700, exist_ok=True)
    try:
        os.chmod(parent, 0o700)
    except OSError:
        pass
    connection = sqlite3.connect(path, timeout=8)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS push_preferences (
          user_id TEXT PRIMARY KEY, classes INTEGER NOT NULL DEFAULT 1,
          agenda INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS push_subscription_owner ON push_subscriptions(user_id, endpoint);
        CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
        CREATE TABLE IF NOT EXISTS push_classes (
          user_id TEXT NOT NULL, day INTEGER NOT NULL, class_time TEXT NOT NULL,
          class_finish TEXT NOT NULL DEFAULT '',
          course_name TEXT NOT NULL DEFAULT '',
          PRIMARY KEY(user_id, day, class_time)
        );
        CREATE TABLE IF NOT EXISTS push_agenda (
          user_id TEXT NOT NULL, event_key TEXT NOT NULL, event_at INTEGER NOT NULL,
          PRIMARY KEY(user_id, event_key)
        );
        CREATE TABLE IF NOT EXISTS push_deliveries (
          subscription_id INTEGER NOT NULL, notification_key TEXT NOT NULL,
          sent_at INTEGER NOT NULL, PRIMARY KEY(subscription_id, notification_key)
        );
    """)
    class_columns = {row[1] for row in connection.execute("PRAGMA table_info(push_classes)")}
    if "class_finish" not in class_columns:
        connection.execute("ALTER TABLE push_classes ADD COLUMN class_finish TEXT NOT NULL DEFAULT ''")
    if "course_name" not in class_columns:
        connection.execute("ALTER TABLE push_classes ADD COLUMN course_name TEXT NOT NULL DEFAULT ''")
    connection.commit()
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return connection


def _valid_endpoint(endpoint):
    if not isinstance(endpoint, str) or len(endpoint) > 2048:
        return False
    try:
        parsed = urlparse(endpoint)
        host = (parsed.hostname or "").lower().rstrip(".")
        return parsed.scheme == "https" and parsed.port in (None, 443) and any(
            host == suffix or host.endswith("." + suffix) for suffix in ALLOWED_PUSH_HOSTS
        )
    except ValueError:
        return False


def _b64url_bytes(value):
    if not isinstance(value, str) or len(value) > 256:
        raise ValueError("invalid key")
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def save_subscription(path, user_id, subscription):
    if not isinstance(subscription, dict):
        raise ValueError("invalid subscription")
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys")
    if not _valid_endpoint(endpoint) or not isinstance(keys, dict):
        raise ValueError("invalid subscription")
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    if len(_b64url_bytes(p256dh)) != 65 or len(_b64url_bytes(auth)) < 16:
        raise ValueError("invalid subscription")
    now = int(datetime.now(timezone.utc).timestamp())
    with _connect(path) as db:
        count = db.execute("SELECT COUNT(*) FROM push_subscriptions WHERE user_id=?", (user_id,)).fetchone()[0]
        exists = db.execute("SELECT 1 FROM push_subscriptions WHERE endpoint=? AND user_id=?", (endpoint, user_id)).fetchone()
        if count >= 8 and not exists:
            raise OverflowError("subscription limit")
        db.execute("INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,created_at) VALUES(?,?,?,?,?) "
                   "ON CONFLICT(user_id,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth",
                   (user_id, endpoint, p256dh, auth, now))
        db.execute("INSERT INTO push_preferences(user_id,classes,agenda,updated_at) VALUES(?,1,1,?) "
                   "ON CONFLICT(user_id) DO NOTHING", (user_id, now))


def remove_subscription(path, user_id, endpoint=None):
    with _connect(path) as db:
        selected = db.execute("SELECT id FROM push_subscriptions WHERE user_id=?" + (" AND endpoint=?" if endpoint else ""),
                              (user_id, endpoint) if endpoint else (user_id,)).fetchall()
        db.executemany("DELETE FROM push_deliveries WHERE subscription_id=?", [(row["id"],) for row in selected])
        if endpoint:
            db.execute("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?", (user_id, endpoint))
        else:
            db.execute("DELETE FROM push_subscriptions WHERE user_id=?", (user_id,))
        if not db.execute("SELECT 1 FROM push_subscriptions WHERE user_id=? LIMIT 1", (user_id,)).fetchone():
            db.execute("DELETE FROM push_classes WHERE user_id=?", (user_id,))
            db.execute("DELETE FROM push_agenda WHERE user_id=?", (user_id,))
            db.execute("DELETE FROM push_preferences WHERE user_id=?", (user_id,))


def get_preferences(path, user_id):
    with _connect(path) as db:
        row = db.execute("SELECT classes,agenda FROM push_preferences WHERE user_id=?", (user_id,)).fetchone()
        count = db.execute("SELECT COUNT(*) FROM push_subscriptions WHERE user_id=?", (user_id,)).fetchone()[0]
    return {"classes": bool(row["classes"]) if row else True,
            "agenda": bool(row["agenda"]) if row else True, "subscribed": count > 0}


def set_preferences(path, user_id, classes, agenda):
    now = int(datetime.now(timezone.utc).timestamp())
    with _connect(path) as db:
        if not db.execute("SELECT 1 FROM push_subscriptions WHERE user_id=? LIMIT 1", (user_id,)).fetchone():
            raise RuntimeError("subscription required")
        db.execute("INSERT INTO push_preferences(user_id,classes,agenda,updated_at) VALUES(?,?,?,?) "
                   "ON CONFLICT(user_id) DO UPDATE SET classes=excluded.classes,agenda=excluded.agenda,updated_at=excluded.updated_at",
                   (user_id, int(classes), int(agenda), now))


def sync_reminders(path, user_id, classes, agenda):
    if not isinstance(classes, list) or len(classes) > 80 or not isinstance(agenda, list) or len(agenda) > 500:
        raise ValueError("invalid schedule")
    normalized_classes = {}
    for item in classes:
        if not isinstance(item, dict):
            raise ValueError("invalid schedule")
        day, class_time = item.get("day"), item.get("time")
        if isinstance(day, bool) or not isinstance(day, int) or day not in range(1, 6):
            continue
        if not isinstance(class_time, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", class_time):
            continue
        class_finish = item.get("finish", "")
        if not isinstance(class_finish, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", class_finish):
            class_finish = ""
        elif class_finish <= class_time:
            class_finish = ""
        course_name = item.get("course", "")
        if not isinstance(course_name, str):
            course_name = ""
        course_name = "".join(char for char in course_name.strip() if char.isprintable())[:120]
        normalized_classes[(day, class_time)] = (class_finish, course_name)
    normalized_agenda = {}
    today = datetime.now(CHILE).date()
    for item in agenda:
        if not isinstance(item, dict) or item.get("completed") is True:
            continue
        local_date, local_time, has_time = item.get("date"), item.get("time"), item.get("hasTime")
        if not isinstance(local_date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", local_date) or not isinstance(has_time, bool):
            continue
        try:
            event_date = datetime.strptime(local_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if event_date < today - timedelta(days=1) or event_date > today + timedelta(days=366):
            continue
        if has_time:
            if not isinstance(local_time, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", local_time):
                continue
            hour, minute = map(int, local_time.split(":"))
        else:
            hour, minute = 8, 0
        event_at = int(datetime(event_date.year, event_date.month, event_date.day, hour, minute, tzinfo=CHILE).timestamp())
        raw_key = item.get("key")
        if not isinstance(raw_key, str) or not raw_key or len(raw_key) > 128:
            continue
        key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        normalized_agenda[key] = event_at
    with _connect(path) as db:
        db.execute("DELETE FROM push_classes WHERE user_id=?", (user_id,))
        db.executemany("INSERT INTO push_classes(user_id,day,class_time,class_finish,course_name) VALUES(?,?,?,?,?)",
                       [(user_id, day, class_time, class_finish, course_name)
                        for (day, class_time), (class_finish, course_name) in normalized_classes.items()])
        db.execute("DELETE FROM push_agenda WHERE user_id=?", (user_id,))
        db.executemany("INSERT INTO push_agenda(user_id,event_key,event_at) VALUES(?,?,?)",
                       [(user_id, key, event_at) for key, event_at in normalized_agenda.items()])


def _send_push(endpoint, p256dh, auth, payload, private_key, subject):
    try:
        webpush({"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
                payload, vapid_private_key=private_key, vapid_claims={"sub": subject},
                ttl=3600, timeout=8, headers={"Urgency": "high"})
        return "sent"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        return "expired" if status in (404, 410) else "retry"
    except Exception:
        return "retry"


def deliver_due(path, private_key_path, public_key, subject):
    if not private_key_path or not public_key:
        raise RuntimeError("push keys are not configured")
    now = datetime.now(timezone.utc)
    now_epoch = int(now.timestamp())
    local_now = now.astimezone(CHILE)
    start_minute = int((now - timedelta(minutes=2)).timestamp())
    current_minute = int(now.timestamp())
    with _connect(path) as db:
        db.execute("DELETE FROM push_deliveries WHERE sent_at<?", (now_epoch - 90 * 86400,))
        prefs = db.execute("SELECT user_id,classes,agenda FROM push_preferences WHERE classes=1 OR agenda=1").fetchall()
        due = []
        for pref in prefs:
            uid = pref["user_id"]
            if pref["classes"]:
                rows = db.execute("SELECT day,class_time,class_finish,course_name FROM push_classes WHERE user_id=?", (uid,)).fetchall()
                classes_by_day = {}
                for row in rows:
                    class_day = int(row["day"])
                    days_ahead = (class_day - local_now.isoweekday()) % 7
                    target_day = local_now.date() + timedelta(days=days_ahead)
                    hh, mm = map(int, row["class_time"].split(":"))
                    class_at = datetime(target_day.year, target_day.month, target_day.day, hh, mm, tzinfo=CHILE)
                    remind_at = int((class_at - timedelta(minutes=10)).timestamp())
                    class_finish = str(row["class_finish"] or "")
                    finish_at = None
                    if re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", class_finish) and class_finish > row["class_time"]:
                        end_hh, end_mm = map(int, class_finish.split(":"))
                        finish_at = datetime(target_day.year, target_day.month, target_day.day,
                                             end_hh, end_mm, tzinfo=CHILE)
                    course_name = str(row["course_name"] or "")
                    classes_by_day.setdefault(class_day, []).append((class_at, finish_at, row["class_time"], class_finish))
                    if start_minute < remind_at <= current_minute and class_at > now:
                        due.append((uid, f"class:{target_day.isoformat()}:{row['day']}:{row['class_time']}",
                                    "Tu próxima clase comienza en 10 minutos.", "tab-mihorario"))
                    class_start_at = int(class_at.timestamp())
                    if start_minute < class_start_at <= current_minute:
                        start_message = f"Tu clase de {course_name} ha comenzado." if course_name else "Tu clase ha comenzado."
                        due.append((uid, f"class-start:{target_day.isoformat()}:{row['day']}:{row['class_time']}",
                                    start_message, "tab-mihorario"))
                    if finish_at:
                        finish_reminder = int((finish_at - timedelta(minutes=10)).timestamp())
                        if start_minute < finish_reminder <= current_minute and finish_at > now:
                            due.append((uid, f"class-end:{target_day.isoformat()}:{row['day']}:{row['class_time']}:{class_finish}",
                                        "Tu clase termina en 10 minutos.", "tab-mihorario"))
                for class_day, day_classes in classes_by_day.items():
                    day_classes.sort(key=lambda item: item[0])
                    final_class = max(
                        (item for item in day_classes if item[1]),
                        key=lambda item: item[1],
                        default=None,
                    )
                    if final_class:
                        final_start, final_finish, _, final_finish_text = final_class
                        final_end = int(final_finish.timestamp())
                        if start_minute < final_end <= current_minute:
                            due.append((uid,
                                        f"day-end:{final_finish.date().isoformat()}:{class_day}:{final_start.strftime('%H:%M')}:{final_finish_text}",
                                        "Tu jornada de clases terminó por hoy.", "tab-mihorario"))
                    for current_class, next_class in zip(day_classes, day_classes[1:]):
                        class_at, finish_at, class_time, class_finish = current_class
                        next_start = next_class[0]
                        if not finish_at or next_start <= finish_at or next_start <= now:
                            continue
                        break_at = int(finish_at.timestamp())
                        if start_minute < break_at <= current_minute and finish_at >= now:
                            gap_minutes = int((next_start - finish_at).total_seconds() // 60)
                            if gap_minutes < 60:
                                duration = f"{gap_minutes} minutos"
                            else:
                                hours, minutes = divmod(gap_minutes, 60)
                                duration = f"{hours} h" + (f" {minutes} min" if minutes else "")
                            due.append((uid, f"break:{finish_at.date().isoformat()}:{class_day}:{class_time}:{class_finish}:{next_class[2]}",
                                        f"Comienza tu descanso de {duration} antes de tu próxima clase.", "tab-mihorario"))
            if pref["agenda"]:
                rows = db.execute("SELECT event_key,event_at FROM push_agenda WHERE user_id=?", (uid,)).fetchall()
                for row in rows:
                    remind_at = int(row["event_at"]) - 600
                    if start_minute < remind_at <= current_minute and int(row["event_at"]) > now_epoch:
                        due.append((uid, f"agenda:{row['event_key']}:{row['event_at']}",
                                    "Tienes un evento de agenda dentro de 10 minutos.", "tab-agenda"))
        deliveries = []
        for user_id, notification_key, message, section in due:
            subs = db.execute("SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?", (user_id,)).fetchall()
            for sub in subs:
                sent = db.execute("SELECT 1 FROM push_deliveries WHERE subscription_id=? AND notification_key=?",
                                  (sub["id"], notification_key)).fetchone()
                if sent:
                    continue
                payload = json.dumps({"title": "Portal Estudiantil", "body": message,
                                      "url": f"/?tab={section}", "tag": notification_key}, ensure_ascii=False)
                deliveries.append((sub["id"], notification_key, sub["endpoint"], sub["p256dh"], sub["auth"], payload))
        # Parallelize network requests so a reminder burst across many users can
        # finish promptly without serially waiting on each push service.
        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = {
                pool.submit(_send_push, endpoint, p256dh, auth, payload, private_key_path, subject):
                    (subscription_id, notification_key)
                for subscription_id, notification_key, endpoint, p256dh, auth, payload in deliveries
            }
            for future in as_completed(futures):
                subscription_id, notification_key = futures[future]
                result = future.result()
                if result == "sent":
                    db.execute("INSERT OR IGNORE INTO push_deliveries VALUES(?,?,?)",
                               (subscription_id, notification_key, now_epoch))
                elif result == "expired":
                    db.execute("DELETE FROM push_deliveries WHERE subscription_id=?", (subscription_id,))
                    db.execute("DELETE FROM push_subscriptions WHERE id=?", (subscription_id,))
