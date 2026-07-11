create table if not exists public.actors (
  id uuid primary key,
  kind text not null default 'anonymous'
    check (kind in ('anonymous', 'authenticated')),
  external_subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists actors_external_subject_unique
  on public.actors (external_subject)
  where external_subject is not null;

create table if not exists public.episodes (
  id uuid primary key,
  actor_id uuid not null references public.actors(id) on delete cascade,
  status text not null,
  revision integer not null check (revision > 0),
  state jsonb not null,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists episodes_actor_updated_idx
  on public.episodes (actor_id, updated_at desc);
create index if not exists episodes_next_action_idx
  on public.episodes (next_action_at)
  where next_action_at is not null;

create table if not exists public.episode_events (
  id uuid primary key,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  type text not null,
  summary text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists episode_events_episode_created_idx
  on public.episode_events (episode_id, created_at);

create table if not exists public.coordination_invites (
  token_hash text primary key,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  participant_name text not null,
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.actors enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_events enable row level security;
alter table public.coordination_invites enable row level security;
