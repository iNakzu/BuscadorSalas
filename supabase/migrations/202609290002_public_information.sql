-- Extend the former schedule-only directory into a community information
-- directory. Access remains limited to authenticated community members.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'share_schedule'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'share_information'
  ) then
    alter table public.profiles rename column share_schedule to share_information;
  end if;
end
$$;

alter table public.profiles
  add column if not exists share_information boolean not null default true;

comment on column public.profiles.share_information is
  'When true, authenticated community members can view this user schedule, exams, grades, agenda and curriculum progress.';

drop function if exists public.get_shared_schedules();

create or replace function public.get_shared_information()
returns table (user_id uuid, display_name text, modules jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id,
         coalesce(nullif(p.display_name, ''), 'Estudiante'),
         jsonb_build_object(
           'schedule', jsonb_build_object('clases', coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'dia', item.class_data -> 'dia',
                 'diaNombre', item.class_data -> 'diaNombre',
                 'horaInicio', item.class_data -> 'horaInicio',
                 'horaFin', item.class_data -> 'horaFin',
                 'curso', item.class_data -> 'curso',
                 'tipo', item.class_data -> 'tipo',
                 'sala', item.class_data -> 'sala',
                 'profesor', item.class_data -> 'profesor',
                 'seccion', item.class_data -> 'seccion',
                 'rol', item.class_data -> 'rol'
               ) order by item.class_data ->> 'dia', item.class_data ->> 'horaInicio'
             )
             from public.user_module_state schedule_state,
                  jsonb_array_elements(
                    case when jsonb_typeof(schedule_state.payload -> 'clases') = 'array'
                      then schedule_state.payload -> 'clases' else '[]'::jsonb end
                  ) as item(class_data)
             where schedule_state.user_id = p.id
               and schedule_state.module_key = 'schedule'
               and jsonb_typeof(item.class_data) = 'object'
           ), '[]'::jsonb)),
           'grades', coalesce((
             select grades_state.payload from public.user_module_state grades_state
             where grades_state.user_id = p.id and grades_state.module_key = 'grades'
           ), '{}'::jsonb),
           'agenda', coalesce((
             select agenda_state.payload from public.user_module_state agenda_state
             where agenda_state.user_id = p.id and agenda_state.module_key = 'agenda'
           ), '[]'::jsonb),
           'curriculum', coalesce((
             select curriculum_state.payload from public.user_module_state curriculum_state
             where curriculum_state.user_id = p.id and curriculum_state.module_key = 'curriculum'
           ), '{}'::jsonb)
         )
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and public.is_community_member(auth.uid())
    and public.is_community_member(p.id)
    and p.share_information
$$;

revoke all on table public.profiles from anon, authenticated, public;
grant select (id, display_name, share_information) on table public.profiles to authenticated;
grant update (share_information) on table public.profiles to authenticated;
revoke all on function public.get_shared_information() from public, anon;
grant execute on function public.get_shared_information() to authenticated;
