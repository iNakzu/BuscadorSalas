"""Format official all-caps course titles with Gemini and cache the result."""

import hashlib
import json
import os
import re
import sqlite3
import time
import unicodedata

import requests


GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
FORMATTER_VERSION = "v3"
FALLBACK_TTL_SECONDS = 3600
MAX_NAMES = 80
MAX_NAME_LENGTH = 160
CONNECTORS = {
    "a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "lo",
    "los", "o", "para", "por", "sí", "un", "una", "y",
}


def _clean_name(value):
    if not isinstance(value, str):
        return ""
    return " ".join("".join(ch for ch in value if ch >= " " and ch != "\x7f").split())[:MAX_NAME_LENGTH]


def _normalize_display(value):
    """Fix predictable Spanish title details after AI formatting."""
    text = re.sub(r"\s*:\s*", ": ", value.strip())
    words = text.split()
    normalized = []
    for index, word in enumerate(words):
        match = re.search(r"[^\W_]+", word, flags=re.UNICODE)
        if index and match:
            core = match.group(0)
            lower_core = core.casefold()
            previous_match = re.search(r"[^\W_]+", words[index - 1], flags=re.UNICODE)
            previous_core = previous_match.group(0).casefold() if previous_match else ""
            if lower_core in CONNECTORS or (lower_core == "mismo" and previous_core == "sí"):
                formatted = core.lower()
            elif core.isupper() and 2 <= len(core) <= 6:
                formatted = core
            else:
                formatted = core.lower().capitalize()
            word = word[:match.start()] + formatted + word[match.end():]
        elif match:
            core = match.group(0)
            formatted = core if core.isupper() and 2 <= len(core) <= 6 else core.lower().capitalize()
            word = word[:match.start()] + formatted + word[match.end():]
        normalized.append(word)
    return " ".join(normalized)


def _key(value):
    return f"{FORMATTER_VERSION}:" + hashlib.sha256(
        unicodedata.normalize("NFKC", value).casefold().encode("utf-8")
    ).hexdigest()


def fallback_course_display(value):
    """Apply Spanish title casing when Gemini is not available."""
    value = re.sub(r"\s*:\s*", ": ", value.strip())
    words = value.split()
    source_is_all_caps = sum(word.isupper() for word in words) > len(words) / 2 if words else False
    result = []
    for index, word in enumerate(words):
        match = re.search(r"[^\W_]+", word, flags=re.UNICODE)
        if not match:
            result.append(word)
            continue
        token = match.group(0)
        normalized = token.casefold()
        if normalized in CONNECTORS:
            display = token.lower() if index else token.lower().capitalize()
        elif token.isupper() and 2 <= len(token) <= (3 if source_is_all_caps else 6):
            display = token
        else:
            display = token.lower().capitalize()
        result.append(word[:match.start()] + display + word[match.end():])
    return " ".join(result)


def _word_signature(value):
    return [
        unicodedata.normalize("NFD", word).encode("ascii", "ignore").decode("ascii").casefold()
        for word in re.findall(r"[^\W_]+", value, flags=re.UNICODE)
    ]


def _valid_display(source, display):
    return (
        isinstance(display, str)
        and bool(display.strip())
        and len(display) <= MAX_NAME_LENGTH
        and _word_signature(source) == _word_signature(display)
    )


def _cache_connect(cache_path):
    path = cache_path or os.path.join(os.path.dirname(__file__), "course_display.sqlite3")
    os.makedirs(os.path.dirname(path) or ".", mode=0o700, exist_ok=True)
    connection = sqlite3.connect(path, timeout=8)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS course_display_cache ("
        "cache_key TEXT PRIMARY KEY, source_name TEXT NOT NULL, display_name TEXT NOT NULL, "
        "is_ai INTEGER NOT NULL, expires_at REAL NOT NULL, updated_at REAL NOT NULL)"
    )
    os.chmod(path, 0o600)
    return connection


def _read_cache(names, cache_path):
    if not names:
        return {}
    result = {}
    try:
        with _cache_connect(cache_path) as connection:
            now = time.time()
            for name in names:
                row = connection.execute(
                    "SELECT display_name, is_ai, expires_at FROM course_display_cache WHERE cache_key = ?",
                    (_key(name),),
                ).fetchone()
                if row and (row[1] or row[2] > now):
                    result[name] = row[0]
    except (OSError, sqlite3.Error):
        return {}
    return result


def _write_cache(values, cache_path, is_ai):
    if not values:
        return
    now = time.time()
    expires_at = now + FALLBACK_TTL_SECONDS if not is_ai else 253402300799.0
    try:
        with _cache_connect(cache_path) as connection:
            connection.executemany(
                "INSERT INTO course_display_cache(cache_key, source_name, display_name, is_ai, expires_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET "
                "source_name=excluded.source_name, display_name=excluded.display_name, "
                "is_ai=excluded.is_ai, expires_at=excluded.expires_at, updated_at=excluded.updated_at",
                [(_key(source), source, display, int(is_ai), expires_at, now) for source, display in values.items()],
            )
    except (OSError, sqlite3.Error):
        return


def _ask_gemini(names, api_key, model):
    schema = {
        "type": "OBJECT",
        "properties": {
            "items": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "index": {"type": "INTEGER"},
                        "display_name": {"type": "STRING"},
                    },
                    "required": ["index", "display_name"],
                    "propertyOrdering": ["index", "display_name"],
                },
            },
        },
        "required": ["items"],
        "propertyOrdering": ["items"],
    }
    instructions = (
        "Formatea títulos de asignaturas universitarias en español. El origen suele estar en mayúsculas. "
        "Escribe en mayúscula inicial cada palabra principal y mantén en minúscula palabras funcionales como a, al, "
        "con, de, del, e, el, en, la, las, los, o, para, por, un, una, y, y el pronombre sí, salvo al inicio. "
        "No conviertas una palabra en sigla "
        "solo por ser corta o venir en mayúsculas; conserva en mayúsculas únicamente abreviaciones reconocibles por su "
        "significado y contexto (por ejemplo TIC, TICS, IA). En expresiones como 'invención de sí mismo', escribe 'sí' "
        "en minúsculas. Corrige tildes y añade un espacio después de los dos puntos cuando falte. Tras los dos puntos, "
        "usa mayúscula inicial en la siguiente palabra principal. No agregues, elimines, traduzcas ni reordenes palabras. Devuelve exactamente un elemento "
        "por cada entrada, con el mismo índice. Entrada JSON: " + json.dumps(names, ensure_ascii=False)
    )
    response = requests.post(
        GEMINI_ENDPOINT.format(model=model),
        headers={"x-goog-api-key": api_key},
        json={
            "contents": [{"parts": [{"text": instructions}]}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "maxOutputTokens": min(4096, 64 + len(names) * 36),
            },
        },
        timeout=(4, 18),
    )
    if not response.ok:
        return {}
    payload = response.json()
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    decoded = json.loads(text)
    items = decoded.get("items", [])
    if not isinstance(items, list) or len(items) != len(names):
        return {}
    displays = {}
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            return {}
        index = item.get("index")
        display = item.get("display_name")
        if isinstance(index, bool) or not isinstance(index, int) or not 0 <= index < len(names) or index in seen:
            return {}
        if not _valid_display(names[index], display):
            return {}
        seen.add(index)
        displays[names[index]] = _normalize_display(display)
    return displays if len(seen) == len(names) else {}


def format_course_names(names, api_key, model, cache_path):
    """Return source-name -> display-name while keeping course lookup values intact."""
    clean_names = list(dict.fromkeys(_clean_name(name) for name in names if _clean_name(name)))[:MAX_NAMES]
    if not clean_names:
        return {}

    cached = _read_cache(clean_names, cache_path)
    missing = [name for name in clean_names if name not in cached]
    ai_names = {}
    if missing and api_key:
        try:
            ai_names = _ask_gemini(missing, api_key, model)
        except (requests.RequestException, ValueError, TypeError, KeyError, IndexError):
            ai_names = {}
    if ai_names:
        _write_cache(ai_names, cache_path, is_ai=True)

    fallback = {name: _normalize_display(fallback_course_display(name)) for name in missing if name not in ai_names}
    _write_cache(fallback, cache_path, is_ai=False)
    return {**cached, **fallback, **ai_names}
