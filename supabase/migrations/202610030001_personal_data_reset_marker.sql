-- Track full personal-data resets so browsers discard stale local copies
-- instead of uploading them again after their Supabase rows are removed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_reset_at timestamptz NOT NULL DEFAULT 'epoch'::timestamptz;

GRANT SELECT (data_reset_at) ON TABLE public.profiles TO authenticated;

ALTER TABLE public.user_module_state
  ADD COLUMN IF NOT EXISTS reset_marker timestamptz NOT NULL DEFAULT 'epoch'::timestamptz;

-- Old tabs use schema_version 1 and can otherwise upload their browser-local
-- copies after the reset. Require the updated client for writes after a reset.
CREATE OR REPLACE FUNCTION public.enforce_personal_data_reset_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reset_at timestamptz;
BEGIN
  SELECT p.data_reset_at INTO reset_at
  FROM public.profiles AS p
  WHERE p.id = NEW.user_id;

  IF reset_at > 'epoch'::timestamptz AND NEW.schema_version < 2 THEN
    RAISE EXCEPTION 'This app version must be refreshed before syncing personal data.'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.reset_marker IS DISTINCT FROM coalesce(reset_at, 'epoch'::timestamptz) THEN
    RAISE EXCEPTION 'Personal data changed; refresh before syncing.'
      USING ERRCODE = '40001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_module_state_enforce_reset_version ON public.user_module_state;
CREATE TRIGGER user_module_state_enforce_reset_version
BEFORE INSERT OR UPDATE ON public.user_module_state
FOR EACH ROW EXECUTE FUNCTION public.enforce_personal_data_reset_version();

-- Allow a signed-in user to clear only their personal modules while keeping
-- their account and profile. RLS is bypassed only inside this scoped function.
CREATE OR REPLACE FUNCTION public.reset_my_personal_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account_id uuid := auth.uid();
  reset_timestamp timestamptz := clock_timestamp();
BEGIN
  IF account_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.profiles
  SET data_reset_at = reset_timestamp
  WHERE id = account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.user_module_state
  WHERE user_id = account_id
    AND module_key IN ('schedule', 'grades', 'agenda', 'curriculum');

  RETURN jsonb_build_object('reset_at', reset_timestamp);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_my_personal_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_my_personal_data() TO authenticated;
