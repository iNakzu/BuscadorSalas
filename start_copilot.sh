#!/usr/bin/env bash
set -euo pipefail

# Inicia GitHub Copilot CLI en modo autónomo dentro de este proyecto.
# Uso:
#   ./start_copilot.sh
#   ./start_copilot.sh --continue
#   ./start_copilot.sh -i "revisa los cambios pendientes"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v copilot >/dev/null 2>&1; then
    echo "Error: no se encontró el comando 'copilot' en el PATH." >&2
    exit 1
fi

echo "Iniciando GitHub Copilot CLI en modo autónomo..."
exec copilot --allow-all-tools "$@"
