-- Evaluation ids are not used by the notes UI, and the exemption grade is
-- fixed in the calculation. Keep existing grade payloads aligned with that
-- compact schema.
update public.user_module_state as state
set payload = (
  select coalesce(jsonb_object_agg(course.key,
    case when jsonb_typeof(course.value) = 'object' then
      (course.value - 'eximGrade') ||
      case when jsonb_typeof(course.value -> 'items') = 'array' then
        jsonb_build_object('items', (
          select coalesce(jsonb_agg(item.value - 'id' order by item.ordinality), '[]'::jsonb)
          from jsonb_array_elements(
            case when jsonb_typeof(course.value -> 'items') = 'array'
              then course.value -> 'items' else '[]'::jsonb end
          ) with ordinality as item(value, ordinality)
        ))
      else '{}'::jsonb end
    else course.value end
  ), '{}'::jsonb)
  from jsonb_each(state.payload) as course(key, value)
)
where state.module_key = 'grades'
  and jsonb_typeof(state.payload) = 'object'
  and exists (
    select 1
    from jsonb_each(state.payload) as course(key, value)
    where jsonb_typeof(course.value) = 'object'
      and (course.value ? 'eximGrade' or exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(course.value -> 'items') = 'array'
            then course.value -> 'items' else '[]'::jsonb end
        ) as item(value)
        where jsonb_typeof(item.value) = 'object'
          and item.value ? 'id'
      ))
  );
