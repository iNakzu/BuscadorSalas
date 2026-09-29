-- Keep the profile picker responsive as the community grows: search directory
-- entries separately and load personal module data only for the chosen profile.
create index if not exists profiles_shared_display_name_idx
  on public.profiles (
    lower(coalesce(nullif(display_name, ''), 'Estudiante')) text_pattern_ops,
    id
  )
  where share_information;

create or replace function public.search_shared_profiles(
  p_query text default '',
  p_limit integer default 41,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id,
         coalesce(nullif(p.display_name, ''), 'Estudiante')
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.share_information
    and public.is_community_member(auth.uid())
    and public.is_community_member(p.id)
    and (
      nullif(trim(p_query), '') is null
      or lower(coalesce(nullif(p.display_name, ''), 'Estudiante')) like
        replace(replace(replace(lower(trim(p_query)), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
      or lower(coalesce(nullif(p.display_name, ''), 'Estudiante')) like
        '%' || replace(replace(replace(lower(trim(p_query)), '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    )
  order by lower(coalesce(nullif(p.display_name, ''), 'Estudiante')), p.id
  limit least(greatest(coalesce(p_limit, 41), 1), 101)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function public.get_shared_profile_information(p_user_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
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
  where p.id = p_user_id
    and auth.uid() is not null
    and p.id <> auth.uid()
    and p.share_information
    and public.is_community_member(auth.uid())
    and public.is_community_member(p.id)
$$;

revoke all on function public.search_shared_profiles(text, integer, integer) from public, anon;
grant execute on function public.search_shared_profiles(text, integer, integer) to authenticated;
revoke all on function public.get_shared_profile_information(uuid) from public, anon;
grant execute on function public.get_shared_profile_information(uuid) to authenticated;
