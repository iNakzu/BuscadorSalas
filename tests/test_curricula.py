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

    def test_visual_mallas_are_available_for_loaded_careers_and_data_science_is_not(self):
        expected = {
            "ingenieria-civil-industrial": 10,
            "ingenieria-civil-en-obras-civiles": 11,
            "ingenieria-civil-plan-comun": 2,
            "ingenieria-civil-en-informatica-y-telecomunicaciones": 11,
        }
        for career_id, semester_count in expected.items():
            with self.subTest(career=career_id):
                semesters = get_visual_curriculum(career_id)
                self.assertEqual(len(semesters), semester_count)
                self.assertGreater(sum(len(item["cursos"]) for item in semesters), 0)

        data_science_id = "ingenieria-civil-en-ciencia-de-datos-e-inteligencia-artificial"
        self.assertIn(get_visual_curriculum(data_science_id), (None, []))
        client = create_app({"TESTING": True}).test_client()
        for career_id in expected:
            response = client.get(f"/api/malla/progreso/{career_id}")
            self.assertTrue(response.json["disponible"], career_id)
        response = client.get(f"/api/malla/progreso/{data_science_id}")
        self.assertFalse(response.json["disponible"])
        self.assertEqual(response.json["semestres"], [])


if __name__ == "__main__":
    unittest.main()
