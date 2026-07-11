# 0002 — Optimistic concurrency semantics

- Status: Accepted
- Date: 2026-07-11

## Context

Two adapters write to two different stores (in-memory Map and Supabase
Postgres). Last-writer-wins loses work; pessimistic locking is hostile to
the conversational shape because the practitioner is in flow and any visible
"lock acquired" interaction would break the journey. We need every command
applied serially per episode, and we need a single enforcement point that
works across adapters without each call site re-implementing it.

## Decision

Every `EpisodeCommand` carries an `expectedRevision`. The repository adapter
compares `expectedRevision` against the persisted `revision` before
accepting any write; a mismatch returns the message
`This intention changed. Refresh before trying again.` Both adapters honor
this:

- **Supabase** enforces the check via the `WHERE` clause on `UPDATE`
  (`.eq("id", id).eq("actor_id", actorId).eq("revision", expectedRevision)`
  chained with `.select("state").maybeSingle()`); zero rows
  affected ⇒ null result ⇒ translated to a "changed" error in the
  application layer. The actor filter is co-located with the revision
  filter, so a stale revision from a different actor cannot silently
  become a valid save on the same row.
- **Local** adapter enforces the check via an explicit
  `existing.revision !== expectedRevision` throw, and additionally defends
  the increment invariant (`episode.revision === expectedRevision + 1`).

The service layer (`applyEpisodeCommand` in `src/episodes/service.ts`)
always advances revision by exactly one (`stored.revision + 1`), so the
increment invariant is guaranteed at the application boundary even if an
adapter forgets to enforce it.

The episode API surface returns `409 Conflict` for stale-revision errors so
the UI knows to surface the journey's current state and let the
practitioner continue from where they are.

## Consequences

- Errors surface as 409 conflicts, never as silent overwrites.
- The UI shows the current `nextDecision` on conflict and asks the
  practitioner to continue.
- Revisions form a strict sequence visible in the append-only `events`
  log; the timeline is auditable.
- The contract suite (`contract.suite.ts`) pins down the rejection path so a
  drift in either adapter's behavior fails the build.

## Alternatives considered

- **ETag / If-Match on the entire episode.** Heavier wire weight for
  conversational journeys; no clear advantage; introduces a parallel
  negotiation that has to be kept in sync with the service layer.
- **Vector clocks.** Too lossy for our one-author model; we always know
  who owns a given episode, so a single monotonic counter is enough.
- **No concurrency control.** Produces silent overwrites in the case of
  cross-tab refreshes and parallelism between the UI and the automation
  runner; rejected.
