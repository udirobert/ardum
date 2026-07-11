# 0003 — Mock fidelity for contract tests

- Status: Accepted
- Date: 2026-07-11

## Context

We need to verify both the local and Supabase adapters honor the same
`EpisodeRepository` contract without spinning up real Postgres inside CI.
Naively running a real Postgres instance in CI adds network latency,
flakiness, and a parallel migration surface that drifts from the
connection-using tests over time.

A pure unit test of the in-memory local adapter is cheaper but does not
prove the Supabase adapter honors the same invariants.

## Decision

Build `src/episodes/repositories/__mock-supabase.ts`, a hand-rolled stand-in
for `@supabase/supabase-js`. It implements the PostgrestQueryBuilder fluent
shape we rely on:

- `from(table).insert | upsert | update | delete | select`
- chained `.eq | .lte | .is | .not | .order | .limit`
- `.select(...).single | maybeSingle`
- a `then` that produces the actual run result

It mirrors two fidelity points from the live database:

1. **Primary-key constraints.** The mock enforces PK uniqueness on insert
   (mirrors the `PRIMARY KEY` clauses in
   `scripts/migrations/001-episodes.sql` for `actors.id`, `episodes.id`,
   `episode_events.id`, and `coordination_invites.token_hash`).
2. **Foreign-key cascade deletes.** When a row is deleted from `episodes`,
   rows in `coordination_invites` and `episode_events` whose `episode_id`
   matches the deleted `episodes.id` are removed (mirrors the
   `ON DELETE CASCADE` clauses on those FKs).

Optimistic concurrency on
`.update(...).eq("revision", expectedRevision).select(...).maybeSingle()`
returns `data: null` when no row matches, exactly as Supabase does, which
the Supabase adapter translates into the "changed" error path.

The contract suite (`src/episodes/repositories/contract.suite.ts`) exports
`runRepositoryContract(label, factory, reset)` and runs the same eleven
conformance scenarios against any adapter, in-process.

## Consequences

- The contract suite runs both adapters against the same in-process mock;
  CI is fast and deterministic; no Postgres container required.
- Coverage gaps map 1:1 to missing mock fidelity. The design is honest
  about what it does and does not cover.
- The mock does **not** model SQL type coercion, RPC semantics,
  PostgREST content negotiation, or RLS policies. The smoke journey
  (`scripts/smoke-journey.mjs`) exercises those against real deployments.
- Test isolation requires the same `state.client` reset hook between tests;
  `vi.hoisted` wires this for vitest.

## Alternatives considered

- **Docker Postgres in CI.** Heavy, slow, and adds a runtime the team has
  to maintain; cache pulls alone can double CI minutes.
- **pg-mem.** Closer to SQL semantics but does not implement the
  fluent PostgrestQueryBuilder shape, which is what the adapter actually
  relies on.
- **Real cloud Postgres with ephemeral test databases.** Fast enough, but
  every CI run incurs a network round-trip and a connection-pool fight;
  cost and quotas make nightly runs hard.
