# 0008 — Agentic commitment (booking as grant)

- Status: Accepted
- Date: 2026-07-16

## Context

Upstream journey work (intention, clarification, one recommendation, soft
hold, coordination, lens re-rankings as derived views) already matches the
product contract in [product-vision.md](../product-vision.md). Commitment
execution did not.

The implementation narrates Magic sign-in, Universal Account upgrade, deposit
routing, chain settlement, and 0G attestation as user-facing phases of a
“conversation.” That reintroduces checkout and crypto onboarding at the climax
of a product whose job is confidence under uncertainty, not rail completion.

Separately, `nextDecision` only surfaces `ready-to-book` when a hold is active
**and** at least one coordination response is `"yes"`. Solo practitioners —
including those who chose a solitude social constraint — cannot complete
commitment without inviting someone who will never be required. Coordination
became a universal gate instead of an optional multi-party branch.

Architecture already states that technical steps belong in details and logs.
This ADR records the product decision that closes the gap between that rule and
the commitment surface.

## Decision

### 1. Commitment is a grant, not an execution walkthrough

The person grants scoped authority (amount, bounds, irrevocability rules).
Mira executes identity, payment plumbing, escrow, and evidence writes inside
that grant. Provider SDKs remain in adapters; their vocabulary does not define
primary UI phases.

Primary path human moments (at most three):

1. **Ready** — confidence is high enough to secure the place.
2. **Identity if missing** — progressive auth only when no durable payment
   identity exists.
3. **Confirm amount and bounds** — one explicit commit action.

Internal transitions (account upgrade, cross-chain route, escrow, attestation)
are ambient Mira work under posture `resolving` → `arriving`, with human status
copy. They are not named user phases.

### 2. Solo is first-class; coordination is optional

`ready-to-book` (or equivalent next-decision kind) is reachable when:

- a non-binding hold is active, **and**
- either no multi-party branch was opened (solo / “just me”), **or**
- coordination is satisfied under the rules of the opened branch.

Opening an invite is an explicit branch from the hold, not an automatic
requirement of holding. A social constraint of solitude must bias toward the
solo path, never force an invitation.

Target decision tree:

```text
recommend
  ├─ hold
  │    ├─ secure my place     (solo / no others required)
  │    ├─ invite others       (optional multi-party branch)
  │    │    ├─ agreement → secure my place
  │    │    ├─ wait / decline → re-decide
  │    │    └─ release hold
  │    └─ watch / revise / release
  └─ not this → feedback → re-clarify / re-rank
```

### 3. Rails stay secondary and inspectable

Escrow, chain settlement, wallet references, and storage attestations remain
real, verifiable, and available under disclosure (e.g. “How this is secured”),
logs, and partner-facing surfaces. They must not:

- appear as primary CTAs or phase titles;
- surface demo/env configuration language to practitioners;
- invert the copy hierarchy (letter → decision → status → provenance).

Demo and missing-provider states use Mira’s failure register (“I could not
complete that yet. Nothing was charged.”), not stack configuration copy.

### 4. Surface hierarchy on the workbench

Every state still presents one primary human decision. Secondary tools
(lenses, budget/energy counterfactuals, alternatives, monitor detail,
provenance) stay secondary:

- never mutate a hold;
- collapse into disclosure when a hold is active and uncertainty is low;
- expand when uncertainty is high or the person asks “what if.”

Operator chrome (raw revision numbers as hero metadata, wallet substrings as
primary status) does not belong in the decision card.

### 5. Success is preparation, not receipt

After commitment, the default landing is the preparation plan and continuous
care (what Mira will watch next). Share/referral, if present, stays in Mira’s
voice. Provenance is a quiet line, not the hero.

### 6. Durable identity compounds agency

Returning practitioners with a durable payment identity skip identity theater
and face the same grant with less ceremony. Expanding continuity must never
silently expand spend authority.

Implementation:

- Magic session restore runs before the grant surface shows identity vs
  confirm (`sessionReady`).
- A disposable browser hint (`ardum:payment-identity`) only shapes welcome
  copy and avoids CTA flash — it is never authorization.
- Confirm amount remains required on every booking.

### 7. Episode `status` vs `nextDecision` (dual-key, intentional)

**Decision: keep both keys; do not promote solo holds to status
`ready-to-book`.**

| Field | Solo hold (no invite) | Multi-party after yes |
|---|---|---|
| `episode.status` | `held` | `ready-to-book` |
| `nextDecision.kind` | `ready-to-book` | `ready-to-book` |
| Mira posture (from status) | `holding` | `offering` |

Rationale:

- **Status** is operational posture for presence, automation, and list
  scans. A soft hold should still *feel* held while the person decides.
- **`nextDecision`** is the one primary human CTA. Solo commitment is
  available without forcing invite; that is expressed as
  `kind: "ready-to-book"`, not by overloading `status`.
- Status `ready-to-book` remains the multi-party signal that agreement
  landed (invite response path). Presence may bloom (`offering`) once
  others agree; solo stays `holding` until deposit converts the hold.

Do not reconstruct readiness from status alone. UI and API consumers that
need the primary action must read `nextDecision`. Presence must continue
to project from status + hold/monitor signals, not from inventing a new
status for solo readiness.

### 8. Secondary tools are uncertainty-gated

Lenses, budget/energy counterfactuals, and alternatives expand when:

- recommendation uncertainties are non-empty, or
- the person opens “this doesn’t feel right”, or
- no hold is active yet (pre-hold inspection).

They collapse under an **active hold with low uncertainty** so the letter
and grant stay primary. They never mutate holds.

## Consequences

- Product and experience docs treat commitment as grant + ambient execution;
  implementation should converge (collapse user-facing phases in
  `ConversationalBooking` / `CommitmentPanel`, humanize ambient ritual labels,
  demote rail copy).
- Episode decision logic must unlock solo `ready-to-book` without a forced
  invite; multi-party remains when the person opens that branch.
- Smoke journeys and UI smoke should eventually walk the solo hold → commit
  path as the canonical happy path, with invite as a branch scenario.
- Provider adapters (Magic, Particle, escrow, 0G) stay lazy and optional;
  their absence must not break the episode or invent fake user phases.
- Architecture’s commitment boundary is unchanged: episode reaches readiness,
  person explicitly commits, provider returns normalized status and references.

## Alternatives considered

- **Keep narrated multi-phase booking as product differentiation.** Rejected:
  it trains the person to co-pilot rails and contradicts “technical steps are
  not the central product.”
- **Require coordination for every booking (shared accountability).** Rejected
  as the default: core JTBD includes solo practice journeys; multi-party is a
  real but optional job.
- **Hide all provenance forever.** Rejected: trust and partner proof need
  inspectable rails; demotion is not deletion.
- **Full chat agent for checkout.** Rejected: episode state remains the spine;
  chatty checkout is the named anti-pattern in product vision.

## Related

- [product-vision.md](../product-vision.md) — grant model, solo path, measures
- [architecture.md](../architecture.md) — commitment execution boundary
- [experience-layer.md](../design/experience-layer.md) — ceremony and hierarchy
- [0001-episode-over-session.md](0001-episode-over-session.md) — episode owns commitment
