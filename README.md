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
- **Grant, don’t execute.** Commitment is a scoped authority grant; Mira runs
  payment and evidence rails. Stack vocabulary stays secondary.
- **Solo first-class.** Coordination is an optional branch of a hold, not a
  gate to booking.
- **Memory with boundaries.** Retained information is inspectable, correctable,
  exportable, and deletable.
- **Confidence over confirmation.** Success is when the person can stop
  worrying, not merely when a transaction succeeds.

The canonical product direction is in
[`docs/product-vision.md`](docs/product-vision.md). System boundaries and
sources of truth are in [`docs/architecture.md`](docs/architecture.md).
Agentic commitment is
[`docs/decisions/0008-agentic-commitment.md`](docs/decisions/0008-agentic-commitment.md).
Architectural decisions are recorded as ADRs in
[`docs/decisions/`](docs/decisions/).

## Current journey

```text
capture or resume an intention
  → clarify the next uncertainty
  → recommend one action
  → monitor (optional)
  → place a non-binding hold
  → coordinate only if others must agree (optional branch)
  → grant commitment when confidence is high enough
  → prepare (practice begins; rails stay inspectable, not central)
```

Mira remains present throughout the journey, but technical systems stay behind
clear boundaries. The episode database owns operational state. Semantic memory
adds context. Verifiable evidence supports recommendations. Payment and booking
providers execute an **explicit grant** — the person confirms amount and bounds;
Mira handles the rest.

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
- **Particle Auth + ZeroDev Kernel** — operator identity (Google social login)
  and gasless attestation writes; separate from the practitioner's Magic/UA flow
- **Agent API** — three A2MCP-compatible endpoints (`/api/agent/match`,
  `/api/agent/attest`, `/api/agent/book`) that expose Ardum's booking
  infrastructure to external AI agents. See
  [ADR 0009](docs/decisions/0009-agent-api.md).
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
- `npm run smoke:grant [-- URL]` walks the return-booker grant ceremony in a
  real browser (cold Magic session → identity CTA; dev `?smokeRestore=1` hook
  → Welcome back + Confirm deposit). Requires agent-browser.
- `npm run smoke:journey [-- URL]` walks solo hold → book and the invite-branch
  journey against a live server (default `http://localhost:3000`) and
  asserts status transitions, the MatchResult shape, idempotent retry
  behavior, the 409 path for stale revisions, and the returning
  practitioner scenario (memory projection from siblings). Flags:
  `--solo-only`, `--invite-only`. Run it after any change to the API
  surface, repository contract, or service orchestration.
- `npm run smoke:ui [-- URL]` walks the server-rendered visible
  surface — the home-page returning-practitioner greeting
  (`data-testid="returning-greeting"`) and the /memory summary card
  (`data-testid="memory-summary"`) — and pins that both appear after
  a recommendation is surfaced and both vanish after the episode is
  deleted. Run it after any change to the home, /memory, or memory
  projection.

## Operations

Three operator surfaces touch live infrastructure and are documented in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md):

- `npm run e2e:loop` — re-seeds attestations on 0G Storage and deploys
  the retail escrow contract on Arbitrum Sepolia. Skips phases whose
  secrets are absent so a CI run or the smoke journey can call it
  without breaking.
- `npm run verify:automation` — probes `/api/internal/automation` to
  confirm the scheduler is alive and authorized. Exit codes: `0` ok,
  `1` unreachable, `2` unauthorized or missing config.
- `npx tsx scripts/agent-book.ts` — demonstrates the full agent-driven
  booking flow (capture → clarify → recommend → hold → on-chain deposit →
  attestation). A real booking was executed and verified on Arbitrum
  Sepolia (1 USDC to escrow, block 288972600).

## Agent API

Ardum exposes three A2MCP-compatible endpoints for external AI agents.
These make Ardum listable as an Agent Service Provider on OKX.AI and
other agent marketplaces. See [ADR 0009](docs/decisions/0009-agent-api.md).

| Endpoint | Purpose |
|---|---|
| `GET/POST /api/agent/match` | Intention + constraints → matched retreat(s) |
| `GET/POST /api/agent/attest` | Retreat details → validated attestation + pre-fill URL |
| `GET/POST /api/agent/book` | Signed booking intent → attestation on 0G + episode booked |

Each `GET` returns a service-discovery response. Agent calls use
signature-based identity (EIP-191 `personal_sign`), not cookies.

The operator flow is de-jargoned: a non-crypto yoga teacher signs in with
Google, fills out a form, and clicks "Publish retreat." The crypto
infrastructure (Particle Auth, ZeroDev, 0G, Arbitrum) is real but invisible.

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

## Next steps

The infrastructure is real and verified. The remaining work is making the
service real for actual users:

1. **Onboard one real retreat operator.** A non-crypto yoga teacher creates
   a real attestation via `/attest` (Google sign-in → form → publish). This
   is the test of whether the de-jargoned UX actually works for someone who
   doesn't know what a wallet is.

2. **List on OKX.AI as an A2MCP ASP.** Register the matching endpoint
   (`/api/agent/match`) as a free Agent Service Provider. Review takes ~24
   hours. See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the steps.

3. **Post on X with #OKXAI.** 90-second demo showing an agent calling the
   match endpoint, getting a retreat recommendation, and executing the
   booking — with a link to the verified Arbiscan transaction.

4. **Integrate with one real agent.** Not a script — an actual AI agent
   (travel planner, wellness coach, calendar assistant) that uses Ardum as
   its booking layer for real users. This is the "do things that don't
   scale" step that turns the distribution thesis from a claim into
   evidence.

5. **Expand the retreat pool.** Each real operator attestation replaces a
   seed entry. The matching pool grows from curated seeds to real inventory.
