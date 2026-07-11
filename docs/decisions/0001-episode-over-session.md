# 0001 — Episode over session

- Status: Accepted
- Date: 2026-07-11

## Context

The previous shape was a session/match-runs funnel where each visit created
a session, ran a match, possibly corrected it, and possibly booked. Sessions
were mutable blobs any service could write to. Corrections and recommendations
did not link cleanly back to the practitioner's evolving intention. Semantic
memory stood in for cross-session state by reconstructing operational facts
from prose, which leaked into the UI as overrides the practitioner did not
ask for.

## Decision

Replace session/match-runs with a revisioned `Episode` aggregate. An Episode
owns:

- revisioned `intentions` (statement, desired shift, constraints, change
  reason, createdAt);
- `status` and the computed `nextDecision`;
- one authoritative `recommendation` snapshot (intention version, ranking
  policy version, result, alternatives, uncertainties, generatedAt);
- `monitor` criteria/observations;
- a non-binding `hold` with provider and expiry;
- `coordination` proposal/responses;
- an optional `commitment` reference;
- an append-only `events` log.

`src/episodes/` owns the model, the discriminated command union, the service
that applies commands, the deterministic `recommendForEpisode`, and the
repository adapter boundary.

## Consequences

- Every URL references an Episode id; never a client-supplied actor id.
- Corrections preserve intent history because every revise appends a new
  `IntentionRevision`.
- Ranking policy version is captured per snapshot, so future ranking changes
  are not retroactively applied.
- The episode repository owns operational truth; semantic memory is reduced
  to lossy recall; 0G holds immutable evidence only; browser storage is a
  disposable cache.

## Alternatives considered

- **Sessions plus an immutable audit log.** Keeps the cache shape but bakes
  in write-amplification the conversational shell cannot afford, and the
  audit log still needs a separate schema for cross-session reads.
- **Keep match-results as the primary surface.** Leaves the rest of the
  journey stateless and reintroduces the regex reconstruction we left
  behind.
- **Abandon stateful journeys entirely; return to a stateless catalog.**
  Conflicts with the product vision: a persisted intention is the unit of
  value.
