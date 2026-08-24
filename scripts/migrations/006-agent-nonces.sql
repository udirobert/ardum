-- Agent API replay-protection nonces.
--
-- The in-memory nonce store (src/booking/agent-replay.ts) is sufficient for a
-- single-instance deployment but does not protect against replays across
-- serverless function instances. This table backs the same consumeNonce
-- contract in a shared store so replay protection is deterministic across
-- any number of instances.
--
-- Key shape: "agentAddress:nonce" (lowercase address + ":" + nonce string).
-- A row exists only for nonces that have been consumed and not yet expired.
-- The expiry column lets a GC sweep (or the insert-time UPSERT) prune rows
-- whose 5-minute skew window has passed.

create table if not exists public.agent_nonces (
  nonce_key text primary key,
  agent_address text not null,
  expires_at timestamptz not null
);

create index if not exists agent_nonces_expires_idx
  on public.agent_nonces (expires_at);

-- Prune expired nonces on every insert. Cheap, idempotent, and keeps the
-- table from growing unbounded without a separate cron.
create or replace function public.prune_agent_nonces()
returns void
language plpgsql
as $$
begin
  delete from public.agent_nonces where expires_at <= now();
end;
$$;

alter table public.agent_nonces enable row level security;

-- Service role bypasses RLS; no policy needed — this table is only touched
-- server-side via the service role key.
