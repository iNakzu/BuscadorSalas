#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cli="$repo_dir/.codex/bin/supabase"
expected_project="kfvlfpdfpkzmtaiyfjeu"
linked_project="$(cat "$repo_dir/supabase/.temp/project-ref")"

if [[ "$linked_project" != "$expected_project" ]]; then
  printf 'Proyecto vinculado inesperado; no se borró nada.\n' >&2
  exit 1
fi
if [[ ! -x "$cli" ]]; then
  printf 'No está disponible Supabase CLI en %s\n' "$cli" >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  read -r -s -p 'PAT de Supabase (no se guardará): ' SUPABASE_ACCESS_TOKEN
  printf '\n'
  export SUPABASE_ACCESS_TOKEN
fi
if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
  printf 'Se necesita un PAT para continuar.\n' >&2
  exit 1
fi

cd "$repo_dir"
printf 'Proyecto verificado: %s\n' "$linked_project"
printf 'Antes del reinicio (usuarios/perfiles/módulos/lista autorizada):\n'
"$cli" db query --linked "SELECT (SELECT count(*) FROM auth.users) AS auth_users, (SELECT count(*) FROM public.profiles) AS profiles, (SELECT count(*) FROM public.user_module_state) AS personal_modules, (SELECT count(*) FROM public.email_allowlist) AS allowed_emails;"
printf 'Eliminando solo horario, notas, agenda y malla...\n'
"$cli" db query --linked --file supabase/reset_academic_data.sql
printf 'Verificación posterior (usuarios/perfiles/lista autorizada iguales; módulos en cero):\n'
"$cli" db query --linked "SELECT (SELECT count(*) FROM auth.users) AS auth_users, (SELECT count(*) FROM public.profiles) AS profiles, (SELECT count(*) FROM public.user_module_state) AS personal_modules, (SELECT count(*) FROM public.email_allowlist) AS allowed_emails;"
unset SUPABASE_ACCESS_TOKEN
