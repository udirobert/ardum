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
| Mira orb posture | `mira-presence` projection from episode state | `MiraOrb` renders; semantic memory does not influence posture |
| Retreat claims | Evidence repository | 0G may provide immutable evidence references |
| Wider-aperture evidence (public web, opt-in cohort aggregates) | Evidence repository + aggregate projection | Never a social feed; never a ranking override by popularity — [0010](decisions/0010-wider-aperture-evidence.md) |

No operational decision may reconstruct state from semantic prose, URL payloads,
or local storage. The projector/observe/enrich split and the per-route
projector-vs-cognee contract that backs the Semantic context row above are in
[0007-memory-architecture](docs/decisions/0007-memory-architecture.md).

### Wider-aperture evidence (tier B / tier C)

Product decision: [0010-wider-aperture-evidence](decisions/0010-wider-aperture-evidence.md).
Beat 2 surfaces: [recommendation-reveal.md](design/recommendation-reveal.md).

```text
GET /api/episodes/[id]
  → loadWiderApertureStores()          (server-only)
      → episodeRepository.listContributionEpisodes()
      → projectCohortSlices()          (pure; n ≥ 30 gate)
      → evidenceRepository.listPublicEvidence()
  → resolveWiderApertureEvidence()     (pure; gates tier B/C rows)
  → EpisodeDetailPayload.widerApertureEvidence
  → RetreatExplorationView disclosure rows (conditional; no placeholders)
```

| Module | Role |
|---|---|
| `src/evidence/repository.ts` | Tier C — normalized public evidence from attestations (+ optional fetch adapter) |
| `src/evidence/project-cohort.ts` | Tier B — pure cohort slice projection from opted-in episodes |
| `src/evidence/load-wider-aperture-stores.ts` | Server assembly for episode detail |
| `src/evidence/resolve-wider-aperture.ts` | Visibility gates (sample size, confidence, shape match) |
| `src/evidence/adapters/http-fetch.ts` | Optional `EVIDENCE_FETCH_*` proxy for Exa / Firecrawl / Tinyfish |

Contribution is a **separate grant** on the episode (`widerApertureContribution`),
not implied by persistence consent on arrival. Commands:
`grant-wider-aperture-contribution` / `revoke-wider-aperture-contribution`
(post-booking only). Cohort aggregates never reorder the ranking policy.

## Boundaries

```text
UI / Agent API
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

### Progressive recognition

Recognition is earned in rungs, never gated on arrival. Decision record:
[0011-progressive-recognition](decisions/0011-progressive-recognition.md).

| Rung | Stored on | Surfaces | Authority |
|---|---|---|---|
| Voluntary name | `actors.preferred_name` | home greeting, voice lane, `/memory` | The person's explicit statement |
| Authenticated subject | `actors.external_subject` + `kind: 'authenticated'` | cross-device restore | Provider login (Magic, future) |
| Preference profile | `actors.profile` (JSONB) | `/memory`, ranking policy input | The person's explicit statement |
| Continuity CTA | n/a (offers rung 2) | post-booking, never on arrival | Practitioner opt-in |

The cookie remains the ownership primitive the adapter layer enforces. The
provider subject is the cross-device join key; it is never displayed to the
practitioner and never shared with retreats or invitees. Names and preferences
are private to the actor and deletable on `/memory` alongside episode history.

### Agent API identity

Agent API calls (`/api/agent/*`) don't use cookies. Identity is proven by
EIP-191 `personal_sign` over a canonical message that includes a nonce and
timestamp; the server verifies the signature recovers to the claimed
`agentAddress` and rejects replays outside a 5-minute skew window or with a
reused nonce.

`/api/agent/match` is now authenticated: the recovered address becomes the
episode's `actorId`. `/api/agent/book` checks `episode.actorId ===
agentAddress` — no `skipOwnershipCheck`. The repository's `get(episodeId)`
method (no actor filter) is still used on this path, but ownership is
enforced by the actorId match, not skipped. Cookie-based flows are
unchanged. See [0009-agent-api](decisions/0009-agent-api.md).

### Agent booking deposit verification

`/api/agent/book` does not trust the claimed `depositTxHash`. The server
fetches the transaction + receipt from the settle RPC and verifies:

- the transaction exists and is confirmed (blockNumber present);
- the receipt status is 1 (not reverted);
- the transaction sender equals `agentAddress`;
- for direct USDC `transfer(address,uint256)` calls, the recipient equals
  the configured escrow (or operator) and the amount equals `depositUsd`
  at 6 decimals.

Non-USDC-transfer transactions (Particle UA Type-4 bundles, escrow
`deposit()` calls) verify sender + success only; the internal value move
is not directly inspectable via simple RPC. The response surfaces
`depositVerification: "full" | "sender"` so consumers know which check
passed.

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

### Lens re-ranking as a derived view

Three composite-weight balances — the **lenses** in `src/agent/score.ts`:
balanced, restorative, movement — run the same pure ranking policy over the
same evidence and practitioner profile. Lenses are derived views: read-only
recomputations that never mutate episode state. The optional
`GET /api/episodes/[id]/perspectives` endpoint exposes them; authorization
is required and the response shape matches the surfaced recommendation.

The synthetic-pool property test in `src/agent/score.test.ts` makes one
guarantee verifiable rather than aspirational: on a 2-retreat pool with
mutually-exclusive energy/social claims, MOVEMENT_LENS can flip the top
pick to a retreat BALANCED ranked second, while BALANCED and RESTORATIVE
keep the top pick with a measurably higher composite under Restorative.
The hold-aware disclosure on the Workbench UI surfaces this guarantee to
the user with one calm caption: a re-ranking may flip the top pick — that
is what this surface is here to catch.

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

### Hold, solo, and coordination

A hold is the planning gate before commitment. Coordination is an **optional
branch** of an active hold, not a prerequisite of holding:

```text
recommend → hold
  → solo / no multi-party branch → ready to book
  → invite branch open → await responses → ready to book when agreement rules pass
  → release / revise / monitor
```

`nextDecision` must expose a commit path for solo practitioners (including a
social constraint of solitude) without forcing an invitation. Multi-party
agreement remains required only when that branch was opened.

**Dual-key (intentional):** after a solo hold, `episode.status` remains
`held` (presence stays `holding`) while `nextDecision.kind` is
`ready-to-book` (primary CTA: secure place). Status `ready-to-book` is
reserved for multi-party agreement. Never derive the commit CTA from status
alone — always use `nextDecision`. Full rationale:
[0008-agentic-commitment](decisions/0008-agentic-commitment.md) §7.

## Commitment execution

Booking and payment begin only after the episode is ready to book and the
person **explicitly grants** commitment (amount and bounds). Existing wallet,
account, escrow, and attestation integrations sit behind a lazy commitment
provider.

The product model is **grant, then ambient execution**:

| Layer | Responsibility |
|---|---|
| Episode / `nextDecision` | Whether commitment is the primary human decision |
| UI ceremony | Ready → identity only if missing → confirm amount and bounds |
| Commitment provider | Identity, routing, deposit, escrow, attestation; normalized status |
| Mira presence | `resolving` while securing, `arriving` when settled |

The provider returns normalized status and verifiable references. Technical
steps (account upgrade, chain routing, storage writes, wallet addresses) stay
in adapters, details, and logs — **not** named primary UI phases. Demo and
missing-provider failures use human failure copy; they must not surface env or
stack configuration as product text.

Success updates the episode commitment and lands the person on preparation and
continuous care, not a receipt of hashes. See
[product-vision.md](product-vision.md) and
[design/experience-layer.md](design/experience-layer.md).

## Agent API

Three A2MCP-compatible endpoints expose Ardum's booking infrastructure to
external AI agents. Any agent with a funded wallet can discover retreats,
execute bookings, and help operators list retreats — without a browser, a
cookie, or human wallet interaction. See
[0009-agent-api](decisions/0009-agent-api.md).

| Endpoint | Purpose |
|---|---|
| `POST /api/agent/match` | Intention + constraints → matched retreat(s) + episodeId |
| `POST /api/agent/attest` | Natural-language retreat details → validated attestation + pre-fill URL |
| `POST /api/agent/book` | Signed booking intent → attestation on 0G + episode booked |

Each endpoint has a `GET` service-discovery response. Agent calls use
signature-based identity (EIP-191), not cookies. The agent booking script
(`scripts/agent-book.ts`) demonstrates the full flow end-to-end.

### Operator identity (Particle Auth + ZeroDev)

The operator flow uses a separate account abstraction system from the
practitioner flow:

- **Practitioner**: Magic EOA → Particle UA (EIP-7702) → cross-chain deposit
- **Operator**: Particle Auth EOA → ZeroDev Kernel (ERC-4337) → gasless attestations

Particle Auth social login (Google) provides the operator EOA. ZeroDev
Kernel sponsors gas. A session key enables batch attestation writes without
re-signing each one. The /attest surface hides all crypto details behind
"Sign in with Google" — the operator never sees a wallet address, a chain
name, or a gas concept.

## Mira presence

Mira's orb posture is a pure projection from episode state — not from guessed
user emotion. `src/agent/mira-presence.ts` owns the contract;
`src/episodes/detail-payload.ts` assembles it into API responses; `MiraOrb`
renders it. Posture vocabulary, valence, reactions, and render tiers are
documented in [design/mira-presence.md](design/mira-presence.md).

Voice and visuals stay aligned because both read the same projection. Semantic
memory does not influence posture.

## Performance

- Personalized episode reads remain dynamic.
- Shared evidence reads may be cached by version.
- Heavy visual, pose, wallet, and provider code loads only when invoked.
- Mira orb WebGL contexts are capped per page; inline sizes use a simplified
  mask. See [design/mira-presence.md](design/mira-presence.md).
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
- `get` returns the episode by ID regardless of actor (agent API path only);
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

It walks two regression paths — **solo commit** (hold → book, no invite) and the
**invite branch** — capture → clarify → recommend → reject with
feedback → idempotent retry of the same command → stale-revision 409 →
re-recommend → monitor → hold (asserting solo `ready-to-book`) → optional
invite branch → participant response → resume after reload → record commitment
→ delete → confirm 404 — and pins the MatchResult shape (`retreatRootHash`,
`priceUsd`) consumed by the UI. Cookie handling is done in-script so the
journey exercises the signed HttpOnly actor cookie the way a browser would.

Flags: `--solo-only` (solo path only), `--invite-only` (invite branch only).
Default runs both.

The journey is the canary that nothing in the contract has been quietly broken
by a route-handler, parser, or service-layer change.

### Ranking policy property tests

`src/agent/score.test.ts` pins the deterministic ranking policy against
two layers of guarantee at once:

- **Seed-catalog conformance** — every retreat is ranked, every score
  stays within [0, 1], runner-ups shift between Balanced and the
  alternative lenses under at least one practitioner profile, and
  overrides versus defaults measurably change at least one score.
- **Synthetic-pool property** — a controlled 2-retreat pool with
  mutually-exclusive energy and social claims proves that
  MOVEMENT_LENS flips the top pick while BALANCED and RESTORATIVE keep
  it, with a measurably higher composite under Restorative. The pool
  is inline so changes to the seed catalog cannot affect the
  assertion.

Any change to `score.ts` that violates either guarantee fails the build.

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
