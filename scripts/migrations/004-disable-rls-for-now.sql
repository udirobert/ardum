-- 004-disable-rls-for-now.sql
--
-- 001-episodes.sql ended with `alter table ... enable row level security`
-- on all four episode tables but defined zero policies. RLS-on with no
-- policies is a foot-gun: the service role bypasses RLS so app code keeps
-- working, but anything that ever queries via the anon key (or a future
-- JWT) sees an empty dataset silently. The architecture is server-only
-- today, but the migration promised something the rest of the system
-- cannot enforce.
--
-- This migration makes the current posture explicit:
--   "server-only via service role; no policies yet because no auth
--    model exists yet."
--
-- When authenticated identity lands (Magic, Particle Auth, etc.):
--   1. Land a follow-up migration that does all three below in one
--      transaction:
--        alter table ... enable row level security;
--        create policy ... for select using (auth.uid() ...);
--        create policy ... for insert with check (...);
--        create policy ... for update using (...) with check (...);
--        create policy ... for delete using (...);
--   2. Grant the relevant role (anon, authenticated) access.
--   3. Verify the contract suite still passes against the live database
--      and that no anon path returns data it shouldn't.
-- Do not ship partial RLS changes — partial is indistinguishable from
-- "broken in production."
--
-- See docs/decisions/0006-supabase-rls-posture.md for the rationale and
-- the revert path.

begin;

alter table public.actors                   disable row level security;
alter table public.episodes                 disable row level security;
alter table public.episode_events           disable row level security;
alter table public.coordination_invites     disable row level security;

commit;
