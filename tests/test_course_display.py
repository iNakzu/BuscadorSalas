import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.course_display import fallback_course_display, format_course_names


class CourseDisplayTest(unittest.TestCase):
    def test_fallback_title_casing_handles_connectors_and_accents(self):
        self.assertEqual(
            fallback_course_display("CÁLCULO DIFERENCIAL E INTEGRAL"),
            "Cálculo Diferencial e Integral",
        )
        self.assertEqual(
            fallback_course_display("EVALUACIÓN DE PROYECTOS TIC"),
            "Evaluación de Proyectos TIC",
        )
        self.assertEqual(
            fallback_course_display("LA BIOGRAFÍA:INVENCION DE SÍ MISMO"),
            "La Biografía: Invencion de sí Mismo",
        )

    def test_ai_display_normalizes_colon_spacing_and_common_word_si(self):
        with tempfile.TemporaryDirectory() as directory:
            response = {
                "candidates": [{"content": {"parts": [{"text": json.dumps({"items": [
                    {"index": 0, "display_name": "La biografía:invención de SÍ mismo"}
                ]})}]}}]
            }
            with patch("app.services.course_display.requests.post") as post:
                post.return_value.ok = True
                post.return_value.json.return_value = response
                name = "LA BIOGRAFÍA:INVENCION DE SÍ MISMO"
                result = format_course_names([name], "key", "model", str(Path(directory) / "cache.sqlite3"))

            self.assertEqual(result[name], "La Biografía: Invención de sí mismo")
            prompt = post.call_args.kwargs["json"]["contents"][0]["parts"][0]["text"]
            self.assertIn("solo por ser corta", prompt)
            self.assertIn("invención de sí mismo", prompt)

    def test_ai_display_is_cached_and_original_names_remain_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            cache_path = str(Path(directory) / "ratelimit.sqlite3")
            response = {
                "candidates": [{"content": {"parts": [{"text": json.dumps({"items": [
                    {"index": 0, "display_name": "Evaluación de Proyectos TIC"}
                ]})}]}}]
            }
            with patch("app.services.course_display.requests.post") as post:
                post.return_value.ok = True
                post.return_value.json.return_value = response
                names = ["EVALUACIÓN DE PROYECTOS TIC"]
                first = format_course_names(names, "server-only-key", "gemini-test", cache_path)
                second = format_course_names(names, "server-only-key", "gemini-test", cache_path)

            self.assertEqual(first, {names[0]: "Evaluación de Proyectos TIC"})
            self.assertEqual(second, first)
            post.assert_called_once()
            request = post.call_args.kwargs
            self.assertEqual(request["headers"]["x-goog-api-key"], "server-only-key")
            self.assertNotIn("key=", post.call_args.args[0])

    def test_ai_cannot_change_or_reorder_official_course_words(self):
        with tempfile.TemporaryDirectory() as directory:
            response = {
                "candidates": [{"content": {"parts": [{"text": json.dumps({"items": [
                    {"index": 0, "display_name": "TIC Proyectos Evaluación"}
                ]})}]}}]
            }
            with patch("app.services.course_display.requests.post") as post:
                post.return_value.ok = True
                post.return_value.json.return_value = response
                actual = format_course_names(
                    ["EVALUACIÓN DE PROYECTOS TIC"], "key", "model", str(Path(directory) / "cache.sqlite3")
                )
            self.assertEqual(actual["EVALUACIÓN DE PROYECTOS TIC"], "Evaluación de Proyectos TIC")


if __name__ == "__main__":
    unittest.main()
