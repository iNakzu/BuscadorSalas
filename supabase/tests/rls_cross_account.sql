-- Safe cross-account RLS smoke test for Supabase SQL Editor.
-- Run only the preflight SELECT first as postgres, then replace the UUID
-- placeholders in the test transaction with two eligible mail.udp.cl users.
-- Choose a target account with has_schedule_row = true. Run the whole test
-- block. It always ends with ROLLBACK; do not remove it.

-- Preflight: returns only account IDs and module names, never email or payload.
select u.id,
       exists (
         select 1 from public.user_module_state s
         where s.user_id = u.id and s.module_key = 'schedule'
       ) as has_schedule_row
from auth.users u
where split_part(lower(u.email), '@', 2) = 'mail.udp.cl'
order by u.created_at
limit 2;

-- After selecting UUIDs above, replace UUID_A and UUID_B below and run:
-- A is the signed-in/malicious reader; B owns the protected data.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'UUID_A', true);

-- Expected: 0. Account A cannot directly read B's private module row.
select count(*) as rows_visible_to_a
from public.user_module_state
where user_id = 'UUID_B'::uuid and module_key = 'schedule';

-- Expected command count: UPDATE 0, even though B's schedule row exists.
-- This write is rolled back at the end even if a faulty policy allows it.
update public.user_module_state
set payload = payload || '{"__rls_audit_probe__":true}'::jsonb
where user_id = 'UUID_B'::uuid and module_key = 'schedule';

-- Expected command count: UPDATE 0. A cannot change B's sharing setting.
update public.profiles
set share_information = not share_information
where id = 'UUID_B'::uuid;

rollback;
