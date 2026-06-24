-- Supabase session store for Ardum.
-- Run once against your Supabase project to create the `sessions` table.
-- The same shape is used by the in-memory adapter, so a Supabase
-- deployment behaves identically to the demo.

create table if not exists public.sessions (
  id          uuid        primary key,
  profile     jsonb,        -- PractitionerProfile (written first)
  match_run   jsonb,        -- MatchRun (written after the agent runs)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hot path: the OG image generator and any future "share my match" link
-- look up runs by retreat id. The jsonb containment operator is supported
-- by the default GIN index, so the lookup stays sub-millisecond.
create index if not exists sessions_match_run_gin
  on public.sessions
  using gin (match_run jsonb_path_ops);

-- updated_at trigger so the dispatcher can trust the column.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- The service role bypasses RLS, so we don't need policies for the
-- dispatcher. If you ever expose session reads to clients, add a
-- policy here that scopes rows to the requesting user.
alter table public.sessions enable row level security;
