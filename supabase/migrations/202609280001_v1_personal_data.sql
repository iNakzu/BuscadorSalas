-- V1 personal data. Apply with `supabase db push`, then enable the
-- `public.hook_restrict_signup` Before User Created hook in Auth > Hooks.
create table if not exists public.email_allowlist (
  email text primary key check (email = lower(trim(email))),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  share_schedule boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.share_schedule is
  'When true, the signed-in community can read this user schedule. Defaults to true; false hides it.';

create table if not exists public.user_module_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in ('schedule','grades','agenda','curriculum')),
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_key)
);

alter table public.email_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.user_module_state enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "auth hook reads signup allowlist" on public.email_allowlist for select to supabase_auth_admin using (true);
create policy "users read own module state" on public.user_module_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own module state" on public.user_module_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own module state" on public.user_module_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own module state" on public.user_module_state for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists user_module_state_set_updated_at on public.user_module_state;
create trigger user_module_state_set_updated_at before update on public.user_module_state
for each row execute function public.set_updated_at();

-- Share only the fields needed to coordinate schedules. The SECURITY DEFINER
-- function deliberately bypasses table RLS, then enforces authentication,
-- opt-out state, module scope and a strict list of returned class fields.
create or replace function public.is_community_member(account_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = account_id
      and u.email is not null
      and (
        split_part(lower(u.email), '@', 2) = 'mail.udp.cl'
        or exists (select 1 from public.email_allowlist a where a.email = lower(u.email))
      )
  )
$$;

create or replace function public.get_shared_schedules()
returns table (user_id uuid, display_name text, payload jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id,
         coalesce(nullif(p.display_name, ''), 'Estudiante UDP'),
         jsonb_build_object('clases', coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'dia', item.class_data -> 'dia',
               'diaNombre', item.class_data -> 'diaNombre',
               'horaInicio', item.class_data -> 'horaInicio',
               'horaFin', item.class_data -> 'horaFin',
               'curso', item.class_data -> 'curso',
               'sala', item.class_data -> 'sala'
             ) order by item.class_data ->> 'dia', item.class_data ->> 'horaInicio'
           )
           from jsonb_array_elements(
             case when jsonb_typeof(s.payload -> 'clases') = 'array'
               then s.payload -> 'clases' else '[]'::jsonb end
           ) as item(class_data)
           where jsonb_typeof(item.class_data) = 'object'
         ), '[]'::jsonb))
  from public.profiles p
  join public.user_module_state s on s.user_id = p.id and s.module_key = 'schedule'
  where auth.uid() is not null
    and p.id <> auth.uid()
    and public.is_community_member(auth.uid())
    and public.is_community_member(p.id)
    and p.share_schedule
$$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(
      nullif(trim(concat_ws(' ',
        nullif(new.raw_user_meta_data ->> 'given_name', ''),
        nullif(new.raw_user_meta_data ->> 'family_name', '')
      )), ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', '')
    )
  );
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users for each row execute function public.create_profile_for_new_user();

-- Include accounts that signed up before this migration was applied.
insert into public.profiles (id, email, display_name)
select u.id,
       lower(u.email),
       coalesce(
         nullif(trim(concat_ws(' ',
           nullif(u.raw_user_meta_data ->> 'given_name', ''),
           nullif(u.raw_user_meta_data ->> 'family_name', '')
         )), ''),
         nullif(u.raw_user_meta_data ->> 'full_name', ''),
         nullif(u.raw_user_meta_data ->> 'name', '')
       )
from auth.users u
where u.email is not null
on conflict (id) do nothing;

create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  candidate_email text := lower(event -> 'user' ->> 'email');
  allowed boolean;
begin
  select split_part(candidate_email, '@', 2) = 'mail.udp.cl'
    or exists (select 1 from public.email_allowlist where email = candidate_email)
  into allowed;

  if coalesce(allowed, false) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Usa un correo institucional autorizado o solicita acceso.'
  ));
end;
$$;

grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on table public.email_allowlist to supabase_auth_admin;
revoke all on function public.hook_restrict_signup(jsonb) from authenticated, anon, public;
revoke all on table public.email_allowlist from authenticated, anon, public;

-- Explicit least-privilege grants keep the app working with automatic table
-- exposure disabled. RLS policies above still restrict every row by user id.
revoke all on table public.profiles from anon, authenticated, public;
grant select (id, display_name, share_schedule) on table public.profiles to authenticated;
grant update (share_schedule) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_module_state to authenticated;
revoke all on function public.get_shared_schedules() from public, anon;
grant execute on function public.get_shared_schedules() to authenticated;
revoke all on function public.is_community_member(uuid) from public, anon, authenticated;
