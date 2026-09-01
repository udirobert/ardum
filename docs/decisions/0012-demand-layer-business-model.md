# 0012 — Demand-layer business model

- Status: Accepted
- Date: 2026-09-01

## Context

The competitive research (`docs/plans/competitive-landscape-research.md`)
established Ardum's positioning: **the demand layer, not the booking
platform.** Booking management (calendar, inventory, payments, guest CRM)
is crowded, mature territory — Retreat Guru, SquadTrip, WeTravel, Bookinglayer,
Gather. No platform on either side of the market shows operators demand
*before it converts*: "here are people articulating intentions that match
your retreat, and one is already holding a spot."

What the review left open (2026-08-24, recommendation #5) was monetization.
The operator-value-surface plan deferred it: "a product decision for later —
not needed for the first operator demo." With zero users, choosing a model
now matters less for revenue than for **what we build**: pricing shape
constrains which surfaces get investment (demand visibility vs. checkout vs.
management tooling), and the wrong default — booking commission — would pull
the product toward being a marketplace, which the product contract forbids.

## Decision

Ardum charges for **demand visibility**, never for transactions. Three
explicit commitments:

### 1. No booking commission — ever

We take zero percent of any booking value. The practitioner's money goes to
the operator (or the operator's existing booking platform, or the optional
escrow path). Commission would make us a marketplace by incentive even if
not by interface: every product decision would drift toward intercepting and
owning the transaction. The product contract (solo booking first-class,
commitment as a scoped grant, operator's checkout stays theirs) is only
stable if our revenue doesn't depend on routing transactions.

### 2. Free while pre-launch; paid tiers when there is demand to sell

While the operator pool and practitioner volume are near zero, the operator
surface (demand table, holds, preparation context) is free. Monetization
begins only when the demand signal is real enough to sell, in two shapes:

- **Subscription (primary):** a flat monthly per-operator tier for standing
  demand visibility — seeing matched intentions, hold activity, and fill
  trends on their retreats. Predictable, aligned with "Mira works for you
  continuously," and independent of transaction flow.
- **Per-match fee (secondary, optional):** a small fee when Mira surfaces a
  qualifying match (intention fit above a threshold on a live retreat) that
  the operator contacts or accepts. This prices exactly the differentiator —
  the demand signal itself — and nothing downstream.

The two are not mutually exclusive: subscriptions as the base, per-match as
an a-la-carte path for operators who won't commit monthly. Exact prices are
deferred until there is a paying counterparty to negotiate with.

### 3. The escrow path stays optional infrastructure, not a revenue line

The crypto escrow exists for operators with no booking platform (ADR 0008).
It is never the default path and carries no spread or take rate. Any future
fees on it are payment-processing passthrough only, disclosed separately.

## Consequences

- **Build pressure points:** investment goes to the demand table, match
  quality, and hold/presence surfaces — the things operators pay to see —
  not to checkout, inventory, or messaging.
- **No booking-conversion funnel in code or copy.** Any metric like
  "commission earned" is malformed for this business; the aligned measures
  are matches surfaced, holds opened, and demand-visibility retention
  (already listed in `docs/plans/anticipation-layer.md` and the operator
  plan).
- **Marketplace gravity is the standing risk.** If a future team needs
  revenue and volume is low, commission will be tempting precisely because
  it works. This ADR is the artefact to cite when rejecting it.
- **Pricing details (amounts, tier boundaries, per-match threshold) are
  deliberately unspecified** until the first operator conversation. What is
  decided here is the shape, not the numbers.

## References

- [operator-value-surface.md](../plans/operator-value-surface.md) — thesis
  and open question 5, resolved by this ADR
- [competitive-landscape-research.md](../plans/competitive-landscape-research.md)
- [0008-agentic-commitment.md](0008-agentic-commitment.md) — escrow as
  optional path
- [2026-08-24 product architecture review](../reviews/2026-08-24-product-architecture-review.md)
  — recommendation #5
