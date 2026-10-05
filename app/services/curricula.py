"""Load the versioned, per-program curriculum catalog."""
import json
from functools import lru_cache
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
CURRICULA_ROOT = APP_ROOT / "data" / "curricula"
PROGRAMS_FILE = APP_ROOT.parent / "static" / "data" / "udp-careers.json"


@lru_cache(maxsize=1)
def get_programs():
    try:
        data = json.loads(PROGRAMS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ()
    if not isinstance(data, list):
        return ()
    return tuple(item for item in data if isinstance(item, dict)
                 and isinstance(item.get("id"), str)
                 and isinstance(item.get("name"), str)
                 and isinstance(item.get("curriculumFile"), str)
                 and Path(item["curriculumFile"]).name == item["curriculumFile"])


def get_program(career_id):
    if not isinstance(career_id, str):
        return None
    return next((program for program in get_programs() if program["id"] == career_id), None)


@lru_cache(maxsize=16)
def _read_curriculum(filename, career_id):
    path = CURRICULA_ROOT / filename
    if path.parent != CURRICULA_ROOT:
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or data.get("version") != 1 or data.get("careerId") != career_id:
        return None
    semesters = data.get("semestres")
    if not isinstance(semesters, dict):
        return None
    normalized = {}
    for number, semester in semesters.items():
        try:
            semester_number = int(number)
        except (TypeError, ValueError):
            continue
        if not isinstance(semester, dict) or not isinstance(semester.get("ramos"), list):
            continue
        courses = []
        for course in semester["ramos"]:
            if not isinstance(course, dict) or not isinstance(course.get("nombre"), str):
                continue
            keywords = course.get("keywords")
            if not isinstance(keywords, list) or not all(isinstance(word, str) for word in keywords):
                continue
            courses.append({"nombre": course["nombre"], "keywords": keywords})
        normalized[semester_number] = {"nombre": str(semester.get("nombre") or f"Semestre {semester_number}"),
                                        "ramos": courses}
    return normalized


def get_curriculum(career_id):
    program = get_program(career_id)
    if not program:
        return None
    return _read_curriculum(program["curriculumFile"], career_id)


def find_program_id(career_name):
    if not isinstance(career_name, str):
        return None
    normalized = " ".join(career_name.casefold().split())
    return next((program["id"] for program in get_programs()
                 if " ".join(program["name"].casefold().split()) == normalized), None)
