-- 008-rls-deny-all-for-non-service-roles.sql
--
-- Supabase Security Advisor flagged rls_disabled_in_public (critical) on the
-- four tables that 004-disable-rls-for-now.sql took offline. 004's premise
-- was "server-only via service role", but it only made the *intent* explicit;
-- it never closed the door behind it. Supabase's default posture grants
-- anon/authenticated full INSERT/SELECT/UPDATE/DELETE on every public table,
-- so with RLS off, anyone holding the project URL plus the anon key
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY is a client-visible env var, and the anon
-- key is public by design) can read and mutate all data through PostgREST.
-- Verified live 2026-09-22: relrowsecurity=false on actors, episodes,
-- episode_events, coordination_invites, with full grants to anon.
--
-- The app never queries Supabase from the browser (src/lib/supabase.ts uses
-- the service role exclusively, and no src/ file references the anon key),
-- so the correct hardening is to make non-service roles simply have no
-- access at all:
--
--   1. Re-enable RLS on every public table (service role keeps working via
--      BYPASSRLS; no policies means everyone else is denied).
--   2. Revoke all table/sequence privileges from anon and authenticated so
--      misuse fails loudly instead of returning silent empty datasets —
--      the foot-gun 004 and ADR 0006 were trying to avoid.
--   3. Revoke future default grants so new tables don't silently reopen the
--      hole.
--
-- When authenticated identity lands, follow ADR 0006's revert path: one
-- transaction that re-grants the specific roles and creates real policies
-- per table. Do not weaken this migration incrementally.
--
-- See docs/decisions/0006-supabase-rls-posture.md (addendum).

begin;

-- 1. Enable RLS on every table in the public schema, whatever its current
--    state. Covers the four 004 tables and agent_nonces (006) once it exists.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end
$$;

-- 2. Strip current access from the web-facing roles.
revoke all privileges on all tables    in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- 3. Keep newly created tables/sequences locked by default.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

commit;
