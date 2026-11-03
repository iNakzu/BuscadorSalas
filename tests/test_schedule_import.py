import io
import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("SCHEDULE_CACHE_FILE", os.path.join(tempfile.gettempdir(), "buscadorsalas-import-test.json"))

from app import create_app
from app.services.schedule import STANDARD_BLOCKS
from app.services.gemini_schedule import (
    GeminiScheduleError,
    _measure_card_block_count,
    _normalize_classes,
    _prepare_schedule_image,
    _remove_horizontal_time_indicator,
    _review_ambiguous_days,
    extract_schedule_from_image,
)


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
        self.assertEqual(classes[0]["profesor"], "PROF. ROJAS")
        self.assertEqual(classes[0]["seccion"], "1")
        self.assertEqual(classes[0]["confianza"], 0)
        self.assertEqual(classes[1]["curso"], "Álgebra")

    def test_strips_class_type_from_title_and_normalizes_course_name(self):
        classes = _normalize_classes([
            {
                "day": 1, "start": "08:30", "end": "09:50",
                "course": "Cátedra de Historia del Arte", "kind": "", "confidence": 0.9,
            },
            {
                "day": 1, "start": "10:00", "end": "11:20",
                "course": "Laboratorio de Física", "kind": "", "confidence": 0.9,
            },
            {
                "day": 1, "start": "11:30", "end": "12:50",
                "course": "Bioética y Sociedad Actual - Ayudantía Obligatoria", "kind": "", "confidence": 0.9,
            },
            {
                "day": 1, "start": "13:00", "end": "14:20",
                "course": "Evaluación de Proyectos TIC - Laboratorio", "kind": "Laboratorio", "confidence": 0.9,
            },
        ])

        self.assertEqual([item["curso"] for item in classes], [
            "Historia del Arte", "Física", "Bioética y Sociedad Actual", "Evaluación de Proyectos TIC",
        ])
        self.assertEqual([item["tipo"] for item in classes], [
            "Cátedra", "Laboratorio", "Ayudantía", "Laboratorio",
        ])

    def test_keeps_taller_as_course_title_and_strips_ayudantia_de_prefix(self):
        classes = _normalize_classes([
            {
                "day": 1, "start": "08:30", "end": "09:50",
                "course": "Taller de Redes y Servicios", "kind": "Taller", "confidence": 0.9,
            },
            {
                "day": 1, "start": "10:00", "end": "11:20",
                "course": "Ayudantía de Redes y Servicios", "kind": "Ayudantía", "confidence": 0.9,
            },
        ])

        self.assertEqual(classes[0]["curso"], "Taller de Redes y Servicios")
        self.assertNotEqual(classes[0]["tipo"], "Taller")
        self.assertEqual(classes[1]["curso"], "Redes y Servicios")
        self.assertEqual(classes[1]["tipo"], "Ayudantía")

    def test_normalizes_imported_teacher_names_to_uppercase(self):
        classes = _normalize_classes([{
            "day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo",
            "professor": "Dra. Pérez González", "confidence": 0.9,
        }])

        self.assertEqual(classes[0]["profesor"], "DRA. PÉREZ GONZÁLEZ")

    def test_preserves_full_time_range_for_a_class_spanning_two_blocks(self):
        classes = _normalize_classes([{
            "day": 2, "start": "10:00", "end": "12:50", "block_count": 2, "course": "Climate Futures",
            "confidence": 0.95,
        }])

        self.assertEqual(len(classes), 1)
        self.assertEqual(classes[0]["horaInicio"], "10:00")
        self.assertEqual(classes[0]["horaFin"], "12:50")
        self.assertEqual(classes[0]["bloques"], 2)

    def test_uses_visual_block_count_when_ocr_reads_the_next_row_boundary(self):
        classes = _normalize_classes([{
            "day": 2, "start": "10:00", "end": "11:30", "block_count": 2,
            "course": "Climate Futures", "confidence": 0.95,
        }])

        self.assertEqual(classes[0]["horaInicio"], "10:00")
        self.assertEqual(classes[0]["horaFin"], "12:50")
        self.assertEqual(classes[0]["bloques"], 2)

    def test_does_not_extend_class_when_end_is_next_block_start(self):
        classes = _normalize_classes([{
            "day": 2, "start": "10:00", "end": "11:30", "block_count": 1,
            "course": "Climate Futures", "confidence": 0.95,
        }])

        self.assertEqual(classes[0]["horaFin"], "11:30")
        self.assertNotIn("bloques", classes[0])

    def test_ignores_unconfirmed_model_block_count_for_normal_classes(self):
        classes = _normalize_classes([
            {"day": 1, "start": "08:30", "end": "09:50", "block_count": 2, "course": "Cálculo"},
            {"day": 1, "start": "10:00", "end": "11:20", "block_count": 2, "course": "Física"},
        ])

        self.assertEqual(len(classes), 2)
        self.assertTrue(all("bloques" not in item for item in classes))

    def test_rejects_two_classes_occupying_the_same_block(self):
        with self.assertRaisesRegex(GeminiScheduleError, "más de una clase en un mismo bloque"):
            _normalize_classes([
                {"day": 2, "start": "10:00", "end": "12:50", "block_count": 2, "course": "Climate Futures"},
                {"day": 2, "start": "11:30", "end": "12:50", "course": "Otra clase"},
            ])

    def test_rejects_false_double_block_when_it_collides_with_next_normal_class(self):
        with self.assertRaisesRegex(GeminiScheduleError, "más de una clase en un mismo bloque"):
            _normalize_classes([
                {"day": 1, "start": "08:30", "end": "10:00", "block_count": 2, "course": "Cálculo"},
                {"day": 1, "start": "10:00", "end": "11:20", "block_count": 1, "course": "Física"},
            ])

    def test_study_is_not_a_class_type_or_removed_from_course_name(self):
        classes = _normalize_classes([
            {
                "day": 1, "start": "08:30", "end": "09:50",
                "course": "Estudio de Mercado", "kind": "Estudio", "confidence": 0.9,
            },
        ])

        self.assertEqual(classes[0]["curso"], "Estudio de Mercado")
        self.assertEqual(classes[0]["tipo"], "Cátedra")

    def test_rejects_unusable_model_output(self):
        with self.assertRaises(GeminiScheduleError):
            _normalize_classes([{"day": 6, "start": "08:30", "end": "09:30", "course": "Física"}])

    @patch("app.services.gemini_schedule._review_ambiguous_days", side_effect=lambda classes, *_args: classes)
    @patch("app.services.gemini_schedule._prepare_schedule_image", return_value=(b"prepared-image", "image/png", 4, 4, bytes([255, 255, 255]) * 16))
    @patch("app.services.gemini_schedule.requests.post")
    def test_sends_inline_image_and_parses_gemini_response(self, post, _prepare, _review):
        post.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {"candidates": [{"content": {"parts": [{"text": json.dumps({"classes": [{
                "day": 3, "start": "13:00", "end": "14:20", "block_count": 1, "course": "Programación",
                "section": "A", "professor": "Docente", "room": "E-310", "kind": "Laboratorio", "confidence": 0.8,
            }]})}]}}]},
        )
        result = extract_schedule_from_image(b"image-bytes", "image/png", "do-not-log-key", "gemini-2.5-flash")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["curso"], "Programación")
        self.assertEqual(post.call_count, 1)
        args, kwargs = post.call_args_list[0]
        self.assertTrue(args[0].endswith("/gemini-2.5-flash:generateContent"))
        self.assertEqual(kwargs["headers"]["x-goog-api-key"], "do-not-log-key")
        self.assertEqual(kwargs["json"]["contents"][0]["parts"][1]["inline_data"]["mime_type"], "image/png")
        prompt = kwargs["json"]["contents"][0]["parts"][0]["text"]
        response_schema = kwargs["json"]["generationConfig"]["responseSchema"]
        self.assertIn('escribe solo el nombre del ramo', prompt)
        self.assertIn('“Taller” puede ser parte del nombre del ramo', prompt)
        self.assertIn('elimina “Ayudantía de” del título', prompt)
        self.assertIn("profesor en mayúsculas", prompt)
        self.assertNotIn("block_count", response_schema["properties"]["classes"]["items"]["properties"])
        self.assertNotIn("construye internamente una tabla", prompt)
        self.assertIn("Ignora elementos visuales superpuestos, como líneas de color", prompt)
        self.assertIn("Incluye también una tarjeta parcialmente cortada por el borde de la imagen", prompt)
        self.assertNotIn("línea morada", prompt)
        self.assertNotIn("Nunca asignes dos clases distintas", prompt)
        self.assertNotIn("MALLA_ICIT", prompt)

    @patch("app.services.gemini_schedule._request_model")
    def test_measures_tall_cards_and_keeps_normal_wrapped_cards_single(self, request_model):
        block_entries = [block for block in STANDARD_BLOCKS if not str(block.get("id", "")).endswith("_S")]
        candidates = [
            {"day": 1, "start": "14:30", "end": "16:00", "course": "Arquitectura y Organización de Computadores", "block_count": 1},
            {"day": 2, "start": "10:00", "end": "11:30", "course": "Climate Futures: Science, Technology", "block_count": 1},
            {"day": 2, "start": "13:00", "end": "14:30", "course": "Inteligencia Artificial", "block_count": 1},
            {"day": 3, "start": "14:30", "end": "16:00", "course": "Arquitectura y Organización de Computadores", "block_count": 1},
            {"day": 4, "start": "14:30", "end": "16:00", "course": "Arquitectura y Organización de Computadores", "block_count": 1},
            {"day": 5, "start": "13:00", "end": "14:30", "course": "Inteligencia Artificial", "block_count": 1},
        ]
        width, height, pitch = 500, 650, 70
        pixels = bytearray([255, 255, 255] * width * height)
        boxes = []
        for index, item in enumerate(candidates):
            day = item["day"]
            start_index = next(i for i, block in enumerate(block_entries) if block["start"][:5] == item["start"])
            top = 25 + start_index * pitch
            left = day * 80 + 10
            right = left + 55
            card_height = 126 if item["course"].startswith("Climate") else 58
            for y in range(top, top + card_height):
                for x in range(left, right):
                    offset = (y * width + x) * 3
                    pixels[offset:offset + 3] = bytes((200, 250, 238))
            boxes.append({"id": index, "box_2d": [
                round(top * 1000 / height), round(left * 1000 / width),
                round((top + 58) * 1000 / height), round(right * 1000 / width),
            ]})

        request_model.return_value = Mock(ok=True, status_code=200, json=lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps(boxes)}]}}]
        })
        reviewed = _review_ambiguous_days(candidates, b"image-bytes", "image/jpeg", "private-test-key", "gemini-3.5-flash-lite", width, height, bytes(pixels))

        self.assertEqual(request_model.call_count, 1)
        self.assertIn("box_2d=[y_min,x_min,y_max,x_max]", request_model.call_args.args[0]["contents"][0]["parts"][0]["text"])
        climate = next(item for item in reviewed if item["course"].startswith("Climate"))
        friday_ai = next(item for item in reviewed if item["day"] == 5)
        self.assertEqual((climate["end"], climate["block_count"]), ("12:50", 2))
        self.assertEqual((friday_ai["end"], friday_ai["block_count"]), ("14:20", 1))
        self.assertEqual([item["block_count"] for item in reviewed if item["course"].startswith("Arquitectura")], [1, 1, 1])

    @patch("app.services.gemini_schedule._request_model")
    def test_custom_layout_without_measurable_row_scale_keeps_gemini_times(self, request_model):
        classes = [{
            "day": 2, "start": "10:00", "end": "12:50", "course": "Climate Futures",
            "section": "", "professor": "", "room": "", "kind": "Cátedra", "confidence": 0.9,
        }]
        request_model.return_value = Mock(ok=True, status_code=200, json=lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps([
                {"id": 0, "box_2d": [100, 100, 300, 300]},
            ])}]}}]
        })

        reviewed = _review_ambiguous_days(
            classes, b"image-bytes", "image/jpeg", "private-test-key",
            "gemini-3.5-flash-lite", 500, 650, b"",
        )

        self.assertEqual(reviewed, classes)
        self.assertEqual(reviewed[0]["end"], "12:50")

    def test_removes_only_a_long_horizontal_purple_indicator(self):
        width, height = 120, 60
        pixels = bytearray([245, 245, 245] * width * height)
        for x in range(10, 110):
            offset = (30 * width + x) * 3
            pixels[offset:offset + 3] = bytes((105, 15, 115))

        cleaned, removed = _remove_horizontal_time_indicator(bytes(pixels), width, height)

        self.assertTrue(removed)
        self.assertEqual(cleaned[(30 * width + 50) * 3:(30 * width + 50) * 3 + 3], bytes((245, 245, 245)))

    @unittest.skipUnless(shutil.which("convert"), "ImageMagick is installed by setup_server.sh")
    def test_prepares_image_and_removes_time_indicator_before_gemini(self):
        width, height = 120, 80
        pixels = bytearray([245, 245, 245] * width * height)
        for x in range(10, 110):
            offset = (35 * width + x) * 3
            pixels[offset:offset + 3] = bytes((105, 15, 115))
        ppm = f"P6\n{width} {height}\n255\n".encode("ascii") + bytes(pixels)

        prepared, mime, decoded_width, decoded_height, decoded_pixels = _prepare_schedule_image(ppm)

        self.assertEqual((mime, decoded_width, decoded_height), ("image/jpeg", width, height))
        self.assertTrue(prepared.startswith(b"\xff\xd8\xff"))
        center = (35 * width + 50) * 3
        self.assertGreater(min(decoded_pixels[center:center + 3]), 200)

    def test_measures_card_height_from_background_even_when_text_is_wrapped(self):
        width, height, top, left, right = 100, 200, 20, 20, 80
        pixels = bytearray([255, 255, 255] * width * height)
        for y in range(top, top + 120):
            for x in range(left, right):
                offset = (y * width + x) * 3
                pixels[offset:offset + 3] = bytes((200, 250, 238))
        for y in (top + 10, top + 24, top + 38):
            for x in range(left, left + 35):
                offset = (y * width + x) * 3
                pixels[offset:offset + 3] = bytes((20, 40, 35))

        count = _measure_card_block_count(bytes(pixels), width, height, [100, 100, 390, 900], 70)

        self.assertEqual(count, 2)

    @patch("app.services.gemini_schedule._review_ambiguous_days", side_effect=lambda classes, *_args: classes)
    @patch("app.services.gemini_schedule._prepare_schedule_image", return_value=(b"prepared-image", "image/png", 4, 4, bytes([255, 255, 255]) * 16))
    @patch("app.services.gemini_schedule.time.sleep")
    @patch("app.services.gemini_schedule.requests.post")
    def test_retries_temporary_gemini_unavailability(self, post, _sleep, _prepare, _review):
        unavailable = Mock(ok=False, status_code=503, headers={})
        success_payload = {"classes": [{
            "day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo",
            "block_count": 1, "section": "", "professor": "", "room": "", "kind": "Cátedra", "confidence": 0.8,
        }]}
        success = Mock(ok=True, status_code=200, json=lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps(success_payload)}]}}]
        })
        post.side_effect = [unavailable, unavailable, success, success]
        result = extract_schedule_from_image(b"image-bytes", "image/png", "private-test-key")
        self.assertEqual(len(result), 1)
        self.assertEqual(post.call_count, 3)
        self.assertIn("gemini-3.5-flash-lite", post.call_args_list[0].args[0])

    @patch("app.services.gemini_schedule._review_ambiguous_days", side_effect=lambda classes, *_args: classes)
    @patch("app.services.gemini_schedule._prepare_schedule_image", return_value=(b"prepared-image", "image/png", 4, 4, bytes([255, 255, 255]) * 16))
    @patch("app.services.gemini_schedule.time.sleep")
    @patch("app.services.gemini_schedule.requests.post")
    def test_falls_back_to_flash_after_flash_lite_stays_overloaded(self, post, _sleep, _prepare, _review):
        unavailable = Mock(ok=False, status_code=503, headers={})
        success_payload = {"classes": [{
            "day": 1, "start": "08:30", "end": "09:50", "course": "Cálculo",
            "block_count": 1, "section": "", "professor": "", "room": "", "kind": "Cátedra", "confidence": 0.8,
        }]}
        success = Mock(ok=True, status_code=200, json=lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps(success_payload)}]}}]
        })
        post.side_effect = [unavailable, unavailable, unavailable, success, success]
        result = extract_schedule_from_image(b"image-bytes", "image/png", "private-test-key")
        self.assertEqual(len(result), 1)
        self.assertIn("gemini-3.5-flash", post.call_args_list[3].args[0])
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

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_normalizes_course_spaces_and_requires_matching_section(self, get_classes):
        get_classes.return_value = [
            {"node": {
                "course": "INTRODUCCIÓN  A LA ECONOMÍA", "day": 2, "start": "11:30:00", "finish": "12:50:00",
                "place": "E441.2.S205", "teacher": "OLIVARES GUILLERMO ANTONIO", "section": 5, "code": "CII2100",
            }},
            {"node": {
                "course": "INTRODUCCIÓN  A LA ECONOMÍA", "day": 2, "start": "11:30:00", "finish": "12:50:00",
                "place": "E441.2.S201", "teacher": "CALCAGNO JAIME ALBERTO", "section": 1, "code": "CII2100",
            }},
            {"node": {
                "course": "INTRODUCCIÓN  A LA ECONOMÍA", "day": 1, "start": "11:30:00", "finish": "12:50:00",
                "place": "E441.2.S101", "teacher": "Otro día", "section": 1, "code": "CII2100",
            }},
        ]
        original = {
            "curso": "Introduccion   a la economia", "dia": 2, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "S1", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        matched = response.get_json()[0]
        self.assertEqual(matched["curso"], "Introduccion   a la economia")
        self.assertNotIn("cursoDisplay", matched)
        self.assertEqual(matched["sala"], "E441.2.S201")
        self.assertEqual(matched["profesor"], "CALCAGNO JAIME ALBERTO")
        self.assertEqual(matched["seccion"], "S1", "a section explicitly entered by the user should be preserved")
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_leaves_missing_section_unchanged_when_candidates_are_ambiguous(self, get_classes):
        get_classes.return_value = [
            {"node": {
                "course": "INTRODUCCIÓN  A LA ECONOMÍA", "day": 2, "start": "11:30:00", "finish": "12:50:00",
                "place": "E441.2.S201", "teacher": "Docente sección 1", "section": 1, "code": "CII2100",
            }},
            {"node": {
                "course": "INTRODUCCIÓN  A LA ECONOMÍA", "day": 2, "start": "11:30:00", "finish": "12:50:00",
                "place": "E441.2.S205", "teacher": "Docente sección 5", "section": 5, "code": "CII2100",
            }},
        ]
        original = {
            "curso": "Introduccion a la economia", "dia": 2, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "", "sala": "Sala ingresada", "profesor": "Docente ingresado",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        expected = {**original, "profesor": ""}
        self.assertEqual(response.get_json(), [expected])
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_preserves_existing_values_when_no_candidate_matches(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "INTRODUCCIÓN A LA ECONOMÍA", "day": 2, "start": "11:30:00", "finish": "12:50:00",
            "place": "E441.2.S201", "teacher": "DOCENTE OFICIAL", "section": 1, "code": "CII2100",
        }}]
        original = {
            "curso": "Arquitectura de Software", "dia": 2, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "Sección 7", "sala": "Sala guardada", "profesor": "Docente guardado",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        expected = {**original, "profesor": ""}
        self.assertEqual(response.get_json(), [expected])
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_never_replaces_saved_details_with_empty_json_values(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "MECÁNICA", "day": 5, "start": "11:30:00", "finish": "12:50:00",
            "place": "E441.4.S401", "teacher": "", "section": 13, "code": "CBF1100",
        }}]
        original = {
            "curso": "Mecánica", "dia": 5, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "Sección 13", "sala": "E441.4.S401", "profesor": "Docente guardado",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        matched = response.get_json()[0]
        self.assertEqual(matched["sala"], "E441.4.S401")
        self.assertEqual(matched["seccion"], "Sección 13")
        self.assertEqual(matched["profesor"], "")
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_preserves_user_entered_details_when_unique_candidate_matches(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "TECNOLOGÍAS INALÁMBRICAS", "day": 1, "start": "11:30:00", "finish": "12:50:00",
            "place": "E441.2.S205", "teacher": "DOCENTE OFICIAL", "section": 4, "code": "CIT0001",
        }}]
        original = {
            "curso": "Tecnologias inAlambricas", "dia": 1, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "Sección 8", "sala": "Sala elegida", "profesor": "Mi profesor",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0], {**original, "profesor": ""})
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_corrects_a_fuzzy_teacher_name_from_selector_candidates(self, get_classes):
        get_classes.return_value = [
            {"node": {
                "course": "CÁLCULO DIFERENCIAL", "day": 1, "start": "08:30:00", "finish": "09:50:00",
                "place": "E441.1.S101", "teacher": "PÉREZ GONZÁLEZ ANA MARÍA", "section": 1, "code": "MAT1001",
            }},
            {"node": {
                "course": "CÁLCULO DIFERENCIAL", "day": 1, "start": "08:30:00", "finish": "09:50:00",
                "place": "E441.1.S102", "teacher": "ROJAS CONTRERAS JUAN PABLO", "section": 2, "code": "MAT1001",
            }},
        ]
        imported = {
            "curso": "Cálculo Diferencial", "dia": 1, "horaInicio": "08:30", "horaFin": "09:50",
            "bloqueNum": 1, "seccion": "", "sala": "", "profesor": "PEREZ GONZALES ANA MARIA",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [imported]})

        self.assertEqual(response.status_code, 200)
        corrected = response.get_json()[0]
        self.assertEqual(corrected["profesor"], "PÉREZ GONZÁLEZ ANA MARÍA")
        self.assertEqual(corrected["seccion"], "Sección 1")
        self.assertEqual(corrected["sala"], "E441.1.S101")

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_reconciles_old_lowercase_teachers_and_clears_unknown_names(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "MECÁNICA", "day": 1, "start": "10:00:00", "finish": "11:20:00",
            "place": "V432.3.S314", "teacher": "ARANCIBIA KARINA ANDREA", "section": 1, "code": "FIS1001",
        }}]
        classes = [
            {
                "id": "known", "curso": "Mecánica", "dia": 1, "horaInicio": "10:00", "horaFin": "11:20",
                "bloqueNum": 2, "seccion": "1", "sala": "", "profesor": "Karina Arancibia",
            },
            {
                "id": "unknown", "curso": "Curso antiguo", "dia": 1, "horaInicio": "13:00", "horaFin": "14:20",
                "bloqueNum": 4, "seccion": "", "sala": "", "profesor": "profesor que no existe",
            },
        ]

        response = self.client.post("/api/sync_horario", json={"clases": classes})

        self.assertEqual(response.status_code, 200)
        synced = response.get_json()
        self.assertEqual(synced[0]["profesor"], "ARANCIBIA KARINA ANDREA")
        self.assertEqual(synced[0]["sala"], "V432.3.S314")
        self.assertEqual(synced[1]["profesor"], "")

    @patch("app.services.schedule.dm.get_classes")
    def test_professor_selector_search_uses_fuzzy_official_name_candidates(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "CÁLCULO DIFERENCIAL", "day": 1, "start": "08:30:00", "finish": "09:50:00",
            "place": "E441.1.S101", "teacher": "PÉREZ GONZÁLEZ ANA MARÍA", "section": 1, "code": "MAT1001",
        }}]

        from app.services.schedule import buscar_profesor
        results = buscar_profesor("PEREZ GONZALES ANA MARIA")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["profe"], "PÉREZ GONZÁLEZ ANA MARÍA")

    def test_teacher_distance_ignores_name_order_and_matches_small_spelling_errors(self):
        from app.services.schedule import distancia_nombre_profesor, mejor_coincidencia_profesor

        official = [{"node": {"teacher": "CALCAGNO JAIME ALBERTO"}}]
        self.assertEqual(distancia_nombre_profesor("Jaime Calcaño", "CALCAGNO JAIME ALBERTO"), 1)
        self.assertEqual(mejor_coincidencia_profesor("Jaime Calcaño", official), "CALCAGNO JAIME ALBERTO")

    def test_teacher_match_stays_empty_when_official_candidates_are_tied(self):
        from app.services.schedule import mejor_coincidencia_profesor

        official = [
            {"node": {"teacher": "CALCAGNO JAIME ALBERTO"}},
            {"node": {"teacher": "CALCAGNO JAIME ALEJANDRO"}},
        ]
        self.assertEqual(mejor_coincidencia_profesor("Jaime Calcaño", official), "")

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_does_not_fill_from_a_candidate_when_saved_room_does_not_match(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "TECNOLOGÍAS INALÁMBRICAS", "day": 1, "start": "11:30:00", "finish": "12:50:00",
            "place": "E441.2.S205", "teacher": "DOCENTE OFICIAL", "section": 4, "code": "CIT0001",
        }}]
        original = {
            "curso": "Tecnologias inAlambricas", "dia": 1, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "", "sala": "V432.1.S101", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [original])
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_fills_section_when_the_normal_block_has_one_candidate(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "INTRODUCCIÓN  A LA ECONOMÍA", "day": 2, "start": "11:30:00", "finish": "12:50:00",
            "place": "E441.2.S201", "teacher": "CALCAGNO JAIME ALBERTO", "section": "Sección 1", "code": "CII2100",
        }}]
        original = {
            "curso": "Introduccion a la economia", "dia": 2, "horaInicio": "11:30", "horaFin": "12:50",
            "bloqueNum": 3, "seccion": "", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        matched = response.get_json()[0]
        self.assertEqual(matched["curso"], "Introduccion a la economia")
        self.assertNotIn("cursoDisplay", matched)
        self.assertEqual(matched["sala"], "E441.2.S201")
        self.assertEqual(matched["profesor"], "CALCAGNO JAIME ALBERTO")
        self.assertEqual(matched["seccion"], "Sección 1")
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_uses_existing_room_and_intro_abbreviation_to_fill_missing_details(self, get_classes):
        get_classes.return_value = [
            {"node": {
                "course": "INTRODUCCIÓN AL ÁLGEBRA", "day": 5, "start": "11:30:00", "finish": "12:50:00",
                "place": "E306.2.S208", "teacher": "", "section": 5, "code": "CBM1100",
            }},
            {"node": {
                "course": "INTRODUCCIÓN AL ÁLGEBRA", "day": 5, "start": "11:30:00", "finish": "12:50:00",
                "place": "V432.3.AU", "teacher": "MARTI EMILIO ANDRES", "section": 7, "code": "CBM1100",
            }},
            {"node": {
                "course": "INTRODUCCIÓN AL ÁLGEBRA", "day": 5, "start": "14:30:00", "finish": "15:50:00",
                "place": "E306.1.S101", "teacher": "", "section": 3, "code": "CBM1100",
            }},
            {"node": {
                "course": "ÁLGEBRA LINEAL", "day": 5, "start": "16:00:00", "finish": "17:20:00",
                "place": "E306.2.S208", "teacher": "", "section": 11, "code": "CBM1102",
            }},
            {"node": {
                "course": "ÁLGEBRA LINEAL", "day": 5, "start": "16:00:00", "finish": "17:20:00",
                "place": "E306.2.S204", "teacher": "", "section": 12, "code": "CBM1102",
            }},
        ]
        classes = [
            {"id": "intro-1130", "curso": "Intro al Algebra", "dia": 5, "horaInicio": "11:30", "horaFin": "12:50",
             "bloqueNum": 3, "seccion": "", "sala": "E306.2.S208", "profesor": ""},
            {"id": "intro-1430", "curso": "Intro al Algebra", "dia": 5, "horaInicio": "14:30", "horaFin": "15:50",
             "bloqueNum": 5, "seccion": "", "sala": "", "profesor": ""},
            {"id": "lineal-1600", "curso": "Álgebra Lineal", "dia": 5, "horaInicio": "16:00", "horaFin": "17:20",
             "bloqueNum": 6, "seccion": "", "sala": "E306.2.S208", "profesor": ""},
            {"id": "lineal-1130", "curso": "Álgebra Lineal", "dia": 5, "horaInicio": "11:30", "horaFin": "12:50",
             "bloqueNum": 3, "seccion": "", "sala": "Sala guardada", "profesor": "Docente guardado"},
        ]

        response = self.client.post("/api/sync_horario", json={"clases": classes})

        self.assertEqual(response.status_code, 200)
        matched = response.get_json()
        self.assertEqual((matched[0]["curso"], matched[0]["seccion"], matched[0]["sala"]),
                         ("Intro al Algebra", "Sección 5", "E306.2.S208"))
        self.assertNotIn("cursoDisplay", matched[0])
        self.assertEqual((matched[1]["curso"], matched[1]["seccion"], matched[1]["sala"]),
                         ("Intro al Algebra", "Sección 3", "E306.1.S101"))
        self.assertEqual((matched[2]["seccion"], matched[2]["sala"]), ("Sección 11", "E306.2.S208"))
        self.assertEqual(matched[3], {**classes[3], "profesor": ""})
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_matches_plural_course_name_from_official_json(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "ARQUITECTURAS EMERGENTES", "day": 3, "start": "17:25:00", "finish": "18:45:00",
            "place": "E441.1.S105", "teacher": "", "section": 2, "code": "CIT3100",
        }}]
        original = {
            "curso": "Arquitectura Emergente", "dia": 3, "horaInicio": "17:25", "horaFin": "18:45",
            "bloqueNum": 7, "seccion": "Sección 2", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        matched = response.get_json()[0]
        self.assertEqual(matched["curso"], "Arquitectura Emergente")
        self.assertNotIn("cursoDisplay", matched)
        self.assertEqual(matched["sala"], "E441.1.S105")
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_preserves_known_course_acronyms_in_official_name(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "EVALUACIÓN DE PROYECTOS TIC", "day": 1, "start": "08:30:00", "finish": "09:50:00",
            "place": "E441.2.S201", "teacher": "DOCENTE", "section": 1, "code": "CIT2207",
        }}]
        original = {
            "curso": "Evaluación de Proyectos TIC", "dia": 1, "horaInicio": "08:30", "horaFin": "09:50",
            "bloqueNum": 1, "seccion": "Sección 1", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["curso"], "Evaluación de Proyectos TIC")
        self.assertNotIn("cursoDisplay", response.get_json()[0])
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_allows_up_to_four_course_name_edits_but_not_more(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "ARQUITECTURAS EMERGENTES", "day": 3, "start": "17:25:00", "finish": "18:45:00",
            "place": "E441.1.S105", "teacher": "", "section": 2, "code": "CIT3100",
        }}]
        classes = [
            {"curso": name, "dia": 3, "horaInicio": "17:25", "horaFin": "18:45", "bloqueNum": 7,
             "seccion": "Sección 2", "sala": "", "profesor": ""}
            for name in ("Arquitectura Emergente", "Arquiteqtura Emerjente", "Arquiqeqtura Emerrjente")
        ]

        response = self.client.post("/api/sync_horario", json={"clases": classes})

        matched = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(matched[0]["sala"], "E441.1.S105")
        self.assertEqual(matched[1]["sala"], "E441.1.S105")
        self.assertEqual(matched[2]["sala"], "")
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_maps_legacy_last_normal_block_to_current_json_time(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "ARQUITECTURAS EMERGENTES", "day": 3, "start": "17:25:00", "finish": "18:45:00",
            "place": "E441.1.S105", "teacher": "", "section": 2, "code": "CIT3100",
        }}]
        legacy_class = {
            "curso": "Arquitectura Emergente", "dia": 3, "horaInicio": "17:30", "horaFin": "18:50",
            "bloqueNum": 7, "seccion": "Sección 2", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [legacy_class]})

        matched = response.get_json()[0]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(matched["sala"], "E441.1.S105")
        self.assertEqual(matched["horaInicio"], "17:25")
        self.assertEqual(matched["horaFin"], "18:45")

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_can_use_teacher_when_course_name_is_missing(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "EVALUACIÓN DE PROYECTOS TIC", "day": 1, "start": "16:00:00", "finish": "17:20:00",
            "place": "E441.3.S302", "teacher": "FAIVOVICH EDUARDO JAIME", "section": 1, "code": "CIT2207",
        }}]
        teacher_only_class = {
            "curso": "", "dia": 1, "horaInicio": "16:00", "horaFin": "17:20", "bloqueNum": 6,
            "seccion": "S1", "sala": "", "profesor": "Faivovich Eduardo Jaime",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [teacher_only_class]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["sala"], "E441.3.S302")

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_can_use_a_unique_section_when_course_and_teacher_are_missing(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "EVALUACIÓN DE PROYECTOS TIC", "day": 1, "start": "16:00:00", "finish": "17:20:00",
            "place": "E441.3.S302", "teacher": "FAIVOVICH EDUARDO JAIME", "section": 1, "code": "CIT2207",
        }}]
        section_only_class = {
            "curso": "", "dia": 1, "horaInicio": "16:00", "horaFin": "17:20", "bloqueNum": 6,
            "seccion": "S1", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [section_only_class]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["sala"], "E441.3.S302")

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_only_queries_json_for_verified_normal_blocks(self, get_classes):
        solemn_and_mismatched_blocks = [
            {
                "curso": "Introduccion a la economia", "dia": 2, "horaInicio": "08:30", "horaFin": "10:30",
                "bloqueNum": 1, "seccion": "1", "sala": "", "profesor": "",
            },
            {
                "curso": "Introduccion a la economia", "dia": 2, "horaInicio": "11:30", "horaFin": "12:50",
                "bloqueNum": 1, "seccion": "1", "sala": "", "profesor": "",
            },
            {
                "curso": "Introduccion a la economia", "dia": 2, "horaInicio": [], "horaFin": "12:50",
                "bloqueNum": 3, "seccion": "1", "sala": "", "profesor": "",
            },
        ]

        response = self.client.post("/api/sync_horario", json={"clases": solemn_and_mismatched_blocks})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), solemn_and_mismatched_blocks)
        get_classes.assert_not_called()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_rejects_a_normal_slot_with_a_mismatched_finish_time(self, get_classes):
        get_classes.return_value = [{"node": {
            "course": "ARQUITECTURAS EMERGENTES", "day": 3, "start": "17:25:00", "finish": "18:45:00",
            "place": "E441.1.S105", "teacher": "", "section": 2, "code": "CIT3100",
        }}]
        stale_class = {
            "curso": "Arquitecturas Emergentes", "dia": 3, "horaInicio": "17:25", "horaFin": "18:50",
            "bloqueNum": 7, "seccion": "Sección 2", "sala": "", "profesor": "",
        }

        response = self.client.post("/api/sync_horario", json={"clases": [stale_class]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [stale_class])
        get_classes.assert_not_called()

    def test_import_requires_signed_in_user(self):
        response = self.client.post("/api/import_schedule")
        self.assertEqual(response.status_code, 401)

    @patch("app.blueprints.academic_api.extract_schedule_from_image")
    @patch("app.blueprints.academic_api.requests.get")
    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_authenticated_upload_returns_canonical_teacher_without_storing_image(self, get_classes, auth_get, extract):
        auth_get.return_value = Mock(ok=True, json=lambda: {"id": "test-user"})
        get_classes.return_value = [{"node": {"teacher": "CALCAGNO JAIME ALBERTO"}}]
        extract.return_value = [{
            "dia": 1, "diaNombre": "Lunes", "horaInicio": "08:30", "horaFin": "09:50",
            "curso": "Cálculo", "tipo": "Cátedra", "seccion": "1", "sala": "E-201",
            "profesor": "Jaime Calcaño", "confianza": 0.95,
        }]
        response = self.client.post(
            "/api/import_schedule",
            headers={"Authorization": "Bearer valid-test-session"},
            data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nimage"), "horario.png", "image/png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["total"], 1)
        self.assertEqual(response.get_json()["clases"][0]["profesor"], "CALCAGNO JAIME ALBERTO")
        self.assertNotIn("image", response.get_json())
        auth_get.assert_called_once()
        extract.assert_called_once()
        self.assertEqual(extract.call_args.args[0], b"\x89PNG\r\n\x1a\nimage")
        self.assertNotIn("course_catalog", extract.call_args.kwargs)

    @patch("app.blueprints.academic_api.extract_schedule_from_image")
    @patch("app.blueprints.academic_api.requests.get")
    @patch("app.blueprints.academic_api.dm.get_classes", return_value=[])
    def test_authenticated_upload_discards_unmatched_gemini_teacher(self, _get_classes, auth_get, extract):
        auth_get.return_value = Mock(ok=True, json=lambda: {"id": "test-user"})
        extract.return_value = [{
            "dia": 1, "diaNombre": "Lunes", "horaInicio": "08:30", "horaFin": "09:50",
            "curso": "Cálculo", "tipo": "Cátedra", "seccion": "1", "sala": "E-201",
            "profesor": "NOMBRE INVENTADO POR OCR", "confianza": 0.95,
        }]

        response = self.client.post(
            "/api/import_schedule",
            headers={"Authorization": "Bearer valid-test-session"},
            data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nimage"), "horario.png", "image/png")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["clases"][0]["profesor"], "")

    @patch("app.blueprints.academic_api.extract_schedule_from_image")
    @patch("app.blueprints.academic_api.requests.get")
    def test_authenticated_upload_rejects_overlapping_classes(self, auth_get, extract):
        auth_get.return_value = Mock(ok=True, json=lambda: {"id": "overlap-test-user"})
        extract.return_value = [
            {"dia": 2, "diaNombre": "Martes", "horaInicio": "10:00", "horaFin": "12:50",
             "curso": "Climate Futures", "tipo": "Cátedra", "seccion": "", "sala": "", "profesor": ""},
            {"dia": 2, "diaNombre": "Martes", "horaInicio": "11:30", "horaFin": "12:50",
             "curso": "Otra clase", "tipo": "Cátedra", "seccion": "", "sala": "", "profesor": ""},
        ]
        response = self.client.post(
            "/api/import_schedule",
            headers={"Authorization": "Bearer valid-test-session"},
            data={"image": (io.BytesIO(b"\x89PNG\r\n\x1a\nimage"), "horario.png", "image/png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("más de una clase en un mismo bloque", response.get_json()["error"])

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
