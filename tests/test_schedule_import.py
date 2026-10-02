import io
import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("SCHEDULE_CACHE_FILE", os.path.join(tempfile.gettempdir(), "buscadorsalas-import-test.json"))

from app import create_app
from app.services.gemini_schedule import GeminiScheduleError, _normalize_classes, extract_schedule_from_image


class GeminiScheduleServiceTest(unittest.TestCase):
    def test_normalizes_full_class_details_and_sorts_by_time(self):
        classes = _normalize_classes([
            {
                "day": 2, "start": "10:00", "end": "11:20", "course": "Álgebra",
                "section": "Sec. 2", "professor": "Dra. Pérez", "room": "e441.2.s201",
                "kind": "Cátedra", "confidence": 0.9,
            },
            {
                "day": "Lunes", "start": "8.30", "end": "09:50", "course": "Cálculo I",
                "section": "1", "professor": "Prof. Rojas", "room": "E-201",
                "kind": "", "confidence": "no disponible",
            },
        ])
        self.assertEqual([item["dia"] for item in classes], [1, 2])
        self.assertEqual(classes[0]["diaNombre"], "Lunes")
        self.assertEqual(classes[0]["horaInicio"], "08:30")
        self.assertEqual(classes[0]["sala"], "E-201")
        self.assertEqual(classes[0]["profesor"], "Prof. Rojas")
        self.assertEqual(classes[0]["seccion"], "Sección 1")
        self.assertEqual(classes[0]["confianza"], 0)
        self.assertEqual(classes[1]["curso"], "Álgebra")

    def test_removes_class_type_labels_from_course_and_keeps_type_separate(self):
        classes = _normalize_classes([
            {
                "day": 1, "start": "08:30", "end": "09:50",
                "course": "Bioética y Sociedad Actual - Ayudantia Obligatoria",
                "kind": "Ayudantía Obligatoria", "confidence": 0.9,
            },
            {
                "day": 1, "start": "10:00", "end": "11:20",
                "course": "Laboratorio de Física", "kind": "Laboratorio", "confidence": 0.9,
            },
            {
                "day": 1, "start": "11:30", "end": "12:50",
                "course": "Ayudantía Obligatoria - Taller de Robótica", "kind": "", "confidence": 0.9,
            },
        ])

        self.assertEqual([item["curso"] for item in classes], [
            "Bioética y Sociedad Actual", "Física", "Robótica",
        ])
        self.assertEqual([item["tipo"] for item in classes], [
            "Ayudantía", "Laboratorio", "Ayudantía",
        ])

    def test_rejects_unusable_model_output(self):
        with self.assertRaises(GeminiScheduleError):
            _normalize_classes([{"day": 6, "start": "08:30", "end": "09:30", "course": "Física"}])

    def test_missing_or_undefined_room_is_normalized_to_dash(self):
        base = {"day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo"}
        for room in ("", "SALA NO DEFINIDA", "Sala no definida.", "Sin sala", "BLOQUE", "Bloque 1", "BLOQUE A", "AULA"):
            with self.subTest(room=room):
                classes = _normalize_classes([{**base, "room": room}])
                self.assertEqual(classes[0]["sala"], "-")
        labeled_room = _normalize_classes([{**base, "room": "BLOQUE E441.2.S201"}])
        self.assertEqual(labeled_room[0]["sala"], "E441.2.S201")

    def test_sections_are_labeled_and_s4_is_expanded(self):
        base = {"day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo"}
        for section, expected in (("S4", "Sección 4"), ("Sec. 2", "Sección 2"), ("4", "Sección 4"), ("", "Sección -")):
            with self.subTest(section=section):
                classes = _normalize_classes([{**base, "section": section}])
                self.assertEqual(classes[0]["seccion"], expected)

    @patch("app.services.gemini_schedule.requests.post")
    def test_sends_inline_image_and_parses_gemini_response(self, post):
        post.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {"candidates": [{"content": {"parts": [{"text": json.dumps({"classes": [{
                "day": 3, "start": "13:00", "end": "14:20", "course": "Programación",
                "section": "A", "professor": "Docente", "room": "E-310", "kind": "Laboratorio", "confidence": 0.8,
            }]})}]}}]},
        )
        result = extract_schedule_from_image(b"image-bytes", "image/png", "do-not-log-key", "gemini-2.5-flash")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["curso"], "Programación")
        args, kwargs = post.call_args
        self.assertTrue(args[0].endswith("/gemini-2.5-flash:generateContent"))
        self.assertEqual(kwargs["headers"]["x-goog-api-key"], "do-not-log-key")
        self.assertEqual(kwargs["json"]["contents"][0]["parts"][1]["inline_data"]["mime_type"], "image/png")
        prompt = kwargs["json"]["contents"][0]["parts"][0]["text"]
        self.assertIn('no pongas etiquetas como "BLOQUE"', prompt)
        prompt = kwargs["json"]["contents"][0]["parts"][0]["text"]
        self.assertIn("Ayudantía Obligatoria", prompt)
        self.assertIn("No consultes ni dependas de una malla curricular", prompt)
        self.assertIn('si en la imagen aparece "S4", devuelve "Sección 4"', prompt)
        self.assertIn('devuelve exactamente "Sección -"', prompt)

    @patch("app.services.gemini_schedule.time.sleep")
    @patch("app.services.gemini_schedule.requests.post")
    def test_retries_temporary_gemini_unavailability(self, post, _sleep):
        unavailable = Mock(ok=False, status_code=503, headers={})
        success_payload = {"classes": [{
            "day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo",
            "section": "", "professor": "", "room": "", "kind": "Cátedra", "confidence": 0.8,
        }]}
        success = Mock(ok=True, status_code=200, json=lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps(success_payload)}]}}]
        })
        post.side_effect = [unavailable, unavailable, success]
        result = extract_schedule_from_image(b"image-bytes", "image/png", "private-test-key")
        self.assertEqual(len(result), 1)
        self.assertEqual(post.call_count, 3)
        self.assertIn("gemini-3.5-flash-lite", post.call_args_list[0].args[0])

    @patch("app.services.gemini_schedule.time.sleep")
    @patch("app.services.gemini_schedule.requests.post")
    def test_falls_back_to_flash_after_flash_lite_stays_overloaded(self, post, _sleep):
        unavailable = Mock(ok=False, status_code=503, headers={})
        success_payload = {"classes": [{
            "day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo",
            "section": "", "professor": "", "room": "", "kind": "Cátedra", "confidence": 0.8,
        }]}
        success = Mock(ok=True, status_code=200, json=lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps(success_payload)}]}}]
        })
        post.side_effect = [unavailable, unavailable, unavailable, success]
        result = extract_schedule_from_image(b"image-bytes", "image/png", "private-test-key")
        self.assertEqual(len(result), 1)
        self.assertIn("gemini-3.5-flash", post.call_args.args[0])
        self.assertEqual(post.call_count, 4)


class ScheduleImportEndpointTest(unittest.TestCase):
    def setUp(self):
        self.rate_limit_dir = tempfile.TemporaryDirectory()
        self.rate_limit_db = os.path.join(self.rate_limit_dir.name, "rate_limits.sqlite3")
        self.app = create_app({
            "TESTING": True,
            "SUPABASE_URL": "https://project.example",
            "SUPABASE_ANON_KEY": "public-test-key",
            "GEMINI_API_KEY": "private-test-key",
            "RATE_LIMIT_DB": self.rate_limit_db,
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.rate_limit_dir.cleanup()

    def test_sync_endpoint_does_not_accept_get_requests(self):
        response = self.client.get("/api/sync")
        self.assertEqual(response.status_code, 405)

    @patch("app.blueprints.academic_api.dm.sync_from_remote", return_value=True)
    def test_sync_endpoint_throttles_repeated_manual_refreshes(self, sync):
        first = self.client.post("/api/sync")
        second = self.client.post("/api/sync")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertGreaterEqual(int(second.headers["Retry-After"]), 1)
        sync.assert_called_once()

    def test_import_rate_limit_is_shared_across_app_workers(self):
        import app.blueprints.academic_api as api
        with self.app.app_context():
            for _ in range(4):
                self.assertTrue(api._allow_schedule_import("same-user"))
        second_app = create_app({"RATE_LIMIT_DB": self.rate_limit_db})
        with second_app.app_context():
            self.assertFalse(api._allow_schedule_import("same-user"))
            self.assertTrue(api._allow_schedule_import("different-user"))

    def test_schedule_sync_rejects_malformed_or_oversized_class_lists(self):
        malformed = self.client.post("/api/sync_horario", json={"clases": "not-a-list"})
        oversized = self.client.post("/api/sync_horario", json={"clases": [{}] * 101})
        nested = self.client.post("/api/sync_horario", json={"clases": ["not-an-object"]})
        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(oversized.status_code, 413)
        self.assertEqual(nested.status_code, 400)

    def test_import_requires_signed_in_user(self):
        response = self.client.post("/api/import_schedule")
        self.assertEqual(response.status_code, 401)

    @patch("app.blueprints.academic_api.extract_schedule_from_image")
    @patch("app.blueprints.academic_api.requests.get")
    def test_authenticated_upload_returns_classes_without_storing_image(self, auth_get, extract):
        auth_get.return_value = Mock(ok=True, json=lambda: {"id": "test-user"})
        extract.return_value = [{
            "dia": 1, "diaNombre": "Lunes", "horaInicio": "08:30", "horaFin": "09:50",
            "curso": "Cálculo", "tipo": "Cátedra", "seccion": "1", "sala": "E-201",
            "profesor": "Docente", "confianza": 0.95,
        }]
        response = self.client.post(
            "/api/import_schedule",
            headers={"Authorization": "Bearer valid-test-session"},
            data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nimage"), "horario.png", "image/png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["total"], 1)
        self.assertEqual(response.get_json()["clases"][0]["profesor"], "Docente")
        self.assertNotIn("image", response.get_json())
        auth_get.assert_called_once()
        extract.assert_called_once()
        self.assertEqual(extract.call_args.args[0], b"\x89PNG\r\n\x1a\nimage")

    @patch("app.blueprints.academic_api.requests.get")
    def test_rejects_non_image_uploads(self, auth_get):
        auth_get.return_value = Mock(ok=True, json=lambda: {"id": "image-type-test-user"})
        response = self.client.post(
            "/api/import_schedule",
            headers={"Authorization": "Bearer valid-test-session"},
            data={"image": (io.BytesIO(b"not an image"), "schedule.txt", "text/plain")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 415)

    def test_import_reports_missing_gemini_configuration(self):
        self.app.config["GEMINI_API_KEY"] = ""
        with patch("app.blueprints.academic_api.requests.get") as auth_get:
            auth_get.return_value = Mock(ok=True, json=lambda: {"id": "missing-key-test-user"})
            response = self.client.post(
                "/api/import_schedule",
                headers={"Authorization": "Bearer valid-test-session"},
                data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nimage"), "horario.png", "image/png")},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
