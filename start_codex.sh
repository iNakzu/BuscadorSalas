#!/usr/bin/env bash
set -euo pipefail

# Abre Codex CLI dentro de una sesión persistente de GNU screen en este repo.
# Si la sesión ya existe, se reconecta a ella.
# Uso:
#   ./start_codex.sh                 -> Inicia Codex o reconecta a la sesión
#   ./start_codex.sh resume --last    -> Inicia Codex reanudando la última conversación
#   ./start_codex.sh "revisa el repo" -> Pasa un prompt inicial a Codex

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="codex-buscadorsalas-v1"

if ! command -v codex >/dev/null 2>&1; then
    echo "Error: no se encontró 'codex' en el PATH." >&2
    exit 1
fi

if ! command -v screen >/dev/null 2>&1; then
    echo "Error: no se encontró 'screen'. Instálalo con: sudo apt-get install screen" >&2
    exit 1
fi

if screen -list | grep -E -q "[0-9]+\.${SESSION_NAME}([[:space:]]|$)"; then
    echo "Reconectando a la sesión de Codex '${SESSION_NAME}'..."
    exec screen -d -r "$SESSION_NAME"
fi

echo "Iniciando Codex en screen '${SESSION_NAME}' desde ${SCRIPT_DIR}..."
exec screen -S "$SESSION_NAME" bash -c '
    cd -- "$1"
    shift
    codex "$@"
    status=$?
    printf "\nCodex terminó (código %s). La shell queda abierta dentro de screen.\n" "$status"
    exec bash
' _ "$SCRIPT_DIR" "$@"
