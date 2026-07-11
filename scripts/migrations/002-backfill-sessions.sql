-- Convert each legacy session into an anonymous episode. Apply only after
-- 001-episodes.sql and before switching production reads.
insert into public.actors (id, kind)
select id, 'anonymous'
from public.sessions
on conflict (id) do nothing;

insert into public.episodes (
  id,
  actor_id,
  status,
  revision,
  state,
  created_at,
  updated_at
)
select
  id,
  id,
  case when match_run is null then 'clarifying' else 'recommendation-ready' end,
  1,
  jsonb_build_object(
    'schemaVersion', 1,
    'id', id,
    'actorId', id,
    'revision', 1,
    'status', case when match_run is null then 'clarifying' else 'recommendation-ready' end,
    'intentions', jsonb_build_array(
      jsonb_build_object(
        'version', 1,
        'statement', coalesce(profile->>'notes', 'A retreat that fits where I am now'),
        'constraints', jsonb_strip_nulls(jsonb_build_object(
          'energy', profile->'energy',
          'budget', profile->'budget',
          'social', profile->'social'
        )),
        'changeReason', 'Backfilled from legacy session',
        'createdAt', created_at
      )
    ),
    'recommendation', case
      when match_run is null then null
      else jsonb_build_object(
        'intentionVersion', 1,
        'rankingPolicyVersion', 'legacy',
        'result', match_run->'results'->0,
        'alternatives', coalesce(match_run->'results' - 0, '[]'::jsonb),
        'uncertainties', '[]'::jsonb,
        'generatedAt', coalesce(match_run->>'generatedAt', created_at::text)
      )
    end,
    'processedIdempotencyKeys', '[]'::jsonb,
    'events', '[]'::jsonb,
    'createdAt', created_at,
    'updatedAt', updated_at
  ),
  created_at,
  updated_at
from public.sessions
on conflict (id) do nothing;

-- Verification before cutover:
-- select (select count(*) from sessions) legacy,
--        (select count(*) from episodes) episodes;
