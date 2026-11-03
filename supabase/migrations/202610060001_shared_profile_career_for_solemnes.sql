-- Career metadata is returned only for a profile selected through the same
-- community privacy checks as its academic modules. Admins retain their
-- existing explicit access to private profiles.
-- School is derived from career metadata, so remove its old duplicate from
-- every saved schedule payload while preserving all class records.
update public.user_module_state
set payload = payload - 'escuela'
where module_key = 'schedule'
  and jsonb_typeof(payload) = 'object'
  and payload ? 'escuela';

create or replace function public.get_shared_profile_career(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(u.raw_user_meta_data ->> 'careerId', ''),
                  nullif(u.raw_user_meta_data ->> 'career', ''))
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id
    and auth.uid() is not null
    and p.id <> auth.uid()
    and p.share_information
    and public.is_community_member(auth.uid())
    and public.is_community_member(p.id)
$$;

create or replace function public.admin_get_profile_career(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(u.raw_user_meta_data ->> 'careerId', ''),
                  nullif(u.raw_user_meta_data ->> 'career', ''))
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id
    and auth.uid() is not null
    and p.id <> auth.uid()
    and private.is_portal_admin()
$$;

revoke all on function public.get_shared_profile_career(uuid) from public, anon;
grant execute on function public.get_shared_profile_career(uuid) to authenticated;
revoke all on function public.admin_get_profile_career(uuid) from public, anon;
grant execute on function public.admin_get_profile_career(uuid) to authenticated;
