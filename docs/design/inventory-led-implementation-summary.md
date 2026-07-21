# Inventory-Led Experience — Implementation Summary

## Overview

The episode workbench's recommendation surface is a four-beat reveal
flow: Mira presents **one** retreat as her strongest current fit, and
alternatives / refinement are summoned by the practitioner rather than
always-on. This replaced the earlier browse-grid + chat-input + floating-
hold screen, which violated the product contract (one primary decision
per state; ranking is Mira's job, not the user's).

The full design contract lives in:
- [recommendation-reveal.md](recommendation-reveal.md) — Beat 2
- [refinement-alternatives.md](refinement-alternatives.md) — Beat 3

The original strategic rationale for leading with inventory (vs. the
quiz-style clarification flow) is in
[inventory-led-experience.md](inventory-led-experience.md). That doc
argues for a browse grid that the product vision rejects; the
four-beat flow is the contract-pure realization of the same intent.

## What's built

### State machine — `src/inventory/use-retreat-exploration.ts`

Beats: `looking` → `arriving` → `settled` → `listening` (summoned) →
`committing`. One primary decision per state. The hook never exposes a
plural "retreats" list — it exposes a single `Recommendation` (top pick
+ letter + bounded alternatives with reasons).

- `openAlternatives` / `closeAlternatives` — Beat 3 entry/exit.
- `elevate(retreatId)` — promote an alternative to top pick; re-reveals
  with a regenerated letter and reasons.
- `rejectAlternative(retreatId)` — feedback that re-enters clarity;
  rejected IDs persist for the episode lifetime.
- `onVoiceMessage(text)` — Beat 3 voice lane; extracts constraints,
  merges, re-ranks. On extraction failure, surfaces a specific nudge
  naming which dimensions are still open (not generic copy).
- `onCommit(retreatId)` / `onCommitComplete` — Beat 4 trigger/teardown.

### Letter source — `src/agent/retreat-response.ts`

`buildRecommendation()` returns a single top pick, a singular ≤40-word
letter that names a constraint the practitioner articulated *and* a
reason over alternatives, and a bounded set of alternatives with
one-line differentiating reasons ("Shorter, ocean.", "Higher
investment, desert.").

- `generateRecommendationLetter()` — the Beat 2 letter. Never plural,
  never "what stands out to you?", never generic.
- `generateAlternativeReason()` — the Beat 3 one-liner per alternative.
- Legacy `generateRetreatResponse` / `generateMiraNote` kept as
  deprecated shims.

### View — `src/components/RetreatExplorationView.tsx`

- `LookingBeat` — orb + "Looking at what fits…" line.
- `Beat2` — `RevealImage` + `DecisionCard` (letter → identity → one
  Hold CTA → status → collapsed `DisclosureRow`s for alternatives /
  provenance / counterfactual / operator).
- `Beat3` — overlay with `AlternativeCard`s (hero image + identity +
  one-line reason + elevate/not-this), voice lane at the bottom,
  Escape / close to return.
- `WebGPUCommitmentTransition` fires from the Beat 2 Hold CTA.

Field posture follows the beat via `useMiraField` (`processing` →
`arriving` → `idle` / `listening`).

### Demo page — `src/app/demo/inventory-led/page.tsx`

Uses the same hook and view as the live `/episode/[id]` flow — no
duplicate keyword logic, no direct-mode props. Reachable only by direct
URL.

## Integration

`EpisodeWorkbench` renders `<RetreatExplorationView
initialConstraints={intention.constraints} onConstraintChange={...} />`
inside the clarify step. The view's props contract is preserved, so the
live flow works without changes to the workbench wiring.

## Component hierarchy

```
EpisodeWorkbench
  └─ RetreatExplorationView
      ├─ AmbientCanvas (reactive background, color-extracted)
      ├─ LookingBeat          (Beat 1)
      ├─ Beat2
      │   ├─ RevealImage
      │   └─ DecisionCard
      │       └─ DisclosureRow[]
      ├─ Beat3                (summoned)
      │   ├─ AlternativeCard[]
      │   └─ voice lane input
      └─ WebGPUCommitmentTransition  (Beat 4)
```

## What was retired

- `src/components/RetreatImage.tsx` — superseded by `RevealImage` and
  `AlternativeCard`.
- `src/components/MiraNote.tsx` — superseded by the letter in
  `DecisionCard`.
- `RetreatExplorationProps` interface in `src/inventory/retreat.ts` —
  dead type.
- The always-on top chat input, the full-bleed scroll grid as the
  steady state, the floating global Hold button, and the "what stands
  out to you?" copy. The catalog scroll now only exists as a bounded
  Beat 3 expansion.

## Carried over from the cinematic polish work

- **Real-time color extraction** — `src/lib/color-extraction.ts` +
  `AmbientCanvas`. Samples the active retreat's hero image for ambient
  gradient palettes, with a module-level cache and catalog fallback.
- **WebGPU commitment transition** — `WebGPUCommitmentTransition`. Image
  elevation, particles, radial glow, "Commitment Secured" overlay.
- **Reduced motion support** — motion respects `prefers-reduced-motion`.

## Open items

- **EpisodeWorkbench deeper integration** — the view is rendered inside
  the clarify step, but the workbench's broader `nextDecision` /
  recommend / hold state machine isn't touched. That's a larger
  refactor for a separate change.
- **"Retreats you've set aside" disclosure** — rejected alternatives
  persist in hook state for the episode lifetime but aren't yet
  surfaced in a disclosure row for inspection/reversal.
- **Reveal duration tuning** — 700ms looking + 900ms reveal are
  defaults. Preloading the top pick during Beat 1 is the right fix if
  the reveal feels broken on slow networks.
- **Set size (3 vs 5)** — currently bounded to 4. Tie to the ranking
  policy's natural tier break once the live catalog grows.
