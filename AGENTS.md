<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product contract

Read `docs/product-vision.md` and `docs/architecture.md` before changing product
copy, domain behavior, persistence, recommendation, memory, or booking.
Commitment and booking surfaces also follow
`docs/decisions/0008-agentic-commitment.md` and `docs/design/experience-layer.md`.

Ardum manages a persistent life intention. Recommendations, holds,
coordination, and bookings are downstream actions. Do not organize the primary
experience as a marketplace, ranked-results page, or conversational checkout.
Commitment is a scoped grant, not a multi-phase rail walkthrough. Solo booking
is first-class; coordination is an optional branch of a hold.

# Core engineering principles

- **Enhancement first:** improve an existing component or boundary before
  creating another one.
- **Consolidation:** delete superseded code in the same change; do not preserve
  legacy implementations for reference.
- **Prevent bloat:** audit imports, routes, dependencies, and overlapping
  features before adding behavior.
- **DRY:** shared logic and contracts have one source of truth.
- **Clean:** domain dependencies are explicit; provider SDKs stay in adapters.
- **Modular:** pure, composable modules with independently testable contracts.
- **Performant:** load expensive visuals and providers only when needed; cache
  only data whose ownership and invalidation are clear.
- **Organized:** use predictable domain-driven folders and avoid generic
  dumping grounds.

# Source-of-truth rules

- The episode repository owns operational state.
- The actor profile repository (`src/identity/actor-profile.ts`) owns
  actor-level state: `preferred_name`, `profile` (preferences),
  `external_subject`. These fields are private to the actor and deletable
  on `/memory`.
- The deterministic ranking policy owns recommendation ordering. The
  policy includes a "Preference fit" axis (weight 0.10) that consumes
  explicit preferences from the actor profile as a soft tie-breaker;
  it never overrides energy, social, or budget fit.
- Derived ranking views (lens re-rankings and similar) never mutate episode state.
- Semantic memory is supplementary and lossy. The projector/observe/enrich split and the per-route projector-vs-cognee contract are documented in [0007-memory-architecture](docs/decisions/0007-memory-architecture.md).
- 0G contains evidence, not journey state.
- Browser storage is a disposable cache.
- Client-supplied identifiers never establish ownership.
