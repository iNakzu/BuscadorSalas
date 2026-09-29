import json
import os
import tempfile
import unittest
from pathlib import Path
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
                if path == "/":
                    self.assertNotIn("Portal Estudiantil UDP", response.get_data(as_text=True))
                if path == "/manifest.json":
                    self.assertNotIn("UDP", response.get_data(as_text=True))

    def test_removed_endpoints_are_gone(self):
        for path in ("/api/chat", "/api/tutor", "/api/transcribe", "/api/clima", "/api/transporte", "/api/metro-alertas"):
            self.assertEqual(self.client.get(path).status_code, 404, path)

    def test_only_v1_modules_are_rendered(self):
        html = self.client.get("/").get_data(as_text=True)
        for panel in ("tab-salas", "tab-profes", "tab-ramos", "tab-malla", "tab-horario", "tab-mihorario", "tab-solemnes", "tab-notas", "tab-agenda", "tab-progreso", "tab-estudio", "tab-timer"):
            self.assertIn(f'id="{panel}"', html)
        self.assertIn('data-tab="tab-solemnes" data-private="true"', html)
        self.assertIn('id="btn-clear-cache"', html)
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

    def test_service_worker_excludes_private_network_data(self):
        with self.client.get("/sw.js") as response:
            worker = response.get_data(as_text=True)
        self.assertIn("url.pathname.startsWith('/api/')", worker)
        self.assertIn("url.pathname.includes('/auth/')", worker)
        self.assertLess(worker.index("response.clone()"), worker.index("caches.open(CACHE_NAME).then(cache => cache.put"))

    def test_supabase_migration_uses_explicit_grants_and_rls(self):
        migration = Path(__file__).parents[1] / "supabase/migrations/202609280001_v1_personal_data.sql"
        sql = migration.read_text()
        self.assertIn("alter table public.user_module_state enable row level security", sql)
        self.assertIn("grant select, insert, update, delete on table public.user_module_state to authenticated", sql)
        self.assertIn("grant usage on schema public to supabase_auth_admin", sql)
        self.assertIn("create policy \"auth hook reads signup allowlist\"", sql)
        self.assertNotIn("grant select, insert, update, delete on table public.user_module_state to anon", sql)
        self.assertNotIn("avatar_url", sql)
        self.assertIn("share_schedule boolean not null default true", sql)
        self.assertIn("create or replace function public.get_shared_schedules()", sql)
        self.assertIn("create or replace function public.is_community_member(account_id uuid)", sql)
        self.assertIn("s.module_key = 'schedule'", sql)
        self.assertIn("'sala', item.class_data -> 'sala'", sql)
        self.assertIn("revoke all on function public.get_shared_schedules() from public, anon", sql)
        self.assertIn("and public.is_community_member(p.id)", sql)
        self.assertIn("grant select (id, display_name, share_schedule) on table public.profiles to authenticated", sql)

    def test_shared_schedule_directory_requires_auth_and_has_no_visibility_toggle(self):
        html = self.client.get("/").get_data(as_text=True)
        self.assertIn('id="community-schedules-list"', html)
        self.assertIn('id="schedule-import-button"', html)
        self.assertIn('id="schedule-import-file"', html)
        self.assertNotIn('id="schedule-import-preview"', html)
        self.assertIn('data-tab="tab-mihorario" data-private="true"', html)
        self.assertNotIn('id="share-schedule-toggle"', html)
        schedule_defaults = Path(__file__).parents[1] / "static/js/user_schedule_data.js"
        self.assertIn("clases: []", schedule_defaults.read_text())
        horario_js = Path(__file__).parents[1] / "static/js/horario.js"
        self.assertNotIn("mar-1", horario_js.read_text())

    def test_signed_in_profile_uses_initials_instead_of_a_photo(self):
        html = self.client.get("/").get_data(as_text=True)
        profile = html.split('id="auth-profile"', 1)[1].split("</div>", 1)[0]
        self.assertIn('id="auth-avatar"', profile)
        self.assertIn('id="auth-name"', profile)
        self.assertIn('id="auth-email"', profile)
        self.assertNotIn("<img", profile)


if __name__ == "__main__":
    unittest.main()
