-- Expose only the selected shared profile's career to authenticated community
-- members, using the same privacy and membership checks as the shared modules.
create or replace function public.get_shared_profile_career(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(u.raw_user_meta_data ->> 'careerId', '')
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id
    and auth.uid() is not null
    and p.id <> auth.uid()
    and p.share_information
    and public.is_community_member(auth.uid())
    and public.is_community_member(p.id)
$$;

revoke all on function public.get_shared_profile_career(uuid) from public, anon;
grant execute on function public.get_shared_profile_career(uuid) to authenticated;
