import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from app import create_app


class AITimeContextTests(unittest.TestCase):
    def test_chat_supplies_santiago_time_and_personal_schedule_to_gemini(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            app = create_app({
                "TESTING": True,
                "GEMINI_API_KEY": "test-key",
                "RATE_LIMIT_DB": str(Path(temp_dir) / "rate-limit.sqlite3"),
            })
            gemini_response = Mock(ok=True)
            gemini_response.json.return_value = {
                "candidates": [{"content": {"parts": [{"text": "Tienes clase ahora."}]}}]
            }
            with patch("app.blueprints.academic_api._consume_rate_limit", return_value=(True, 0)), \
                 patch("app.blueprints.academic_api.requests.post", return_value=gemini_response) as send_to_gemini:
                response = app.test_client().post("/api/chat", json={
                    "message": "¿Qué tengo ahora?",
                    "context": {"horario": [{
                        "asignatura": "Cálculo", "dia": "Lunes", "hora": "08:30", "termino": "09:50",
                    }]},
                })

        self.assertEqual(response.status_code, 200)
        request_payload = send_to_gemini.call_args.kwargs["json"]
        system_text = request_payload["systemInstruction"]["parts"][0]["text"]
        self.assertIn("America/Santiago", system_text)
        self.assertIn("clase en curso", system_text)
        context_text = request_payload["contents"][0]["parts"][0]["text"]
        context = json.loads(context_text.split("\n", 1)[1])
        self.assertEqual(context["momento_actual"]["ubicacion"], "Santiago, Chile")
        self.assertEqual(context["momento_actual"]["zona_horaria"], "America/Santiago")
        self.assertRegex(context["momento_actual"]["fecha"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertRegex(context["momento_actual"]["hora"], r"^\d{2}:\d{2}$")
        self.assertTrue(context["momento_actual"]["dia_semana"])
        self.assertEqual(context["horario"][0]["asignatura"], "Cálculo")


if __name__ == "__main__":
    unittest.main()
