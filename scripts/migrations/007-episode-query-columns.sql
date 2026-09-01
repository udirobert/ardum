-- Episode list-query scaling.
--
-- listContributionEpisodes() and listByRetreatRootHash() previously loaded
-- up to 5000 full JSONB state rows and filtered client-side. These stored
-- generated columns (plus indexes) let PostgREST filter server-side, so
-- the operator demand surface stays cheap as the episodes table grows.

create or replace function public.episode_root_hashes(state jsonb)
returns text[]
language sql
immutable
as $$
  select array_remove(
    array_prepend(
      state#>>'{recommendation,result,retreatRootHash}',
      coalesce(
        (select array_agg(alt->>'retreatRootHash')
         from jsonb_array_elements(state->'recommendation'->'alternatives') alt),
        '{}'::text[]
      )
    ),
    null
  );
$$;

alter table public.episodes
  add column if not exists contribution_granted boolean
  generated always as (
    (state->'widerApertureContribution'->>'grantedAt') is not null
    and (state->'widerApertureContribution'->>'revokedAt') is null
  ) stored;

alter table public.episodes
  add column if not exists retreat_root_hashes text[]
  generated always as (public.episode_root_hashes(state)) stored;

create index if not exists episodes_contribution_granted_idx
  on public.episodes (contribution_granted) where contribution_granted;

create index if not exists episodes_retreat_root_hashes_idx
  on public.episodes using gin (retreat_root_hashes);
