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
        self.assertEqual(classes[0]["profesor"], "PROF. ROJAS")
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
        self.assertEqual(matched["curso"], "Introducción a la Economía")
        self.assertEqual(matched["sala"], "E441.2.S201")
        self.assertEqual(matched["profesor"], "CALCAGNO JAIME ALBERTO")
        self.assertEqual(matched["seccion"], "Sección 1")
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
        self.assertEqual(response.get_json(), [original])
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
        self.assertEqual(matched["curso"], "Introducción a la Economía")
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
                         ("Introducción al Álgebra", "Sección 5", "E306.2.S208"))
        self.assertEqual((matched[1]["curso"], matched[1]["seccion"], matched[1]["sala"]),
                         ("Introducción al Álgebra", "Sección 3", "E306.1.S101"))
        self.assertEqual((matched[2]["seccion"], matched[2]["sala"]), ("Sección 11", "E306.2.S208"))
        self.assertEqual(matched[3], classes[3])
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
        self.assertEqual(matched["curso"], "Arquitecturas Emergentes")
        self.assertEqual(matched["sala"], "E441.1.S105")
        get_classes.assert_called_once()

    @patch("app.blueprints.academic_api.dm.get_classes")
    def test_schedule_sync_matches_architecture_organiz_abbreviation_only_for_that_course(self, get_classes):
        from app.blueprints.academic_api import _course_name_distance

        full_name = "Arquitectura y Organización de Computadores"
        official_name = "ARQUITECTURA Y ORGANIZ DE COMPUTADORES"
        get_classes.return_value = [
            {"node": {
                "course": official_name, "day": 3, "start": "13:00:00", "finish": "14:20:00",
                "place": "E441.2.S201", "teacher": "DOCENTE OFICIAL", "section": 3, "code": "CIT3101",
            }},
            {"node": {
                "course": "ARQUITECTURA Y ORGANIZACIÓN DE SISTEMAS", "day": 3, "start": "13:00:00", "finish": "14:20:00",
                "place": "E441.2.S205", "teacher": "OTRO DOCENTE", "section": 3, "code": "CIT3999",
            }},
        ]
        original = {
            "curso": full_name, "dia": 3, "horaInicio": "13:00", "horaFin": "14:20",
            "bloqueNum": 4, "seccion": "Sección 3", "sala": "", "profesor": "",
        }

        self.assertEqual(_course_name_distance(full_name, official_name), 0)
        self.assertIsNone(_course_name_distance(full_name, "ARQUITECTURA Y ORGANIZACIÓN DE SISTEMAS"))
        response = self.client.post("/api/sync_horario", json={"clases": [original]})

        self.assertEqual(response.status_code, 200)
        matched = response.get_json()[0]
        self.assertEqual(matched["curso"], full_name, "matching the JSON abbreviation must preserve the user's full course title")
        self.assertEqual(matched["sala"], "E441.2.S201")
        self.assertEqual(matched["profesor"], "DOCENTE OFICIAL")
        self.assertEqual(matched["seccion"], "Sección 3")
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
        unverified_blocks = [
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
            {
                "curso": "Introduccion a la economia", "dia": 2, "horaInicio": [], "horaFin": "12:50",
                "bloqueNum": 3, "seccion": "1", "sala": "", "profesor": "",
            },
        ]
        response = self.client.post("/api/sync_horario", json={"clases": unverified_blocks})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), unverified_blocks)
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
    @patch("app.blueprints.academic_api.dm.get_classes", return_value=[])
    def test_authenticated_upload_discards_unmatched_teacher_without_storing_image(self, _get_classes, auth_get, extract):
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
        self.assertEqual(response.get_json()["clases"][0]["profesor"], "")
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
