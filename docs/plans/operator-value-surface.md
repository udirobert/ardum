# Plan: Build the operator value surface

> **Status:** Phases 1–5 shipped (2026-08-19)
> **Premise:** No customers, no interest yet. We can be aggressive.
> **Competitive research:** [competitive-landscape-research.md](competitive-landscape-research.md)

## The thesis (sharpened by competitive research)

The operator's real problem is not "a prettier listing form." It's "I
have retreats that sit empty and I can't find the people who'd want
them." The research confirms this is the #1 operator pain point across
every source: filling retreats is the existential challenge, marketing
starts too late, and marketplace commission (14–30% of total booking
value) is a tax for discovery the operator can't control.

**Ardum is the demand layer, not the booking platform.**

This is the key positioning insight from the competitive research. The
booking management space is crowded and mature — Retreat Guru
($49–149/mo), SquadTrip (free tier + ~3% processing), WeTravel, Bookinglayer,
Gather — all do calendar, payments, forms, room management, emails. We
cannot and should not compete there.

No existing platform — marketplace or booking software — shows operators
**demand before it converts.** Every platform is reactive: list, wait
for inquiries, respond. None proactively surfaces "here are people
articulating intentions that match your retreat." That is the gap.

The pitch to operators: "Mira finds practitioners whose intentions match
your retreat and shows you who they are — before they inquire. You keep
your booking platform. Ardum is the demand layer."

This means:
- No calendar, room management, payment plans, or guest CRM — solved
  problems with mature competitors
- The operator's booking platform stays wherever it is; Ardum links to it
- The commission model is not booking commission — it's a subscription
  or per-match fee for demand visibility
- The crypto escrow stays as an optional alternative for operators who
  don't have a booking platform, not the primary path

## What we're building toward

A closed loop where an operator can:
1. List a retreat (exists, needs thinning — add `bookingUrl` field)
2. See practitioners whose active intentions match their retreat —
   even before anyone books
3. See holds on their retreat and who's behind them
4. Get the practitioner's preparation context when a booking lands
5. Watch their retreat fill through Mira's matching, not through SEO

The differentiator: **the operator sees demand before it converts.**
No listing platform shows operators "here are 3 people articulating
intentions that match your retreat, and one is already holding a spot."

## What we're not building

- A full booking management dashboard (calendar, inventory, guest CRM)
- Payment payouts to operator bank accounts (escrow stays as optional)
- Operator-side messaging with practitioners
- Analytics/reports
- The four-beat cinematic practitioner flow
- A marketplace — we do not compete with BookRetreats on discovery traffic

Those are scale problems or solved problems. We have zero users. We need
the smallest surface that proves the demand-layer loop.

---

## Phase 1: Operator identity and retreat ownership (1–2 days)

### Problem

The operator publishes via /attest, signs with Google → Particle Auth →
ZeroDev Kernel, and gets... nothing. No way to see their retreats, no
session persistence, no notion of "my retreats." The attestor wallet
address is the only link, and nothing queries by it.

### Build

**`GET /api/operator/retreats`** — returns attestations where
`attestor` matches the resolved operator wallet. Uses the existing
`listAttestations()` and filters by `attestor`. Resolves the operator
identity from the Particle/ZeroDev session (same wallet address that
signed the attestation).

**`/operator` route** — a server component that:
- Reads the operator's wallet address from the session (if signed in)
- Fetches their retreats via the API
- Renders a simple list: title, location, date created, status
- If not signed in, shows the "Sign in with Google" button (reuses
  existing OperatorWalletButton)

**No new tables.** Attestations are already stored on 0G (or local in
dev). The operator identity is the wallet address. The query is
`listAttestations().filter(a => a.attestor === walletAddress)`.

### Files

- `src/app/operator/page.tsx` — server component, operator retreat list
- `src/app/api/operator/retreats/route.ts` — filtered attestation query
- `src/app/attest/page.tsx` — after publish, redirect to `/operator`
  instead of showing a static success screen

### What the operator sees

Their retreats. Title, location, when they listed it. A "list another"
button. This is the minimum viable operator home — not a dashboard, just
"your stuff."

---

## Phase 2: The demand surface — matched intentions (3–4 days)

### Problem

The operator has no visibility into who's looking at their retreat or
whose intentions match. The episode repository has practitioners with
active intentions and recommendations — but nothing connects an
operator to the practitioners whose recommendations include their
retreat. No competitor offers this visibility either — every platform
is reactive (wait for inquiry).

### Build

**`GET /api/operator/matches`** — queries episodes that have a
recommendation whose `result.retreatRootHash` matches one of the
operator's retreat root hashes. Returns a *sanitized* projection:
- intention shape (energy band, social constraint, budget band) —
  NOT the verbatim statement
- episode status (capturing, clarifying, held, booked)
- whether a hold is active on the operator's retreat
- when the match was generated

This is the **wider-aperture evidence inverted**: instead of showing
the practitioner aggregate cohort patterns, we show the operator
aggregate demand patterns. Same privacy contract — no verbatim
intentions, no actor IDs, no identification. Coarse intention shapes
only.

**`/operator/[retreatRootHash]`** — a detail page for one retreat:
- The retreat's published attestation (title, location, price, etc.)
- Matched practitioners: a list of anonymized intention shapes
  ("low energy, solo, 1k-2k budget — held your spot 2 hours ago")
- Hold status: who's holding, when it expires, nothing charged

### Privacy contract

This reuses the k-anonymity and coarse-shape rules from ADR 0010:
- Intention shapes are coarse (energy band, social constraint, budget
  band) — never the verbatim statement
- Actor IDs are never exposed
- Only episodes with an active recommendation matching the operator's
  retreat are visible
- An operator seeing "3 practitioners match" is the same trust model
  as a practitioner seeing "among practitioners who chose solitude…"
- Minimum density gate: don't show fewer than 3 matches (avoid
  identifying a single person). Below 3, show "Mira is watching for
  practitioners who fit this retreat" without counts.
- Dev/demo mode exception: show individual matches with a visible
  "demo mode — not anonymized" label. In production, apply the gate.

### Files

- `src/app/operator/[retreatRootHash]/page.tsx` — retreat detail + matches
- `src/app/api/operator/matches/route.ts` — episode query by retreat hash
- `src/episodes/operator-projection.ts` — pure projection: episodes →
  anonymized match shapes (mirrors `project-cohort.ts`)

### What the operator sees

"This retreat has 4 practitioners whose intentions match. One is
holding a spot (expires Thursday). Two are still clarifying what they
need. One has booked."

That's demand visibility. No listing platform gives operators this.

---

## Phase 3: Hold visibility and booking status (1–2 days)

### Problem

A practitioner can hold a retreat, but the operator has no idea. The
hold lives on the episode and nowhere else. When a booking happens,
nothing notifies the operator. No competitor has a non-binding hold
at all — every platform requires payment to reserve.

### Build

**Simpler approach:** Don't build a notification system. Instead, make
the `/operator` page a live-poll surface that shows active holds on the
operator's retreats. The operator checks the page; the page shows
"Held — expires in 23 hours." No email, no push, no webhook. The
operator dashboard IS the notification. This is intentionally low-tech
— we have zero users, we don't need a notification pipeline.

For bookings: the `/operator` page shows "Booked" status on retreats
that have a booking attestation. The operator sees it when they check.

### Files

- `src/app/operator/page.tsx` — add hold status + booking status to the
  retreat list
- `src/app/api/operator/retreats/route.ts` — enrich the response with
  active holds and booking status by cross-referencing episodes

### What the operator sees

On their retreat list, each retreat shows:
- "Active: 1 hold (expires Thursday)" or "No active holds"
- "Booked: 1 practitioner" or "No bookings yet"
- "Matched: 4 practitioners" (from Phase 2)

---

## Phase 4: Preparation context on booking (2–3 days)

### Problem

When a practitioner books, the operator gets nothing — no context about
who's arriving, what they were trying to make space for, or what Mira
prepared them with. The preparation plan exists on the episode but dies
there. No competitor offers practitioner context at booking — they give
name, dates, payment status.

### Build

**`/operator/[retreatRootHash]/bookings/[episodeId]`** — a booking
detail page visible to the retreat's operator. Shows:
- The booking attestation (deposit, date, tx hash — already exists)
- The practitioner's intention *shape* (coarse, not verbatim — same
  privacy contract as Phase 2)
- The preparation plan Mira generated (from `preparationPlan()` in
  `mira-voice.ts` — already exists, currently only rendered on the
  practitioner's booked landing)
- Check-in window (from the booking attestation's `checkInWindowHours`)

**Authorization:** The operator's wallet must match the retreat's
`attestor` field. The episode must have a commitment with a
`bookingRootHash` that references the operator's retreat.

### Privacy

The preparation plan is Mira's voice, not the practitioner's verbatim
intention. The intention shape is coarse. The verbatim statement is
never shown to the operator. This is the same boundary as the
practitioner-facing wider-aperture evidence — just inverted.

### Files

- `src/app/operator/[retreatRootHash]/bookings/[episodeId]/page.tsx`
- `src/app/api/operator/bookings/[episodeId]/route.ts` — authorized
  query: operator wallet === retreat attestor, episode has commitment
- Reuse `preparationPlan()` from `src/agent/mira-voice.ts`

### What the operator sees

"Sarah (preferred name, not wallet) is arriving for your October
retreat. She was making space for recovery after a period of burnout.
Mira prepared her with a 5-day wind-down plan. Check-in window opens
48 hours before arrival."

That's a relationship surface. The operator knows who's coming and
why, without reading the practitioner's private intention. No listing
platform does this.

---

## Phase 5: Simplify the practitioner surface in parallel (2–3 days)

### Problem

While we build the operator surface, the practitioner workbench is
still too dense. The operator onboarding demo will show both sides, and
a cluttered practitioner surface undermines the "calm guide" pitch.

### Build (conservative, not the four-beat flow)

1. **Move retreat description into disclosure.** The card shows title +
   facts line (location · duration · price · cohort). Full description
   is a disclosure row. The letter carries the meaning.

2. **Auto-fire recommendation after last clarification.** Remove the
   "Consider what matters" button. When the last clarify constraint
   lands (travel window), fire `recommend` automatically. The thinking
   beat plays as the transition.

3. **Shorten the thinking beat** — *superseded by the two-phase beat.* The
   beat is now a two-phase, in-flow expandable trace: a working phase (orb +
   progressive reasoning lines, card hidden) that settles to a collapsible
   "thought for Ns" trace above the card. The old "one line + card" toggle
   is gone; tune the working-phase duration rather than a blanket 3400→1500ms
   swap. (`src/episodes/workbench/ThinkingBeat.tsx`.)

4. **One primary action on the recommendation.** Hold is the only
   primary CTA. "Watch this for me" moves into disclosure. "Not this
   one" stays as a quiet text link (already is). The page reads:
   letter → identity → Hold → status → disclosure.

### Files

- `src/episodes/EpisodeWorkbench.tsx` — the changes above
- `src/episodes/model.ts` — add auto-recommend trigger on last clarify
- `src/episodes/service.ts` — auto-fire recommend after travelWindow

---

## Phase 6: The demo loop (1 day)

### Build

A demo script (not user-facing) that walks the full loop end-to-end:

1. Operator lists a retreat via /attest
2. Practitioner arrives, types intention, clarifies, gets matched to
   that retreat
3. Practitioner holds the retreat
4. Operator checks /operator → sees the hold
5. Practitioner books
6. Operator checks /operator → sees the booking + preparation context

This is what you show real operators. "List your retreat. Watch Mira
find people for it. See who's coming and why."

---

## Sequencing

| Phase | What | Status | Can demo after? |
|-------|------|--------|-----------------|
| 1 | Operator identity + retreat list | ✅ Shipped | Yes — "your retreats" |
| 2 | Demand surface (matched intentions) | ✅ Shipped | Yes — "see who fits" |
| 3 | Hold visibility + booking status | ✅ Shipped | Yes — "see demand" |
| 4 | Preparation context | ✅ Shipped | Yes — "know who's coming" |
| 5 | Simplify practitioner surface | ✅ Shipped | (parallel) |
| 6 | Demo loop script | Not started | Final demo |

**Phases 1–5 are shipped.** The full loop is live: list → match → hold →
see demand → book → see who's coming. Phase 6 (demo loop script) remains
for a scripted end-to-end walkthrough.

The critical path (Phases 1–3) is done — you can show a real operator:
"List your retreat. Mira finds practitioners whose intentions match. You
see who's holding and who's booked. Nobody else does this."

---

## The bookingUrl addition (Phase 1, small)

The attestation schema gains an optional `bookingUrl` field. This is
the thin integration with the operator's existing booking platform
(SquadTrip, WeTravel, their own site). When a practitioner is ready to
book, Mira links to the operator's existing checkout rather than Ardum
running its own escrow. This makes Ardum a complement to existing
platforms, not a replacement.

The crypto escrow path stays for operators who don't have a booking
platform — but it's not the primary path. The default is: operator
provides a booking URL, Mira sends the practitioner there when they're
ready to commit.

### Files

- `src/attestation/schema.ts` — add `bookingUrl?: string` to claims
- `src/attestation/UploadForm.tsx` — add an optional "booking URL"
  field to step 1
- `src/episodes/EpisodeWorkbench.tsx` — if the recommendation has a
  bookingUrl, the Hold CTA becomes "Hold + I'll send you to their
  checkout when ready" or similar

---

## What this plan deliberately doesn't do

- **No new infrastructure.** No new database tables, no new providers,
  no new auth systems. Everything reuses the episode repository,
  attestation storage, and existing operator wallet identity.
- **No notification pipeline.** The /operator page is the notification.
  Poll, don't push. We have zero users.
- **No booking management.** No calendar, no inventory, no guest CRM.
  The operator sees demand and context, not a management tool. That's
  a different product for when there's volume. SquadTrip, Retreat Guru,
  WeTravel — they all solve this. We don't need to.
- **No four-beat cinematic flow.** The practitioner surface gets
  simpler, not fancier. The differentiator is the operator seeing
  demand, not the practitioner seeing a pretty orb.
- **No crypto on the operator surface.** The wallet address is an
  identity key. The operator never sees chain names, tx hashes, or
  attestation root hashes in the primary UI. Those stay in a "how this
  is secured" disclosure, same as the practitioner side.
- **No marketplace.** We do not compete with BookRetreats on discovery
  traffic. We complement the operator's existing booking platform by
  adding a demand layer they can't get elsewhere.

---

## Open questions (resolved by competitive research)

1. **Operator email.** Particle Auth gives us a wallet address, not an
   email. Pull-based /operator page works without it. Email notifications
   would need a separate email collection step — deferred until there's
   volume.

2. **Real retreats vs. seed catalog.** The demand surface only works
   if practitioners are matching against the operator's real retreat.
   First demo should use the operator's real retreat as the primary
   matchable retreat in the pool.

3. **Minimum density gate in demo.** With seeded practitioners, the
   n≥3 gate would hide matches. Dev/demo mode shows individual matches
   with a visible "demo mode — not anonymized" label. Production
   applies the gate.

4. **Intention privacy vs. operator value.** The plan shows the
   operator the practitioner's intention *shape* (coarse constraints),
   never the verbatim statement. The constraints are explicitly chosen
   structured options, not inferred or free-text — this is within the
   ADR 0010 privacy contract. Reviewed and cleared.

5. **Business model.** **Resolved by ADR 0012** (2026-09-01): no booking
   commission, ever. Free while pre-launch; paid demand visibility later —
   a per-operator subscription as the primary shape, an optional per-match
   fee as the a-la-carte path. See
   [ADR 0012](../decisions/0012-demand-layer-business-model.md).
