import json
import unittest
from pathlib import Path
from unittest.mock import patch

from app import create_app
from app.services.curricula import get_curriculum, get_program, get_programs, get_visual_curriculum
from app.services.schedule import obtener_clases_malla


class CurriculumCatalogTests(unittest.TestCase):
    def test_program_catalog_has_expected_school_assignments(self):
        programs = {program["id"]: program for program in get_programs()}
        self.assertEqual(set(programs), {
            "ingenieria-civil-industrial",
            "ingenieria-civil-en-obras-civiles",
            "ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial",
            "ingenieria-civil-en-informatica-y-telecomunicaciones",
            "ingenieria-civil-plan-comun",
        })
        self.assertEqual(programs["ingenieria-civil-industrial"]["school"], "EII")
        self.assertEqual(programs["ingenieria-civil-en-obras-civiles"]["school"], "EOC")
        self.assertEqual(programs["ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial"]["school"], "EIT")
        self.assertEqual(programs["ingenieria-civil-en-informatica-y-telecomunicaciones"]["school"], "EIT")
        common = programs["ingenieria-civil-plan-comun"]
        self.assertIsNone(common["school"])
        self.assertEqual(common["durationYears"], 1)

    def test_curricula_are_scoped_by_career_and_current_informatics_data_loads(self):
        informatics_id = "ingenieria-civil-en-informatica-y-telecomunicaciones"
        curriculum = get_curriculum(informatics_id)
        self.assertEqual(len(curriculum), 11)
        self.assertEqual(curriculum[8]["ramos"][0]["nombre"], "Introducción a la Economía")
        self.assertIsNone(get_curriculum("../../outside"))
        industrial = get_curriculum("ingenieria-civil-industrial")
        self.assertEqual(len(industrial), 10)
        self.assertEqual(industrial[2]["ramos"][2]["nombre"], "Mecánica")
        self.assertIn("id", industrial[2]["ramos"][2])
        self.assertIn("requisitos", industrial[2]["ramos"][2])

    def test_schedule_by_semester_endpoint_uses_each_loaded_program_malla(self):
        client = create_app({"TESTING": True}).test_client()
        self.assertEqual(client.get("/api/malla").status_code, 400)
        industrial = client.get("/api/malla?carrera=ingenieria-civil-industrial&semestre=2")
        self.assertEqual(industrial.status_code, 200)
        self.assertTrue(industrial.json["disponible"])
        self.assertEqual(industrial.json["carrera"], "Ingeniería Civil Industrial")
        self.assertEqual(len(industrial.json["semestres_disponibles"]), 10)
        self.assertIn("Mecánica", industrial.json["ramos_del_semestre"])
        self.assertIn("MECÁNICA", {item["curso_oficial"] for item in industrial.json["clases"]})
        self.assertNotIn("MECÁNICA DE FLUIDOS", {item["curso_oficial"] for item in industrial.json["clases"]})
        informatics = client.get("/api/malla?carrera=ingenieria-civil-en-informatica-y-telecomunicaciones&semestre=8")
        self.assertEqual(informatics.status_code, 200)
        self.assertTrue(informatics.json["disponible"])
        self.assertEqual(informatics.json["carrera"], "Ingeniería Civil en Informática y Telecomunicaciones")
        self.assertEqual(informatics.json["ramos_del_semestre"][0], "Introducción a la Economía")

        for career_id, semester_count in (
            ("ingenieria-civil-en-obras-civiles", 11),
            ("ingenieria-civil-plan-comun", 2),
        ):
            with self.subTest(career_id=career_id):
                response = client.get(f"/api/malla?carrera={career_id}&semestre=1")
                self.assertTrue(response.json["disponible"])
                self.assertEqual(len(response.json["semestres_disponibles"]), semester_count)

    def test_semester_search_matches_full_course_titles_only(self):
        curriculum = get_curriculum("ingenieria-civil-industrial")
        classes = [
            {"node": {"course": "MECÁNICA", "place": "E441.1.S101", "section": 1,
                       "day": 1, "start": "08:30", "finish": "09:50", "code": "CBF1000",
                       "teacher": "DOCENTE"}},
            {"node": {"course": "MECÁNICA DE FLUIDOS", "place": "E441.1.S102", "section": 1,
                       "day": 2, "start": "10:00", "finish": "11:20", "code": "CII2401",
                       "teacher": "DOCENTE"}},
            {"node": {"course": "MECÁNICA DE SÓLIDOS", "place": "E441.1.S103", "section": 1,
                       "day": 3, "start": "11:30", "finish": "12:50", "code": "COC",
                       "teacher": "DOCENTE"}},
        ]
        with patch("app.services.schedule.dm.get_classes", return_value=classes):
            result = obtener_clases_malla(2, curriculum=curriculum)
        self.assertEqual([item["curso_oficial"] for item in result], ["MECÁNICA"])
        self.assertEqual([item["ramo_malla"] for item in result], ["Mecánica"])

    def test_progress_curricula_preserve_source_course_counts_and_prerequisites(self):
        industrial = get_visual_curriculum("ingenieria-civil-industrial")
        obras = get_visual_curriculum("ingenieria-civil-en-obras-civiles")
        plan_comun = get_visual_curriculum("ingenieria-civil-plan-comun")
        informatics = get_visual_curriculum("ingenieria-civil-en-informatica-y-telecomunicaciones")
        self.assertEqual([len(s["cursos"]) for s in industrial], [5, 5, 6, 7, 6, 5, 5, 5, 6, 5])
        self.assertEqual(sum(len(s["cursos"]) for s in obras), 56)
        self.assertEqual([len(s["cursos"]) for s in obras], [5, 5, 6, 6, 6, 6, 5, 6, 5, 5, 1])
        self.assertEqual([len(s["cursos"]) for s in plan_comun], [5, 5])
        self.assertEqual(sum(len(s["cursos"]) for s in informatics), 57)
        industrial_courses = {course["id"]: course for sem in industrial for course in sem["cursos"]}
        self.assertEqual((industrial_courses["9"]["codigo"], industrial_courses["9"]["nombre"],
                          industrial_courses["9"]["requisitos"]),
                         ("CIT-1010", "Programación Avanzada", ["4"]))
        self.assertEqual(industrial_courses["5"]["color"], "248, 250, 252")
        self.assertEqual(industrial_courses["45"]["color"], "125, 211, 252")
        self.assertEqual(industrial_courses["19"]["requisitos"], ["11", "12"])
        self.assertEqual(industrial_courses["55"]["codigo"], "CII-3102")
        obras_courses = {course["id"]: course for sem in obras for course in sem["cursos"]}
        obras_semesters = {course["id"]: sem["numero"] for sem in obras for course in sem["cursos"]}
        self.assertEqual(obras_courses["25"]["codigo"], "COC-20012")
        self.assertEqual(obras_courses["45"]["requisitos"], ["40", "41", "42", "43", "44"])
        self.assertEqual((obras_semesters["28"], obras_semesters["29"]), (5, 6))
        self.assertEqual(obras_courses["48"]["color"], "125, 211, 252")
        cfg_courses = [course for sem in industrial + obras for course in sem["cursos"]
                       if course["codigo"].startswith("CFG-")]
        self.assertTrue(cfg_courses)
        self.assertTrue(all(course["nombre"] == "Curso de Formación General" for course in cfg_courses))
        self.assertTrue(all("creditos" not in course for sem in industrial + obras for course in sem["cursos"]))

    def test_each_loaded_course_is_stored_once_and_both_views_derive_from_it(self):
        loaded_programs = (
            "ingenieria-civil-en-informatica-y-telecomunicaciones",
            "ingenieria-civil-industrial",
            "ingenieria-civil-en-obras-civiles",
            "ingenieria-civil-plan-comun",
        )
        for career_id in loaded_programs:
            with self.subTest(career_id=career_id):
                program = get_program(career_id)
                raw = json.loads((Path("app/data/curricula") / program["curriculumFile"]).read_text(encoding="utf-8"))
                self.assertEqual(raw["version"], 2)
                self.assertNotIn("mallaVisual", raw)
                canonical = get_curriculum(career_id)
                visual = get_visual_curriculum(career_id)
                self.assertEqual(len(canonical), len(visual))
                for semester in visual:
                    courses = canonical[semester["numero"]]["ramos"]
                    self.assertEqual(
                        [course["id"] for course in courses],
                        [course["id"] for course in semester["cursos"]],
                    )
                    self.assertTrue(all(isinstance(course.get("keywords"), list) for course in courses))

    def test_progress_malla_endpoint_is_separate_from_schedule_search_catalog(self):
        client = create_app({"TESTING": True}).test_client()
        result = client.get("/api/malla/progreso/ingenieria-civil-plan-comun")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["carrera"], "Ingeniería Civil Plan Común")
        self.assertEqual(len(result.json["semestres"]), 2)
        self.assertEqual(result.json["semestres"][0]["cursos"][0]["nombre"], "Álgebra y Geometría")
        self.assertEqual(result.json["semestres"][1]["cursos"][3]["nombre"],
                         "Programación Avanzada o Ingeniería de los Materiales")
        self.assertEqual(client.get("/api/malla/progreso/not-a-career").status_code, 404)

    def test_data_science_visual_curriculum_is_unavailable_until_its_source_is_added(self):
        client = create_app({"TESTING": True}).test_client()
        result = client.get("/api/malla/progreso/ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["carrera"], "Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial")
        self.assertEqual(result.json["semestres"], [])

    def test_visual_curricula_are_available_for_loaded_programs(self):
        for career_id in (
            "ingenieria-civil-industrial",
            "ingenieria-civil-en-obras-civiles",
            "ingenieria-civil-plan-comun",
        ):
            with self.subTest(career_id=career_id):
                self.assertTrue(get_visual_curriculum(career_id))

    def test_loaded_curricula_share_the_informatics_color_palette(self):
        palette = {
            "203, 213, 225", "134, 239, 172", "125, 211, 252",
            "56, 189, 248", "248, 250, 252",
        }
        loaded_programs = (
            "ingenieria-civil-en-informatica-y-telecomunicaciones",
            "ingenieria-civil-industrial",
            "ingenieria-civil-en-obras-civiles",
            "ingenieria-civil-plan-comun",
        )
        by_program = {}
        for career_id in loaded_programs:
            courses = [course for semester in get_visual_curriculum(career_id)
                       for course in semester["cursos"]]
            by_program[career_id] = courses
            self.assertTrue(all(course.get("color") in palette for course in courses), career_id)
            self.assertTrue(all("border" not in course for course in courses), career_id)

        informatics_colors = {
            course["nombre"]: course["color"]
            for course in by_program["ingenieria-civil-en-informatica-y-telecomunicaciones"]
        }
        for career_id in loaded_programs[1:]:
            for course in by_program[career_id]:
                if course["nombre"] in informatics_colors:
                    self.assertEqual(course["color"], informatics_colors[course["nombre"]],
                                     f"{career_id}: {course['nombre']}")


if __name__ == "__main__":
    unittest.main()
