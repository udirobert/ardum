# 0007 — Memory subsystem architecture

- Status: Accepted
- Date: 2026-07-13

## Context

The Ardum journey produces operational history (episodes, recommendations,
holds, bookings) that needs to be surfaced as recognition for returning
practitioners. A naive approach reconstructs facts from free-form prose
(via Cognee recall), but that path is lossy, slow, and silently lets
semantic recall override operational truth. AGENTS.md is explicit:
"Operational truth belongs to the episode repository. Semantic memory
can help Mira recognize patterns and language, but it is lossy context
rather than a ledger."

The recent waves built a memory subsystem on top of that rule. The
question this ADR records is *which* surface gets the projector, which
gets the enrichment, and how the home page and `/memory` page render
the recognition layer on first paint.

## Decision

### Three modules, one pure projector

`src/memory/projector.ts` is **pure** — no env reads, no async, no SDK
imports. Given an actor id and a list of episodes, it returns a
`MemoryContext` derived deterministically from episode contents:

- `pastMatches` (every surfaced recommendation, newest first)
- `pastBookings` (recommendations whose episode has `commitment.status === "booked"`)
- `energyHistory` (every stated energy across every intention revision, oldest first)
- `isReturning` (true when at least one match or booking exists)
- `pastNotes`, `priorCheckIns`, `rawRecall` — left empty; belong to the
  semantic-memory adapter, not the projector
- `provider` — `"none"` until Cognee speaks

`src/memory/observe.ts` is the only module that imports
`cogneeMemory`. It exposes a single `fireSemanticRemember(actorId, text)`
helper that does a `void cogneeMemory.remember(...).catch(() => {})` —
fire-and-forget so the episode transition never blocks on Cognee.
Keeping it out of `projector.ts` keeps the `import "server-only"`
boundary from leaking into any importer of the pure projector.

`src/memory/enrich.ts` is the bridge. `enrichWithSemanticMemory` calls
`semantic.recall()` with a bounded timeout (default 800 ms) and, when
recall is non-empty, lifts `pastNotes` (truthy-filtered, capped at 5)
and bumps `provider` to `"cognee"`. The single entrypoint
`projectActorMemory(actorId, episodes, semantic?, opts?)` wraps
projector-under-semantic so every caller shares one code path.

### Which routes are projector-only vs enriched

| Surface | Projector | Cognee | Rationale |
| --- | --- | --- | --- |
| `/` (home greeting) | yes | no | Recognition uses operational fields only; SSR must not block on remote recall. |
| `/memory` (summary card) | yes | no | Recognition uses operational fields only; SSR must not block. |
| `GET /api/episodes` (list) | yes | yes | The list serves each episode equally; pastNotes is supplementary context for the practitioner scanning history. |
| `GET /api/episodes/[id]` (detail) | yes | yes | matchLetter gates recognition on `isReturning` (operational) but weaves pastNotes only when `provider !== "none"` (semantic). |
| `GET /api/memory` | yes | no | Mirrors the home page philosophy: operational summary, never blocks on Cognee. |

The contract: a route is projector-only when it is on the **first paint**
of the practitioner journey (home, /memory). A route is enriched when
the practitioner is already inside an episode and the pastNotes weave
is a small-blast-radius supplement.

### Returning-practitioner rule

`isReturning` is `true` when at least one past match or past booking
exists for the actor. The detail route `/api/episodes/[id]` filters the
current episode id out of the siblings list before projection so
`matchLetter()` can read `pastMatches[0]` as a *prior* journey, not the
very pick it is about to surface. Without this filter, the recognition
line would name the recommendation we're showing the practitioner and
the wow moment would collapse into a tautology.

The list and `/memory` routes do NOT apply this filter — there is no
"current vs prior" distinction in those views. The detail route
documents the filter inline; the list route documents the no-filter
case inline with a cross-reference.

### Recall-timeout default

`EnrichOptions.recallTimeoutMs` defaults to `800 ms` in
`enrichWithSemanticMemory`. Long enough for a warm network roundtrip to
a typical Cognee deployment, short enough that a slow or unreachable
Cognee never blocks SSR or an API path. The timeout uses a
`Promise.race`-style `withTimeout` helper that resolves to `null` on
either timeout or recall-throw, and the projection passthrough is the
default when recall is empty. Overridable per call for tests that want
to exercise the timeout path explicitly (see
`src/memory/enrich.test.ts`).

### /memory server/client split

`src/app/memory/page.tsx` is a server component. It reads the actor
cookie with `resolveActor()`, lists episodes with
`episodeRepository.listOwned`, and projects memory with
`projectActorMemory(actorId, episodes)` — projector-only, no `semantic`
argument. The inlined `<aside data-testid="memory-summary">` lands in
the initial server-rendered HTML so the test surface (smoke-ui.mjs) can
assert the data-testid on first paint.

`src/app/memory/MemoryView.tsx` is the client island. It receives
`episodes: Episode[]` as a prop from the server, holds `useState` for
the delete-confirmation message and the `pending` flag, and uses
`useTransition` so `router.refresh()` post-delete gates the buttons
until the server-side re-render lands. The list itself is read-only;
`Continue` is a plain `<Link>` to `/episode/[id]`, `Export JSON` uses
`Blob` + `URL.createObjectURL`, and `Delete` is guarded by
`window.confirm`.

The split mirrors the home page pattern: server reads and projects,
client handles the actions that genuinely require the browser.

### Smoke pins

`scripts/smoke-ui.mjs` exercises the projector passthrough on the
visible surface: a fresh visitor sees no `data-testid="memory-summary"`
or `data-testid="returning-greeting"`, surfacing a recommendation
makes both appear, and deleting the episode makes both disappear. The
test pins `pastMatches[0].title` in the body of the summary card so a
regression that bypasses `pastMatches[0]` fails the assertion. The
walking step captures `epRecTitle` from the recommend response and
passes it forward; the assert guard `epRecTitle !== "" && ...` is the
loud-failure discriminator if the walking step aborts before the
recommend POST returns.

## Consequences

- The pure projector is testable in isolation (8 cases in
  `projector.test.ts`) without env or SDK setup.
- The Cognee call site is one function (`fireSemanticRemember`); any
  future change to the Cognee integration lives in `cognee.ts` and
  `observe.ts` only.
- The "which route gets what" decision is documented per route in the
  table above; future contributors add new routes by following the
  first-paint rule, not by re-deriving the policy.
- The `withTimeout` helper means a misconfigured or unreachable Cognee
  cannot block SSR for any surface. The default of 800 ms is a
  judgement call; raising it requires updating this ADR and the
  lockdown test.
- The server/client split for `/memory` is one extra file
  (`MemoryView.tsx`); the summary card is intentionally inlined in
  `page.tsx` because the card is ~30 lines of JSX used exactly once
  and extracting it does not earn its keep.

## Alternatives considered

- **Projector + enrichment at every route.** Highest recognition
  fidelity, but every SSR path would have to choose between blocking
  on Cognee (bad UX) or skipping pastNotes on first paint (defeats
  the weave). The split above localizes that trade-off to the routes
  that already presuppose a practitioner inside an episode.
- **Single Cognee-backed memory layer, no projector.** The pure
  projector is a regression guard: a future contributor cannot
  accidentally make Cognee authoritative over operational truth
  because the projector does not import Cognee.
- **Pre-render the summary card at the home page only.** Recognition
  belongs on every surface that lists operational history. The
  `/memory` page is the practitioner's first stop when they want to
  inspect what Mira is keeping in mind, so the summary card belongs
  there too.
- **Server-render `/memory` as a single `use client` page that
  fetches the projection on mount.** Smoke-ui.mjs can then only assert
  the testid after hydration, which is a worse signal than asserting
  it on first paint. Server-rendered first-paint is the contract
  AGENTS.md asks for ("no flicker").
