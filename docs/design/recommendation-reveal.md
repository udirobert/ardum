# Recommendation reveal (Beat 2 spec)

Target surface for the moment Mira presents her strongest current fit. This
replaces the always-on browse + chat + hold screen currently in
`RetreatExplorationView` and restores the episode-workbench contract from
[experience-layer.md](experience-layer.md) and [product-vision.md](../product-vision.md).

Scope of this spec: **Beat 2 only** — the recommendation reveal and the
steady-state decision card it resolves into. Beats 1 (looking), 3
(refinement / alternatives), and 4 (hold → commitment) are summarized in
conversation and specified separately.

## Why this beat exists

The current `RetreatExplorationView` presents three decisions at once —
browse, refine, commit — and asks the user to do Mira's ranking job ("what
stands out to you?"). The contract is one primary decision per state, and
ranking is Mira's responsibility, not the practitioner's.

Beat 2 is the moment that contract becomes visible: Mira presents *one*
retreat as her strongest current fit, names *why* it fits this specific
intention, and offers one primary action. Alternatives and refinement are
summoned by the user, not always-on.

## Composition

Two phases inside one beat: a **reveal** (≤4s, cinematic) that resolves into
a **steady-state decision card** (the workbench home base).

### Reveal phase (≤4s)

Carried over the shell field, `fieldTier: hero`, posture `arriving`.

1. **Orb as source.** The retreat's hero image emerges from the Mira orb
   position along the existing bezier choreography
   (`RetreatImage` motion paths, `useMotionPath`). One image, not a grid.
2. **Settle, not scroll.** The image scales up to fill the viewport, then
   dims and recedes behind a veil as the decision card rises. There is no
   scroll axis. The retreat is *presented*, not *browsed*.
3. **No input, no CTA during reveal.** The reveal is a beat, not a screen
   the user acts on. Mira is speaking; the user rests. This is the "breath"
   the current screen is missing.
4. **Reduced motion:** reveal collapses to a 200ms cross-fade from orb glow
   to the settled card. No motion path, no scale animation.

### Steady-state decision card

Dark glass over the field (`.dusk` scope, `DUSK_PANEL`), one screen, no
scroll. The card occupies the lower two-thirds; the orb remains visible
above it as a quiet signature, per the workbench contract ("the only
page-level orbs are inline signatures").

Copy hierarchy on the card, in strict order — never reversed:

```
┌─────────────────────────────────────────────┐
│  [orb signature, 40px, inline]              │  ← Mira, not chrome
│                                             │
│  1. MIRA'S LETTER                           │
│  "This one sits close to what you named —   │
│  a quiet week, solo, under $1,800, in       │
│  October. The operator has held space for   │
│  people recovering from burnout before."    │
│                                             │
│  ── retreat identity ──                     │
│  Stillwater Forest                          │  ← title, serif
│  7 days · $1,650 · Oregon                  │  ← facts, one line
│  [hero image, dimmed, framed]               │
│                                             │
│  2. ONE PRIMARY DECISION                    │
│  ┌───────────────────────────────────────┐  │
│  │  Hold this for 48 hours               │  │  ← the only CTA
│  │  Nothing charged. I'll watch it.      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  3. STATUS                                  │
│  No hold active yet.                        │  ← what Mira is/isn't doing
│                                             │
│  4. DISCLOSURE (collapsed)                  │
│  · see other possibilities I'm weighing     │  ← opens Beat 3
│  · how I chose this                         │  ← ranking provenance
│  · what others found                        │  ← tier B cohort (if dense)
│  · what public sources report               │  ← tier C web evidence
│  · what if the timing slips                 │  ← counterfactual
│  · operator & highlights                    │  ← brochure layer
└─────────────────────────────────────────────┘
```

## Copy contract

### Mira's letter (level 1)

The letter is the **why**, not the what. It must reference the specific
intention — never a generic "this might resonate." Template:

> This one sits close to what you named —
> *[1–2 specific constraints from the episode]*.
> *[1 specific reason Mira chose it over the alternatives]*.

Hard rules:

- Always names at least one constraint the practitioner articulated
  (timing, solitude, energy, budget, recovery, celebration…).
- Never "some retreats that might resonate" or "what stands out to you?"
  — those hand ranking back to the user.
- Never lists multiple retreats. One retreat, one reason.
- ≤ 40 words. If it doesn't fit, the reason isn't sharp enough.
- **Optional wider-aperture clause (high uncertainty only):** when
  recommendation uncertainties are non-empty *and* tier B or C evidence
  exists above threshold, one additional clause (≤15 words) may follow the
  reason — e.g. "Public reports often mention the morning silence here."
  Never a stat hero ("87% loved it"). Never "others like you booked this."
  See [Wider aperture evidence](#wider-aperture-evidence-disclosure-rows).

### Retreat identity (between 1 and 2)

Title (serif), one facts line (`duration · price · location`), one framed
hero image. No gallery, no highlights, no operator bio at this level —
those live in disclosure. The identity block is *evidence for the letter*,
not a brochure.

### Primary decision (level 2)

Exactly one CTA. Copy:

> **Hold this for 48 hours**
> Nothing charged. I'll watch it.

Never two CTAs. "See alternatives" is *not* a co-primary — it lives in
disclosure. The hold is the path of least resistance, by design.

### Status (level 3)

One quiet line describing what Mira is or isn't doing on the episode right
now. Examples:

- "No hold active yet."
- "Held until Thursday 6pm. Nothing charged."
- "Two people still need to respond."
- "I'm watching the October dates for you."

Never infra vocabulary (no "escrow", "attestation", "chain"). Per 0008,
those are internal.

### Disclosure (level 4)

Collapsed by default. Expands on tap. Each item is a summoned secondary
tool — never auto-expanded, never mutating the hold:

| Item | Opens | Evidence tier |
|------|-------|---------------|
| See other possibilities I'm weighing | Beat 3 (alternatives view, bounded 3–5) | — |
| How I chose this | Ranking provenance: policy inputs, weights, uncertainties | Internal |
| What others found | Anonymized cohort patterns (normalization, not prescription) | B |
| What public sources report | Verifiable web evidence: reviews, articles, operator pages | C |
| What if the timing slips | Counterfactual: re-rank under shifted timing, read-only | — |
| Operator & highlights | Operator bio, highlights, gallery — the brochure layer | Catalog |

Rows for tier B and C are **conditional** — hidden entirely when evidence
is below threshold or unavailable. Never show a disabled row ("not enough
data yet"); Mira stays silent rather than teasing social proof.

The disclosure list is a quiet text list, not a button bar. It does not
compete with the primary CTA. Row order is fixed: alternatives and ranking
provenance first; wider-aperture evidence next; counterfactual and brochure
last.

Full contract for tier B/C rows:
[Wider aperture evidence](#wider-aperture-evidence-disclosure-rows).
Product decision record:
[0010-wider-aperture-evidence](../decisions/0010-wider-aperture-evidence.md).

## Wider aperture evidence (disclosure rows)

Practitioners often want normalization and outcome reassurance. The market
answers with social proof (trending, "people like you booked X," star
counts). Beat 2 answers with **evidence in Mira's voice**, confined to
disclosure — and at most one optional letter clause under high uncertainty.

This section specifies the two wider-aperture disclosure rows introduced in
[0010-wider-aperture-evidence](../decisions/0010-wider-aperture-evidence.md).
It does **not** specify a social mode, activity feed, or browse surface.

### Design principles (anti-drift)

1. **Evidence, not social.** Rows describe patterns and reported outcomes —
   never live activity, identifiable peers, or booking velocity.
2. **Mira speaks, the crowd does not.** Copy is always first-person Mira
   summarizing attributed evidence — never a feed of user quotes as hero
   content, never review-star widgets.
3. **Ranking stays upstream.** These rows explain; they never reorder the
   top pick or substitute popularity for the deterministic policy.
4. **Silent beats misleading.** Rows are omitted when data is thin. A missing
   row is correct; a weak stat is a regression.
5. **Provenance on inspection.** Expanded panels show source type, freshness,
   and confidence — never anonymous "trust us" aggregates.

### Row: "What others found" (tier B)

**Purpose:** Normalize the practitioner's intention — "others who named
similar shapes often found X" — without telling them what to book.

**Visibility:** Render the row only when **all** of:

- cohort slice matches the episode's coarse intention shape (energy band,
  social constraint, theme tags — never verbatim statement text);
- k-anonymity satisfied (default **n ≥ 30** practitioners in the slice);
- aggregate projection is fresh (rebuild policy in 0010).

If any gate fails, omit the row completely.

**Label (closed state):**

> What others found

Never: "People like you," "What others are booking," "Trending for your
profile."

**Expanded panel structure:**

```
What others found
─────────────────
[Mira summary — 2–4 sentences, pattern voice]

Among practitioners who named recovery and chose solitude, quiet
mornings and short containers tended to matter more than destination.
This is a pattern, not a rule — your hold does not depend on it.

Sources · Ardum anonymized journeys (n=47) · contributed with consent
Confidence · reported aggregate · refreshed [date]
```

**Copy contract:**

- Frame as **pattern**, not prescription ("tended to," "often mentioned,"
  not "you should" or "most people pick").
- Name the **intention shape**, not identifiable cohorts ("who named recovery
  and chose solitude," not "users aged 28–35 in NYC").
- Include **n** and **consent attribution** in the sources line.
- Tag provenance: `reported` (aggregate) — per product vision memory
  boundary.
- ≤ 80 words in the summary body.

**Hard prohibitions:**

- Booking counts, conversion rates, or "X people chose this retreat."
- Real-time or recent activity ("this week," "right now").
- Quoted verbatim statements from other practitioners.
- Comparison pressure ("you're behind," "popular choice").

### Row: "What public sources report" (tier C)

**Purpose:** Surface verifiable external evidence about **this retreat or
operator** — claims checked against public web sources — to restore
confidence without turning Beat 2 into a review site.

**Visibility:** Render when the evidence repository holds at least one
normalized record for this retreat/operator above minimum confidence.
Omit when only stale or low-confidence fetches exist.

**Label (closed state):**

> What public sources report

Never: "Reviews," "Rating," "What travelers say" (those labels imply
marketplace ranking). The label emphasizes **reporting and verification**,
not scoring.

**Expanded panel structure:**

```
What public sources report
──────────────────────────
[Mira summary — 2–4 sentences weaving verified claims]

Public write-ups often describe the morning silence and small cohort
size. The operator's site claims daily optional check-in — that matches
what I found on their published schedule.

Claims inspected
· "Small cohort, max 8" — operator site — fetched [date] — reported
· "Strong for burnout recovery" — [publication] — fetched [date] — inferred
· [conflicting claim, if any] — marked uncertain

Sources · [url list, collapsed behind "view sources"]
```

**Copy contract:**

- Lead with **fit-relevant themes** tied to this episode's intention when
  possible — not a generic review digest.
- Each claim line carries: text, source name/url, fetched-at, provenance
  tag (`explicit` | `reported` | `inferred` | `uncertain`).
- Conflicts are shown, not hidden. Mira marks disagreement as `uncertain`.
- External tools (Exa, Firecrawl, Tinyfish Fetch/Search) are adapters
  behind the evidence repository — UI never names vendor SDKs.
- ≤ 100 words in the summary body; claim list may scroll within the panel.

**Relationship to "Operator & highlights":**

| Surface | Content |
|---------|---------|
| Operator & highlights | Curated catalog brochure: bio, hero gallery, static highlights from inventory |
| What public sources report | Fetched, dated, verifiable claims from the open web |

Do not duplicate static catalog copy in tier C. Tier C adds **inspection
and freshness** the catalog cannot provide.

**Hard prohibitions:**

- Star ratings, numeric scores, or "4.8/5" as primary content.
- Review count hero ("based on 312 reviews").
- Scraped private or login-gated content presented as evidence.
- Unlabeled third-party copy presented as Mira's memory.

### Uncertainty nudge (not a wider-aperture row)

When `episode.recommendation.uncertainties` is non-empty but disclosure
stays collapsed, Beat 2 may add a **sixth quiet line** below status (not
a new disclosure row, not expandable on its own):

> There are 2 things I'm still uncertain about.

Tapping it opens **How I chose this** with the uncertainties section
focused — not Beat 3, not tier B/C. This preserves the rule: the user
summons; Mira does not auto-expand social or evidence panels.

### Letter clause (level 1, optional)

When uncertainties are non-empty **and** tier B or C evidence passed
visibility gates, the letter may add **one clause** after the reason (≤15
words total):

> …The operator has held space for burnout recovery before. Public reports
> often mention the morning silence.

Rules:

- At most **one** wider-aperture clause per letter.
- Prefer tier C fit-themes over tier B stats in the letter; cohort stats
  stay in disclosure unless they name a non-obvious normalization.
- Never a percentage in the letter ("73% reported…").
- If no tier B/C evidence qualifies, the letter stands on intention +
  ranking reason alone.

### Implementation notes

- `DisclosureRow` keys in `RetreatExplorationView`: add `cohort` and
  `public-evidence` when wired; until evidence APIs exist, **omit rows** —
  do not ship placeholder copy.
- Evidence payloads should arrive on the episode detail API as normalized
  attachments on `recommendation.result`, not as a separate social feed.
- Smoke tests: Beat 2 with zero wider-aperture evidence must look identical
  to today's four-row disclosure (alternatives, provenance, counterfactual,
  operator) — no empty stubs.

### What wider-aperture evidence is NOT on Beat 2

Per [0010](../decisions/0010-wider-aperture-evidence.md) §5 — if a feature
matches these, it does not belong on this beat or anywhere in the primary
journey:

- Semi-public mode, activity feed, or "see what others are booking."
- "People like you booked X" as row label, letter line, or CTA adjacency.
- Live hold counts, trending badges, or urgency copy tied to cohort data.
- User-generated photo/tip threads or identifiable peer journeys.
- Popularity-based reordering triggered from disclosure actions.

## What is NOT on this beat

- **No always-on chat input.** Refinement is summoned via "see other
  possibilities" (Beat 3) or via the orb's voice lane *only when the user
  signals mismatch* — not as a persistent top bar. The arrival voice lane
  was for intention articulation; it does not carry forward as a
  refinement input on every screen.
- **No scroll grid.** The catalog scroll is a Beat 3 expansion, not the
  steady state.
- **No floating global Hold button.** The hold CTA lives on the card, in
  hierarchy position 2.
- **No "what stands out to you?"** Ranking is Mira's job.
- **No operator chrome on the card.** Revision counters, wallet
  substrings, hold-expiry timestamps in hero metadata — all disclosure or
  quieter.
- **No social-proof surfaces.** No star ratings, review counts, trending
  labels, "people like you booked," or activity feeds on the card — wider-
  aperture evidence lives only in the tier B/C disclosure rows when gates
  pass ([0010](../decisions/0010-wider-aperture-evidence.md)).

## Field and posture

- `fieldTier: hero` (the recommendation deserves the full capsule shell).
- Posture comes from the episode's `miraPresence` projection, not from a
  guessed emotion.
- During reveal: `activity: arriving`, veil raised so the image reads.
- In steady state: `activity: idle`, veil at `0.4` so the card reads over
  the field.
- On hold: `activity: resolving` → `arriving` per the commitment ceremony.

## Transitions

- **Into Beat 2 from Beat 1:** orb glow brightens, image emerges along
  bezier, card rises over 600–900ms. One continuous motion, not a sequence
  of fades.
- **Re-rank within Beat 2** (after Beat 3 refinement returns a new top
  pick): old card recedes into the orb, new image emerges. Same
  choreography as the initial reveal, shorter (≤1.5s). The card never
  hard-cuts.
- **Into Beat 4 (hold):** the existing `WebGPUCommitmentTransition` fires
  from the card's CTA, not from a floating button.

## Accessibility

- Card content is real DOM over the field, not rendered inside canvas.
- Reveal motion respects `prefers-reduced-motion` (cross-fade fallback).
- The one CTA is keyboard-focusable and the obvious tab target.
- Disclosure rows are buttons with proper `aria-expanded`.
- Mira's letter is the first readable element, not the CTA — screen-reader
  order matches visual hierarchy.

## Open questions for review

1. **Letter sourcing.** The current `generateMiraNote` in
   `src/agent/retreat-response.ts` produces generic plural copy ("these
   retreats seem to align…"). The letter contract above requires
   singular, specific, ≤40 words referencing named constraints. That's a
   rewrite of the note generator, not a copy tweak — flag for the
   agent-side work.
2. **Reveal duration.** ≤4s is a guess. Should be tuned against real
   hero-image load times; if images aren't cached, the reveal can feel
   broken. Consider preloading the top pick during Beat 1.
3. **Disclosure default state under high uncertainty.** The contract says
   secondary tools expand when uncertainty is high. Does the card open
   disclosure automatically when `miraPresence` carries high uncertainty,
   or wait for the user? **Resolved:** wait, but surface a quiet inline
   nudge ("there are 2 things I'm uncertain about") that focuses
   **How I chose this** — never auto-expand tier B/C or Beat 3. See
   [Uncertainty nudge](#uncertainty-nudge-not-a-wider-aperture-row).
4. **Tier B/C row wiring.** Rows are spec-complete; implementation waits
   on evidence-repository payloads on `GET /api/episodes/[id]`. Until
   gates pass, omit rows — no placeholders.
