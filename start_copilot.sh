#!/usr/bin/env bash
set -euo pipefail

# Inicia GitHub Copilot CLI en modo autónomo dentro de una sesión persistente
# de screen en este proyecto.
# Uso:
#   ./start_copilot.sh             -> Reanuda la sesión si ya existe
#   ./start_copilot.sh --continue  -> Continúa la conversación de Copilot
#   ./start_copilot.sh -i "revisa los cambios pendientes"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="copilot"
cd "$SCRIPT_DIR"

if ! command -v copilot >/dev/null 2>&1; then
    echo "Error: no se encontró el comando 'copilot' en el PATH." >&2
    exit 1
fi

if ! command -v screen >/dev/null 2>&1; then
    echo "Error: no se encontró 'screen'. Instálalo con: sudo apt-get install screen" >&2
    exit 1
fi

if screen -list | grep -E -q "[0-9]+\.${SESSION_NAME}\b"; then
    echo "Sesión de screen '${SESSION_NAME}' encontrada. Conectando..."
    exec screen -d -r "$SESSION_NAME"
fi

echo "Creando sesión de screen '${SESSION_NAME}' para GitHub Copilot CLI..."
exec screen -S "$SESSION_NAME" bash -c \
    'copilot --allow-all-tools "$@"; exec bash' _ "$@"
