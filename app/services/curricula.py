"""Load the canonical, versioned curriculum catalog for every program."""
import json
import re
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
    if not isinstance(data, dict) or data.get("version") != 2 or data.get("careerId") != career_id:
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
            course_id = str(course.get("id", ""))
            requirements = course.get("requisitos", [])
            if not course_id or not isinstance(requirements, list):
                continue
            normalized_course = {
                "id": course_id,
                "nombre": course["nombre"],
                "keywords": keywords,
                "requisitos": [str(item) for item in requirements if isinstance(item, (str, int))],
            }
            for key in ("codigo", "creditos", "color", "border"):
                value = course.get(key)
                if isinstance(value, str):
                    normalized_course[key] = value
            if course.get("idVisible") is False:
                normalized_course["idVisible"] = False
            for color_key in ("color", "border"):
                color = normalized_course.get(color_key, "")
                if color and not re.fullmatch(r"(?:25[0-5]|2[0-4]\d|1\d\d|\d?\d),\s*(?:25[0-5]|2[0-4]\d|1\d\d|\d?\d),\s*(?:25[0-5]|2[0-4]\d|1\d\d|\d?\d)", color):
                    normalized_course.pop(color_key, None)
            courses.append(normalized_course)
        normalized[semester_number] = {"nombre": str(semester.get("nombre") or f"Semestre {semester_number}"),
                                        "ramos": courses}
    return normalized


def get_curriculum(career_id):
    program = get_program(career_id)
    if not program:
        return None
    return _read_curriculum(program["curriculumFile"], career_id)


@lru_cache(maxsize=16)
def _visual_curriculum_from_canonical(filename, career_id):
    curriculum = _read_curriculum(filename, career_id)
    if curriculum is None:
        return None
    semesters = []
    for number, semester in sorted(curriculum.items()):
        courses = []
        for course in semester["ramos"]:
            visual_course = {key: value for key, value in course.items() if key != "keywords"}
            courses.append(visual_course)
        semesters.append({"numero": number, "cursos": courses})
    return semesters


def get_visual_curriculum(career_id):
    program = get_program(career_id)
    if not program:
        return None
    return _visual_curriculum_from_canonical(program["curriculumFile"], career_id)


def find_program_id(career_name):
    if not isinstance(career_name, str):
        return None
    normalized = " ".join(career_name.casefold().split())
    return next((program["id"] for program in get_programs()
                 if " ".join(program["name"].casefold().split()) == normalized), None)
