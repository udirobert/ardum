# Recommendation surface — Implementation Summary

> **Status note (2026-08):** This doc previously described a four-beat
> cinematic flow (`RetreatExplorationView`, `use-retreat-exploration`,
> `WebGPUCommitmentTransition`, `AmbientCanvas`, `/demo/inventory-led`)
> as "what's built." Those components do not exist in the codebase. The
> flow was specified in [recommendation-reveal.md](recommendation-reveal.md)
> and [refinement-alternatives.md](refinement-alternatives.md) but was
> never implemented. This doc now describes what actually ships.

## What's actually built

The recommendation surface is `EpisodeWorkbench` (`src/episodes/EpisodeWorkbench.tsx`),
a single scrollable workbench over the Mira field. It renders Mira's
letter, the top retreat as a card, hold/monitor/not-this actions,
collapsed secondary tools, a voice-lane feedback path, and the
commitment panel. It is **not** the beat-based reveal-and-settle flow
described in the design specs.

### Letter source — `src/agent/mira-voice.ts`

`matchLetter()` returns Mira's "why this fits" lines for the surfaced
recommendation, plus recognition lines for returning practitioners
(indices `0..recognitionLineCount-1`). The workbench renders both parts:
recognition as an italic "note from Mira" aside, main lines as the
primary voice above the retreat card.

`reasoningBeat()` produces the timed thinking-beat lines shown during
`recommend` / `reject-recommendation` / timing-place feedback. The beat
plays a minimum-delay overlay before the card appears.

### Workbench surface — `src/episodes/EpisodeWorkbench.tsx`

The review-recommendation state renders, in order:

1. Mira's letter (orb signature + recognition + main lines)
2. Retreat identity (title, location · duration · price · cohort)
3. Weak-fit caveats (visible muted line when uncertainties exist)
4. Primary actions: Hold for 48 hours · Watch this for me
5. "Not this one" (reject-recommendation → re-recommend with exclusion)
6. Forward-looking note ("I'll keep watching…")
7. Collapsed secondary tools (`<details>`): lens re-ranking,
   alternatives, budget/energy counterfactuals
8. "This doesn't feel right →" feedback (voice lane + categorical fallback)
9. "how Mira chose this" reasoning disclosure
10. Commitment panel (when `nextDecision.kind === "ready-to-book"`)

This is denser than the product contract's "one primary decision per
state." The design specs call for a single CTA with everything else in
summoned disclosure; the built surface shows multiple actionable paths
simultaneously. See "Gaps vs. design contract" below.

### Wider-aperture evidence — partially wired

The server side is complete:
- `src/evidence/load-wider-aperture-stores.ts` — server assembly
- `src/evidence/repository.ts` — tier C (attestation-backed public evidence)
- `src/evidence/project-cohort.ts` — tier B (opt-in cohort, n ≥ 30 gate)
- `src/evidence/resolve-wider-aperture.ts` — visibility gates
- `buildEpisodeDetailPayload` resolves `widerApertureEvidence` into the
  episode detail payload

The client side is **not wired**. `WiderApertureDisclosurePanels`
(`src/components/WiderApertureDisclosurePanels.tsx`) exists but is never
imported or rendered. Tier B/C evidence reaches `EpisodeDetailPayload`
and dead-ends there — no component consumes it. Wiring it into the
workbench's disclosure rows is open work.

## Gaps vs. design contract

The design specs ([recommendation-reveal.md](recommendation-reveal.md),
[refinement-alternatives.md](refinement-alternatives.md)) describe a
four-beat flow that was never built:

| Spec describes | What ships instead |
|---|---|
| `RetreatExplorationView` with Beat 1–4 state machine | `EpisodeWorkbench` with episode `nextDecision` states |
| Cinematic ≤4s reveal: image emerges from orb, settles into card | Card renders immediately after `reasoningBeat` overlay clears |
| Beat 3 summoned alternatives overlay (bounded 3–5 cards) | Collapsed `<details>` with read-only alternatives + lens/counterfactual toggles |
| `WebGPUCommitmentTransition` (image elevation, particles) | `CommitmentPanel` (standard form-style grant ceremony) |
| `AmbientCanvas` real-time color extraction from hero image | Not present |
| `/demo/inventory-led` dev sandbox | Not present |
| Wider-aperture disclosure rows in Beat 2 card | Evidence assembled in payload, never rendered |

The two plan docs in `docs/plans/` are the real source of truth for the
built surface:
- [arrival-redesign.md](../plans/arrival-redesign.md) — thinking beat,
  voice lane, factor controls, orb prominence
- [recommendation-dead-end-fix.md](../plans/recommendation-dead-end-fix.md) —
  `reject-recommendation` command, full-letter rendering, alternatives

Both explicitly chose to **enhance the old flow** rather than build the
cinematic flow, and both say "Don't bridge RetreatExplorationView to
the review state" and "Don't restructure the state machine."

## What this means

The design specs are **aspirational targets**, not descriptions of
current behavior. Anyone reading them as a spec of what ships will be
misled. To reconcile:

1. Either build the four-beat flow and update the specs to match, **or**
2. Rewrite the specs to describe the workbench-based surface and retire
   the beat vocabulary.

Until one of those happens, treat `EpisodeWorkbench.tsx` and the two
plan docs as the authoritative description of the recommendation surface.

## Open items

- **Wire wider-aperture evidence to a UI surface.** The server pipeline
  is complete; the client rendering is missing. The disclosure panels
  exist but are unused.
- **Decide the workbench density.** The built surface shows multiple
  actionable paths below the recommendation; the contract calls for one
  primary decision with secondary tools in summoned disclosure.
- **Tier C live fetch** — `EVIDENCE_FETCH_ENDPOINT` adapter is wired;
  production proxy and cache invalidation policy TBD.
- **Tier B density** — cohort rows appear only at n ≥ 30; no synthetic
  backfill in production.
