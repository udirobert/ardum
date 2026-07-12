# Ardum — the shape of your practice

*Ardum is mudra reversed. A mudra seals your practice. Ardum helps give it shape.*

Ardum is a persistent guide for intentions that may eventually become a yoga
retreat. A person begins with what they are trying to make space for. Mira
clarifies only what matters, keeps the intention alive over time, recommends
one appropriate next step, and can monitor, hold, coordinate, or book when the
person grants that authority.

Booking is an implementation detail. The product is continuity from intention
to outcome.

## Product principles

- **Intention before inventory.** Begin with the life outcome, not a catalog.
- **One decision at a time.** Ask only for judgment the system cannot supply.
- **Preserve momentum.** Monitor uncertainty instead of returning work to the
  person.
- **Earned agency.** Monitoring, sharing, holding, and booking require explicit,
  scoped consent.
- **Memory with boundaries.** Retained information is inspectable, correctable,
  exportable, and deletable.
- **Confidence over confirmation.** Success is when the person can stop
  worrying, not merely when a transaction succeeds.

The canonical product direction is in
[`docs/product-vision.md`](docs/product-vision.md). System boundaries and
sources of truth are in [`docs/architecture.md`](docs/architecture.md).
Architectural decisions are recorded as ADRs in
[`docs/decisions/`](docs/decisions/).

## Current journey

```text
capture or resume an intention
  → clarify the next uncertainty
  → recommend one action
  → monitor
  → place a non-binding hold
  → coordinate the people involved
  → commit when confidence is high enough
```

Mira remains present throughout the journey, but technical systems stay behind
clear boundaries. The episode database owns operational state. Semantic memory
adds context. Verifiable evidence supports recommendations. Payment and booking
providers execute an explicit commitment.

A non-committing re-ranking under a different priority balance is available
at any point. Balanced, restorative, and movement lenses share the same
evidence and never touch the episode. When a hold is active, the re-ranking
lives inside the disclosure so the user can confirm the hold still fits
without changing it — a confidence check, never an action.

## Architecture

- **Next.js 16.2 / React 19** — application and route handlers
- **Episode repository** — authoritative intentions, recommendations, holds,
  coordination, and commitments; local adapter in development and Supabase in
  persistent deployments
- **Deterministic recommendation service** — one ranking policy shared by every
  recommendation and correction flow
- **Lens toggle re-ranking** — three composite-weight balances (balanced,
  restorative, movement) reused from the existing `LENSES` registry in
  `src/agent/score.ts`. Re-runs the pure ranking over the same evidence;
  never mutates episode state. A controlled synthetic-pool property test
  pins that the toggle can flip the top pick on a mutually-exclusive pool.
- **Automation adapters** — monitoring, non-binding holds, and coordination
- **Memory subsystem** — a pure operational projector with an optional Cognee semantic-enrichment adapter; the per-route projector-only-vs-enriched contract is recorded as [ADR 0007](docs/decisions/0007-memory-architecture.md)
- **0G Storage** — optional immutable evidence; never episode state
- **Magic, Particle, Arbitrum** — optional commitment execution, loaded only
  when a person chooses to book
- **MediaPipe** — optional in-browser pose signals; raw frames remain local

## Develop

```bash
npm ci
npm run dev
```

The local adapters provide a deterministic, network-free journey. Optional
providers are enabled independently through `.env.local`; see
`.env.example` for the supported variables.

Before contributing:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Verify

The architecture is enforced by two layers of verification that catch
divergence at the boundary, not in production:

- `npm test` runs the shared repository contract suite against both the
  in-memory local adapter and a mocked Supabase client that mirrors the
  migration's primary-key and cascade rules. See
  `src/episodes/repositories/contract.suite.ts` and the architecture doc for
  the scenarios pinned down.
- `npm run smoke:journey [-- URL]` walks the canonical intake-to-booking
  journey against a live server (default `http://localhost:3000`) and
  asserts status transitions, the MatchResult shape, idempotent retry
  behavior, the 409 path for stale revisions, and the returning
  practitioner scenario (memory projection from siblings). Run it after
  any change to the API surface, repository contract, or service
  orchestration.
- `npm run smoke:ui [-- URL]` walks the server-rendered visible
  surface — the home-page returning-practitioner greeting
  (`data-testid="returning-greeting"`) and the /memory summary card
  (`data-testid="memory-summary"`) — and pins that both appear after
  a recommendation is surfaced and both vanish after the episode is
  deleted. Run it after any change to the home, /memory, or memory
  projection.

## Operations

Two operator surfaces touch live infrastructure and are documented in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md):

- `npm run e2e:loop` — re-seeds attestations on 0G Storage and deploys
  the retail escrow contract on Arbitrum Sepolia. Skips phases whose
  secrets are absent so a CI run or the smoke journey can call it
  without breaking.
- `npm run verify:automation` — probes `/api/internal/automation` to
  confirm the scheduler is alive and authorized. Exit codes: `0` ok,
  `1` unreachable, `2` unauthorized or missing config.

## Privacy and trust

- Personal intention data is never placed in URLs.
- Anonymous ownership is resolved server-side.
- Browser storage is a disposable cache, not a source of truth.
- Semantic memory is supplementary and may be absent without breaking the
  journey.
- Group invitations share only fields the owner explicitly approves.
- Holds are clearly labelled non-binding and show their expiry.
- A person can inspect, export, revise, or delete retained information.

## Repository shape

```text
src/
  app/          routes and user-facing workspaces
  episodes/     episode model, repository, and orchestration
  automation/   monitoring, hold, and coordination providers
  agent/        deterministic recommendation and optional explanation
  memory/       semantic-memory boundary
  evidence/     verifiable evidence boundary
  booking/      commitment execution providers
  components/   shared presentation
```

The structure evolves by consolidating existing modules into these boundaries,
not by maintaining parallel legacy implementations.
