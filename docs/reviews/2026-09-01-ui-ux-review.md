# 2026-09-01 — Product design & UI/UX review

> Self-review of the shipped surfaces, grounded in the workbench
> components, presence system, operator surface, and design docs.
> Each recommendation's resolution status is annotated inline.

## Scores

| Dimension | Score |
|---|---|
| Interaction contract | 9/10 |
| Emotional arc design | 9/10 |
| Visual system ambition | 8/10 |
| Trust & agency design | 9/10 |
| Operator experience | 6/10 |
| Arrival/first-run | 5/10 |
| Accessibility | 7/10 |
| Empty/error design | 4/10 |

## Strengths (keep defending these)

- Density philosophy: one primary decision per state; density scales
  *down* with confidence. Auto-expanding reasoning only on weak fit is
  the right trust move. Now formally the contract (experience-layer,
  amended 2026-09-01).
- "Commitment is a grant, not a checkout rail" — and the session key
  scoping (escrow calls only, zero value, 30-day expiry) makes the
  system as trustworthy as the interface claims.
- Voice lane as the only free-text surface, with a 91-case extractor
  corpus behind it.
- Presence as pure projection from operational truth; anticipation
  layer extends the emotional arc past booking, research-grounded.
- Post-wallet practitioner surfaces.

## Recommendations and resolution

1. **Write the arrival contract doc.** — *Resolved 2026-09-01:
   [docs/design/arrival.md](../design/arrival.md).*
2. **State-projection rule for the presence system** (wow layers never
   carry state; every posture has a text announcement; enforcement test).
   — *Resolved 2026-09-01: "The state-projection rule" in
   `docs/design/mira-presence.md`; coverage suite added to
   `src/agent/mira-presence.test.ts`.*
3. **Design the operator's "morning ritual"** — a Mira-authored demand
   briefing above the data, before adding more primitives; also the
   ADR 0012 paid-tier demo surface. — *Resolved 2026-09-01:
   `src/agent/operator-briefing.ts` + briefing section on `/operator`
   (aggregates only — the density gate holds).*
4. **Teach the Listening beat** — one-time beckon hint that alternatives
   live behind "not this one," using the nudge-teach pattern. — *Resolved
   2026-09-01: `src/lib/listening-teach.ts` + hint in
   `RecommendationSurface`.*
5. **Write the voice's failure vocabulary** — canonical lines for no-fit,
   provider failure, hold expiry, memory deletion; surfaces must not
   improvise failure copy. — *Resolved 2026-09-01: "Failure vocabulary"
   in `src/agent/mira-voice.ts` (with wiring-point map); wired into the
   workbench error banner and the operator error state; voice tests
   assert register boundaries.*

## Standing risks (not resolved by docs alone)

- First-session empty states beyond the arrival surface need real-user
  observation before copy is final.
- The operator briefing's register should be tuned after the first real
  operator demo.
- Marketplace gravity on the arrival surface is a permanent threat; the
  arrival contract's "never" list is the defence.
