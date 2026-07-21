-- 0011 — Progressive recognition: voluntary name + preference profile.
-- The actors table already exists (001-episodes.sql); this adds the
-- recognition columns ADR 0011 introduces. Both are nullable so existing
-- anonymous actors remain valid without backfill.

alter table public.actors
  add column if not exists preferred_name text;

alter table public.actors
  add column if not exists profile jsonb
    not null default '{}'::jsonb;

-- preferred_name is private to the actor and never indexed for lookup;
-- the only read path is by actor id (the ownership primitive).
-- profile is a small JSONB blob; no GIN index until a query path needs it.
