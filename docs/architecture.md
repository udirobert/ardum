# Architecture

## Core aggregate

An `Episode` is the authoritative record of one intention-to-outcome journey.
It owns intention revisions, current context, recommendation snapshots,
monitoring, non-binding holds, coordination, commitments, and the next decision.

All state transitions are episode commands. They are validated, authorized,
idempotent where externally visible, and guarded by an expected revision.

## Sources of truth

| Concern | Authority | Role of other systems |
|---|---|---|
| Intention and journey state | Episode repository | Browser state may cache a revision |
| Recommendation ordering | Deterministic ranking policy | A model may explain but cannot reorder |
| Availability and hold status | Normalized provider observation | Episode stores the observation and provider reference |
| Group responses | Episode coordination state | Invitation URLs carry opaque tokens only |
| Booking settlement | Commitment provider plus verified reference | Episode stores normalized status |
| Semantic context | Cognee when configured | Supplementary, lossy, never operational truth |
| Retreat claims | Evidence repository | 0G may provide immutable evidence references |

No operational decision may reconstruct state from semantic prose, URL payloads,
or local storage.

## Boundaries

```text
UI
  → Episode service
      → Episode repository
      → Recommendation policy
      → Automation providers
          → Monitoring
          → Hold
          → Coordination
      → Commitment provider
      → Semantic memory projection
      → Evidence repository
```

Dependencies point inward toward domain contracts. Provider SDKs remain in
adapter modules and do not leak their types into episode or UI code.

## Identity and authorization

Anonymous use receives a signed HttpOnly actor cookie. Route handlers resolve
the actor server-side and repositories enforce episode ownership. Raw actor IDs
are not accepted from clients.

An authenticated provider may later attach an external subject to the actor.
Authentication expands continuity; it does not change the episode contract.

Coordination invitations use random, expiring tokens. Only a hash is stored.
The invitation view exposes the minimum proposal fields approved by the owner.

## Persistence

The local repository and Supabase repository implement the same contract.
Supabase uses:

- `actors` for ownership;
- `episodes` for revisioned aggregate state and indexed due times;
- `episode_events` for the append-only timeline;
- `coordination_invites` for hashed public capabilities.

Browser cache entries contain an episode ID, schema version, repository
revision, summary, and expiry. A cache can improve first paint but cannot
authorize or perform a transition.

## Recommendation

One pure ranking policy consumes:

- the current intention revision;
- the current context and constraints;
- normalized evidence;
- normalized availability observations.

It returns ordered candidates, but the product surfaces one recommendation.
Every result stores its input intention version and ranking-policy version.
Corrections revise the intention or constraints and run the same policy.

Optional language generation receives the computed decision and may summarize
its rationale. It cannot invent evidence, change scores, or reorder candidates.

## Automation

Monitoring, holds, and coordination use provider interfaces with deterministic
local implementations:

- `MonitoringProvider.observe`
- `HoldProvider.create`, `status`, and `release`
- `CoordinationProvider.createInvite` and `redeemInvite`

The automation runner leases due work, calls one provider, normalizes the
result, appends an episode event, and schedules the next check. Injected clocks
and ID factories keep local behavior and tests deterministic.

Soft holds are explicitly non-binding. Their provider, reference, status, and
expiry are always visible.

## Commitment execution

Booking and payment begin only after the episode reaches `ready_to_book` and the
person explicitly commits. Existing wallet, account, escrow, and attestation
integrations sit behind a lazy commitment provider.

The provider returns normalized status and verifiable references. Technical
steps are available in details and logs, not narrated as the central product.

## Performance

- Personalized episode reads remain dynamic.
- Shared evidence reads may be cached by version.
- Heavy visual, pose, wallet, and provider code loads only when invoked.
- One cloud/WebGL surface may be active at a time, with static and
  reduced-motion fallbacks.
- The primary decision renders without waiting for semantic recall or optional
  explanation.

## Failure behavior

The episode remains usable when optional memory, evidence, explanation, or
commitment providers are unavailable. Failed commands do not discard the prior
valid recommendation or state. Retries repeat only the failed idempotent
operation.

## Verification boundaries

The repository contract and the end-to-end smoke journey are the two
enforcement points that keep the architecture honest.

### Repository contract

`src/episodes/repositories/contract.suite.ts` runs the same eleven
conformance scenarios against both adapters:

- `getOwned` returns the episode only for its actor and undefined otherwise;
- `listOwned` returns the actor's episodes, newest first (descending
  `updatedAt`);
- `create` rejects duplicate episode ids; the Supabase mock enforces the
  primary-key constraint declared in `scripts/migrations/001-episodes.sql`;
- `save` rejects a stale `expectedRevision` with a `changed` / `refresh` /
  `revision` error (the WHERE clause in Supabase, the explicit revision
  check in the local adapter);
- `save` rejects writes from a non-owner;
- `save` round-trips the freshly saved state back through `getOwned`;
- `createInvite` / `getInvite` round-trip accepts a `tokenHash` only and
  silently ignores raw tokens;
- `respondToInvite` rejects a second response against the same token hash;
- `respondToInvite` rejects any response once `expiresAt` has passed;
- `listDue` surfaces only episodes whose monitor `nextCheckAt` has elapsed
  and whose status is still `active` (the runner currently acts on monitor
  ticks; active-hold expiry is folded into the next episode command via
  `withExpiredHold`);
- `deleteOwned` is silent for a non-owner and cascades coordination
  invitations through the foreign-key chain declared in the migration.

Both adapters are run from the same suite. The Supabase adapter runs against
the in-memory client in `src/episodes/repositories/__mock-supabase.ts`, which
mirrors the migration's primary-key constraints and cascade rules so
optimistic concurrency and cascade deletion behave exactly as the live database
would. Any adapter that diverges from the contract fails the build.

### End-to-end smoke journey

`scripts/smoke-journey.mjs` runs against a live server (local or deployed):

```bash
npm run smoke:journey                          # localhost:3000
npm run smoke:journey -- https://ardum.app     # deployed
```

It walks the canonical path — capture → clarify → recommend → reject with
feedback → idempotent retry of the same command → stale-revision 409 →
re-recommend → monitor → hold → invite → participant response → resume after
reload → record commitment → delete → confirm 404 — and pins the MatchResult
shape (`retreatRootHash`, `priceUsd`) consumed by the UI. Cookie handling is
done in-script so the journey exercises the signed HttpOnly actor cookie the
way a browser would.

The journey is the canary that nothing in the contract has been quietly broken
by a route-handler, parser, or service-layer change.

## Release gate

```bash
npm run typecheck       # tsc --noEmit
npm test                # vitest, including both repository adapters
npm run lint            # eslint
npm run build           # next build
npm run smoke:journey   # against a running instance
```

The journey step is optional in development but required before merging any
change that touches the API surface or repository contract.
