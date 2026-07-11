# 0006 — Supabase row-level-security posture

- Status: Accepted
- Date: 2026-07-11

## Context

`001-episodes.sql` enabled row-level security on all four episode tables
(`actors`, `episodes`, `episode_events`, `coordination_invites`) but
defined zero policies. The architecture is server-only and uses the
Supabase service role key exclusively — the service role has `BYPASSRLS`,
so application code keeps working. But the migration promised something
the rest of the system cannot enforce:

- Any query via the anon key returns an empty dataset silently (no error,
  no warning — `pg_class.relrowsecurity` is on, no policies match).
- Any future JWT-based access (Magic, Particle Auth, Supabase Auth) is
  silently broken.
- A future contributor adding a "read X via REST" path can introduce a
  silent privacy regression without triggering any error.

There is no authenticated identity in the system today. The architecture
explicitly resolves ownership from a signed HttpOnly cookie set
server-side (`src/identity/actor.ts`); clients never submit actor IDs.

## Decision

Disable row-level security on all four tables via the follow-up
migration `scripts/migrations/004-disable-rls-for-now.sql`. This makes
the current architectural posture explicit: **server-only via service
role; no policies yet because no auth model exists yet.**

The Supabase migration is the only acceptable place to flip this back on
when authenticated identity lands. The revert path:

1. `alter table ... enable row level security` again on the four tables.
2. `create policy <name> for select using (...)` per table — at minimum,
   policies that check the JWT subject against `actors.external_subject`.
3. `grant select, insert, update, delete on ... to anon, authenticated`
   as appropriate.
4. All four steps in a single transaction; do not ship partial RLS
   changes (partial is indistinguishable from "broken in production").
5. Verify the contract suite still passes against the live database and
   no anon path returns data it shouldn't.

Until that migration ships, the preflight script `scripts/check-supabase.mjs`
probes connectivity, confirms table existence, runs a write cycle on a
unique probe episode, and verifies the `episodes → episode_events`
foreign-key cascade. It does not read `pg_class.relrowsecurity` because
that catalog is not exposed via the PostgREST API; RLS auditing is left
to the Supabase dashboard SQL Editor and the eventual
`scripts/test-supabase-live.mjs` runner.

## Consequences

- Application code keeps working via the service role key.
- Future authenticated features must land an `enable RLS + policies +
  grants` migration as a single transactional commit.
- Privacy regressions via anon-key queries are explicitly out of scope
  for this sprint; they become possible the moment a public REST endpoint
  is introduced without that migration landing first.
- The dashboard SQL Editor is required for any operator who needs to
  verify RLS state during this intermediate period.

## Alternatives considered

- **Define explicit policies now.** Rejected: no authenticated identity
  provider is integrated yet, so policies would have to be modeled
  against the signed-cookie actor (which is not a JWT). Modeling policies
  against an auth path that doesn't exist invites mistakes, and partial
  RLS policies are worse than no policies because they look correct.
- **Leave RLS on with no policies.** Rejected: looks fine in dashboard
  audits, behaves identically to "broken in production" via any access
  path that doesn't match `BYPASSRLS`. The foot-gun shapes the rest of
  the system's mental model silently.
