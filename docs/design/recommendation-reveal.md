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
│  · how I chose this                         │  ← provenance
│  · what if the timing slips                 │  ← counterfactual
│  · operator & highlights                    │  ← detail
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

| Item | Opens |
|------|-------|
| See other possibilities I'm weighing | Beat 3 (alternatives view, bounded 3–5) |
| How I chose this | Provenance: ranking inputs, what was weighed, what was uncertain |
| What if the timing slips | Counterfactual: re-rank under shifted timing, read-only |
| Operator & highlights | Operator bio, highlights, gallery — the brochure layer |

The disclosure row is a quiet text list, not a button bar. It does not
compete with the primary CTA.

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
   or wait for the user? My read: wait, but surface a quiet inline nudge
   ("there are 2 things I'm uncertain about" as a disclosure row) rather
   than auto-expanding.
