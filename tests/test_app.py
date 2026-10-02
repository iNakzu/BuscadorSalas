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

    def test_notes_course_selector_has_no_outer_card(self):
        notes = Path("templates/views/notas.html").read_text()
        self.assertIn('class="notas-controls-shell"', notes)
        self.assertNotIn('class="control-card"', notes)
        self.assertIn('id="dd-notas-curso"', notes)

    def test_solemnes_course_search_has_no_outer_card(self):
        solemnes = Path("templates/views/solemnes.html").read_text()
        self.assertNotIn('class="control-card"', solemnes)
        self.assertIn('id="solemnes-search"', solemnes)

    def test_teacher_course_and_semester_results_show_time_without_day(self):
        app_js = Path("static/js/app.js").read_text()
        self.assertIn('${escapeAppHtml(p.hora_inicio)} - ${escapeAppHtml(p.hora_termino)}', app_js)
        self.assertIn('${escapeAppHtml(r.hora_inicio)} - ${escapeAppHtml(r.hora_termino)}', app_js)
        self.assertIn('${escapeAppHtml(c.hora_inicio)} - ${escapeAppHtml(c.hora_termino)}', app_js)
        self.assertNotIn('${p.dia} ${p.hora_inicio}', app_js)
        self.assertNotIn('${r.dia} ${r.hora_inicio}', app_js)
        self.assertNotIn('${c.dia} ${c.hora_inicio}', app_js)

    def test_schedule_api_contract(self):
        response = self.client.get("/api/salas?dia=1&hora=8:30:00&facultad=INGENIERIA")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertIn("vacias", body)
        self.assertIn("ocupadas", body)
        self.assertEqual(body["dia"], 1)

    def test_solemn_room_availability_counts_every_room_in_a_multi_room_class(self):
        classes = [{"node": {
            "day": "5",
            "start": "08:30",
            "finish": "10:30",
            "place": "E441.4.S402, E441.4.S403",
            "section": "6, 7",
            "course": "Probabilidades y Estadística",
            "teacher": "Profesora Ejemplo",
            "code": "MAT123",
        }}]

        with patch.object(schedule.dm, "get_classes", return_value=classes):
            free, occupied, _ = schedule.obtener_salas(5, "08:30:00_S", "INGENIERIA")

        self.assertEqual(set(occupied), {"E441.4.S402", "E441.4.S403"})
        self.assertFalse(set(occupied).intersection(free))
        for room in occupied.values():
            self.assertEqual(room["curso"], "Probabilidades y Estadística")
            self.assertEqual(room["profe"], "Profesora Ejemplo")

    def test_last_standard_block_uses_fixed_1730_to_1850_window(self):
        last_normal = next(block for block in schedule.STANDARD_BLOCKS if block["id"] == "17:30:00")
        self.assertEqual(last_normal["label"], "17:30 - 18:50")
        self.assertEqual(last_normal["start"], "17:30:00")
        self.assertEqual(last_normal["finish"], "18:50:00")

    def test_teacher_search_splits_each_room_and_section_into_its_own_result(self):
        classes = [
            {"node": {
                "teacher": "PROFESORA EJEMPLO", "day": 2, "start": "10:00", "finish": "11:20",
                "place": "E441.1.S101, E441.1.S102, E441.1.S103", "section": "1, 2 y 3",
                "course": "Ramo agrupado", "code": "ABC123"
            }},
            {"node": {
                "teacher": "PROFESORA EJEMPLO", "day": 2, "start": "13:00", "finish": "14:20",
                "place": "E441.2.S201", "section": "4, 5", "course": "Ramo con secciones", "code": "DEF456"
            }},
            {"node": {
                "teacher": "PROFESORA EJEMPLO", "day": 3, "start": "08:30", "finish": "09:50",
                "place": "E441.3.S301, E441.3.S302", "section": "6, 7, 8", "course": "Ramo con asignación ambigua", "code": "GHI789"
            }}
        ]
        with patch.object(schedule.dm, "get_classes", return_value=classes):
            results = schedule.buscar_profesor("profesora ejemplo")

        self.assertCountEqual(
            [(item["sala"], item["seccion"]) for item in results],
            [
                ("E441.1.S101", "1"), ("E441.1.S102", "2"), ("E441.1.S103", "3"),
                ("E441.2.S201", "4"), ("E441.2.S201", "5"),
                ("E441.3.S301", "6"), ("E441.3.S301", "7"), ("E441.3.S301", "8"),
                ("E441.3.S302", "6"), ("E441.3.S302", "7"), ("E441.3.S302", "8")
            ]
        )
        self.assertTrue(all("," not in item["sala"] and "," not in item["seccion"] and " y " not in item["seccion"] for item in results))

    def test_search_rejects_empty_query_cleanly(self):
        response = self.client.get("/api/search")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cursos"], [])

    def test_service_worker_excludes_private_network_data(self):
        with self.client.get("/sw.js") as response:
            worker = response.get_data(as_text=True)
        self.assertIn("url.pathname.startsWith('/api/')", worker)
        self.assertIn("url.pathname.includes('/auth/')", worker)
        self.assertIn("if (url.search)", worker)
        self.assertIn("portal-estudiantil-v1-core-9", worker)
        self.assertLess(worker.index("response.clone()"), worker.index("caches.open(CACHE_NAME).then(cache => cache.put"))

    def test_nginx_api_rate_limit_is_wired_before_validation(self):
        zone = Path("nginx_api_limits.conf").read_text()
        site = Path("nginx_buscadorsalas.conf").read_text()
        workflow = Path(".github/workflows/deploy.yml").read_text()
        self.assertIn("zone=buscador_api_per_ip:10m rate=15r/s", zone)
        self.assertIn("limit_req zone=buscador_api_per_ip burst=60 nodelay", site)
        self.assertIn("limit_req_status 429", site)
        self.assertLess(
            workflow.index("cp nginx_api_limits.conf /etc/nginx/conf.d/"),
            workflow.index("sudo nginx -t && sudo systemctl reload nginx"),
        )

    def test_supabase_browser_sdk_is_version_and_integrity_pinned(self):
        template = Path(__file__).parents[1] / "templates/index.html"
        html = template.read_text()
        self.assertIn("@supabase/supabase-js@2.117.2", html)
        self.assertIn("integrity=\"sha384-WgXwGL6fUsYJWNaKJgVbrJKGRQwc1vieh2oy4kw9nXqpNDz3tdSsqEYUgeHD/NuF\"", html)
        self.assertNotIn("@supabase/supabase-js@2\"", html)

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
        self.assertNotIn('id="community-schedules-list"', html)
        self.assertNotIn('Personas de la comunidad', html)
        self.assertIn('id="schedule-import-button"', html)
        self.assertIn('id="schedule-import-file"', html)
        self.assertNotIn('id="schedule-import-preview"', html)
        self.assertIn('data-tab="tab-mihorario" data-private="true"', html)
        self.assertNotIn('id="share-schedule-toggle"', html)
        schedule_defaults = Path(__file__).parents[1] / "static/js/user_schedule_data.js"
        self.assertIn("clases: []", schedule_defaults.read_text())
        horario_js = Path(__file__).parents[1] / "static/js/horario.js"
        self.assertNotIn("mar-1", horario_js.read_text())

    def test_public_information_migration_shares_all_personal_modules(self):
        migration = Path(__file__).parents[1] / "supabase/migrations/202609290002_public_information.sql"
        sql = migration.read_text()
        self.assertIn("rename column share_schedule to share_information", sql)
        self.assertIn("create or replace function public.get_shared_information()", sql)
        self.assertIn("'schedule'", sql)
        self.assertIn("'grades'", sql)
        self.assertIn("'agenda'", sql)
        self.assertIn("'curriculum'", sql)
        self.assertIn("and p.share_information", sql)
        self.assertIn("and public.is_community_member(auth.uid())", sql)
        self.assertIn("grant execute on function public.get_shared_information() to authenticated", sql)
        self.assertNotIn("to anon", sql.split("grant execute on function public.get_shared_information()", 1)[1])

    def test_shared_profile_search_is_paged_and_authorized(self):
        migration = Path(__file__).parents[1] / "supabase/migrations/202609290003_searchable_shared_profiles.sql"
        sql = migration.read_text()
        self.assertIn("create or replace function public.search_shared_profiles(", sql)
        self.assertIn("limit least(greatest(coalesce(p_limit, 41), 1), 101)", sql)
        self.assertIn("'%' || replace(replace(replace(lower(trim(p_query))", sql)
        self.assertIn("public.is_community_member(auth.uid())", sql)
        self.assertIn("public.is_community_member(p.id)", sql)
        self.assertIn("create or replace function public.get_shared_profile_information(p_user_id uuid)", sql)
        self.assertIn("grant execute on function public.search_shared_profiles(text, integer, integer) to authenticated", sql)
        self.assertNotIn("to anon", sql)

    def test_signed_in_profile_uses_initials_instead_of_a_photo(self):
        html = self.client.get("/").get_data(as_text=True)
        profile = html.split('id="auth-profile"', 1)[1].split("</div>", 1)[0]
        self.assertIn('id="auth-avatar"', profile)
        self.assertIn('id="auth-name"', profile)
        self.assertIn('id="auth-email"', profile)
        self.assertNotIn("<img", profile)


if __name__ == "__main__":
    unittest.main()
