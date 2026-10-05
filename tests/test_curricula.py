import json
import unittest
from pathlib import Path

from app import create_app
from app.services.curricula import get_curriculum, get_program, get_programs


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


if __name__ == "__main__":
    unittest.main()
