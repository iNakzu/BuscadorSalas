-- The fixed block number and start/end times are sufficient to render a
-- schedule block. Remove the cached label from existing personal schedules.
update public.user_module_state as state
set payload = jsonb_set(
  state.payload,
  '{clases}',
  (
    select coalesce(jsonb_agg(item.value - 'bloqueLabel' order by item.ordinality), '[]'::jsonb)
    from jsonb_array_elements(
      case when jsonb_typeof(state.payload -> 'clases') = 'array'
        then state.payload -> 'clases' else '[]'::jsonb end
    ) with ordinality as item(value, ordinality)
  ),
  false
)
where state.module_key = 'schedule'
  and jsonb_typeof(state.payload -> 'clases') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(state.payload -> 'clases') = 'array'
        then state.payload -> 'clases' else '[]'::jsonb end
    ) as item(value)
    where jsonb_typeof(item.value) = 'object'
      and item.value ? 'bloqueLabel'
  );
