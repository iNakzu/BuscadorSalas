-- Clears only personal module payloads. The per-profile marker tells clients
-- to discard stale browser-local copies, preventing them from repopulating the
-- deleted rows. Accounts, profiles, and the signup allowlist remain intact.
WITH reset_profiles AS (
  UPDATE public.profiles
  SET data_reset_at = clock_timestamp()
  RETURNING id
), deleted_states AS (
  DELETE FROM public.user_module_state
  WHERE module_key IN ('schedule', 'grades', 'agenda', 'curriculum')
  RETURNING user_id
)
SELECT
  (SELECT count(*) FROM reset_profiles) AS profiles_marked,
  (SELECT count(*) FROM deleted_states) AS module_rows_deleted;
