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

## Architecture

- **Next.js 16.2 / React 19** — application and route handlers
- **Episode repository** — authoritative intentions, recommendations, holds,
  coordination, and commitments; local adapter in development and Supabase in
  persistent deployments
- **Deterministic recommendation service** — one ranking policy shared by every
  recommendation and correction flow
- **Automation adapters** — monitoring, non-binding holds, and coordination
- **Cognee** — optional semantic recall; never transactional persistence
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
  behavior, and the 409 path for stale revisions. Run it after any change
  to the API surface, repository contract, or service orchestration.

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
