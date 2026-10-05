-- Admin access is carried only in the signed app_metadata claim. This allows
-- the database to enforce permission even when a caller bypasses the UI.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'portal_role', '') = 'admin'
$$;

CREATE OR REPLACE FUNCTION private.set_default_portal_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(NEW.raw_app_meta_data ->> 'portal_role', '') = '' THEN
    NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('portal_role', 'user');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_default_portal_role() FROM PUBLIC, anon, authenticated;

UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('portal_role', 'user')
WHERE coalesce(raw_app_meta_data ->> 'portal_role', '') = '';

DROP TRIGGER IF EXISTS set_default_portal_role ON auth.users;
CREATE TRIGGER set_default_portal_role
BEFORE INSERT OR UPDATE OF raw_app_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.set_default_portal_role();

CREATE TABLE IF NOT EXISTS public.admin_module_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK (module_key IN ('schedule', 'grades', 'agenda', 'curriculum')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.admin_module_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_module_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_search_profiles(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 40,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_portal_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id,
         coalesce(nullif(p.display_name, ''), 'Estudiante')
  FROM public.profiles AS p
  WHERE p.id <> auth.uid()
    AND (
      nullif(trim(p_query), '') IS NULL
      OR lower(coalesce(nullif(p.display_name, ''), 'Estudiante')) LIKE
        '%' || replace(replace(replace(lower(trim(p_query)), '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'
      OR lower(coalesce(p.email, '')) LIKE
        '%' || replace(replace(replace(lower(trim(p_query)), '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'
    )
  ORDER BY lower(coalesce(nullif(p.display_name, ''), 'Estudiante')), p.id
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_profile_information(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_portal_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'A different target profile is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Profile not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'schedule', coalesce((SELECT payload FROM public.user_module_state WHERE user_id = p_user_id AND module_key = 'schedule'), '{"clases":[]}'::jsonb),
    'grades', coalesce((SELECT payload FROM public.user_module_state WHERE user_id = p_user_id AND module_key = 'grades'), '{}'::jsonb),
    'agenda', coalesce((SELECT payload FROM public.user_module_state WHERE user_id = p_user_id AND module_key = 'agenda'), '[]'::jsonb),
    'curriculum', coalesce((SELECT payload FROM public.user_module_state WHERE user_id = p_user_id AND module_key = 'curriculum'), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_profile_module(
  p_user_id uuid,
  p_module_key text,
  p_payload jsonb
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reset_at timestamptz;
  saved_at timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_portal_admin() THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'A different target profile is required.' USING ERRCODE = '22023';
  END IF;
  IF p_module_key NOT IN ('schedule', 'grades', 'agenda', 'curriculum') OR p_payload IS NULL THEN
    RAISE EXCEPTION 'Invalid module or payload.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_payload::text) > 1048576 THEN
    RAISE EXCEPTION 'Payload exceeds the allowed size.' USING ERRCODE = '22023';
  END IF;
  IF (p_module_key = 'schedule' AND (jsonb_typeof(p_payload) <> 'object' OR jsonb_typeof(p_payload -> 'clases') <> 'array'))
    OR (p_module_key = 'grades' AND jsonb_typeof(p_payload) <> 'object')
    OR (p_module_key = 'agenda' AND jsonb_typeof(p_payload) <> 'array')
    OR (p_module_key = 'curriculum' AND jsonb_typeof(p_payload) <> 'object') THEN
    RAISE EXCEPTION 'Payload shape does not match the selected module.' USING ERRCODE = '22023';
  END IF;
  IF p_module_key = 'schedule' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payload -> 'clases') AS class_row(value)
    WHERE jsonb_typeof(class_row.value) = 'object'
      AND class_row.value ? 'dia'
      AND class_row.value ? 'bloqueNum'
    GROUP BY class_row.value ->> 'dia', class_row.value ->> 'bloqueNum'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Only one class is allowed per day and time block.' USING ERRCODE = '22023';
  END IF;

  SELECT data_reset_at INTO reset_at FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.user_module_state(user_id, module_key, schema_version, reset_marker, payload, client_updated_at)
  VALUES (p_user_id, p_module_key, 2, coalesce(reset_at, 'epoch'::timestamptz), p_payload, saved_at)
  ON CONFLICT (user_id, module_key) DO UPDATE
    SET schema_version = 2,
        reset_marker = excluded.reset_marker,
        payload = excluded.payload,
        client_updated_at = excluded.client_updated_at;

  INSERT INTO public.admin_module_audit(admin_user_id, target_user_id, module_key)
  VALUES (auth.uid(), p_user_id, p_module_key);
  RETURN saved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_profiles(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_profile_information(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_profile_module(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_profiles(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_profile_information(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_module(uuid, text, jsonb) TO authenticated;
