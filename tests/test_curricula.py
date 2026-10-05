import json
import unittest
from pathlib import Path

from app import create_app
from app.services.curricula import get_curriculum, get_program, get_programs, get_visual_curriculum


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
        self.assertEqual(industrial, {})

    def test_malla_endpoint_requires_career_and_does_not_show_informatics_for_other_program(self):
        client = create_app({"TESTING": True}).test_client()
        self.assertEqual(client.get("/api/malla").status_code, 400)
        industrial = client.get("/api/malla?carrera=ingenieria-civil-industrial")
        self.assertEqual(industrial.status_code, 200)
        self.assertFalse(industrial.json["disponible"])
        self.assertEqual(industrial.json["carrera"], "Ingeniería Civil Industrial")
        self.assertEqual(industrial.json["clases"], [])
        informatics = client.get("/api/malla?carrera=ingenieria-civil-en-informatica-y-telecomunicaciones&semestre=8")
        self.assertEqual(informatics.status_code, 200)
        self.assertTrue(informatics.json["disponible"])
        self.assertEqual(informatics.json["carrera"], "Ingeniería Civil en Informática y Telecomunicaciones")
        self.assertEqual(informatics.json["ramos_del_semestre"][0], "Introducción a la Economía")

    def test_progress_curricula_preserve_source_course_counts_and_prerequisites(self):
        industrial = get_visual_curriculum("ingenieria-civil-industrial")
        obras = get_visual_curriculum("ingenieria-civil-en-obras-civiles")
        plan_comun = get_visual_curriculum("ingenieria-civil-plan-comun")
        informatics = get_visual_curriculum("ingenieria-civil-en-informatica-y-telecomunicaciones")
        self.assertEqual([len(s["cursos"]) for s in industrial], [5, 5, 6, 7, 6, 5, 5, 5, 6, 5])
        self.assertEqual(sum(len(s["cursos"]) for s in obras), 56)
        self.assertEqual([len(s["cursos"]) for s in plan_comun], [5, 5])
        self.assertEqual(sum(len(s["cursos"]) for s in informatics), 57)
        industrial_courses = {course["id"]: course for sem in industrial for course in sem["cursos"]}
        self.assertEqual(industrial_courses["19"]["requisitos"], ["11", "12"])
        self.assertEqual(industrial_courses["55"]["codigo"], "CII-3102")
        obras_courses = {course["id"]: course for sem in obras for course in sem["cursos"]}
        self.assertEqual(obras_courses["25"]["codigo"], "COC-20012")
        self.assertEqual(obras_courses["45"]["requisitos"], ["40", "41", "42", "43", "44"])
        cfg_courses = [course for sem in industrial + obras for course in sem["cursos"]
                       if course["codigo"].startswith("CFG-")]
        self.assertTrue(cfg_courses)
        self.assertTrue(all(course["nombre"] == "Curso de Formación General" for course in cfg_courses))
        self.assertTrue(all("creditos" not in course for sem in industrial + obras for course in sem["cursos"]))

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


if __name__ == "__main__":
    unittest.main()
