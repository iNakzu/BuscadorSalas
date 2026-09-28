import json
import os
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("SCHEDULE_CACHE_FILE", os.path.join(tempfile.gettempdir(), "buscadorsalas-test.json"))

from app import create_app
from app.services import schedule


class PortalV1Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app({"TESTING": True})
        cls.client = cls.app.test_client()

    def test_public_pages_and_pwa_assets(self):
        for path in ("/", "/manifest.json", "/sw.js"):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200, path)

    def test_removed_endpoints_are_gone(self):
        for path in ("/api/chat", "/api/tutor", "/api/transcribe", "/api/clima", "/api/transporte", "/api/metro-alertas"):
            self.assertEqual(self.client.get(path).status_code, 404, path)

    def test_only_v1_modules_are_rendered(self):
        html = self.client.get("/").get_data(as_text=True)
        for panel in ("tab-salas", "tab-profes", "tab-ramos", "tab-malla", "tab-horario", "tab-mihorario", "tab-solemnes", "tab-notas", "tab-agenda", "tab-progreso", "tab-estudio", "tab-timer"):
            self.assertIn(f'id="{panel}"', html)
        for removed in ("ai-chat-window", "tab-reloj", "tab-cronometro", "tab-kanban", "tab-gastos", "tab-compras", "tab-notasvoz", "tab-habitos", "tab-riff", "tab-transporte", "tab-clima"):
            self.assertNotIn(removed, html)

    def test_schedule_api_contract(self):
        response = self.client.get("/api/salas?dia=1&hora=8:30:00&facultad=INGENIERIA")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertIn("vacias", body)
        self.assertIn("ocupadas", body)
        self.assertEqual(body["dia"], 1)

    def test_search_rejects_empty_query_cleanly(self):
        response = self.client.get("/api/search")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cursos"], [])


if __name__ == "__main__":
    unittest.main()
