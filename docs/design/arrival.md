# The Arrival Contract

> The first thirty seconds are the weakest part of most radical products.
> This doc is the contract for Ardum's arrival: what a brand-new visitor
> sees, what Mira is doing while uncalibrated, why the input is a sentence
> and not a search box. `ArrivalScreen` (`src/components/ArrivalScreen.tsx`)
> and the home server component (`src/app/page.tsx`) implement this
> contract; this document is its design source of truth.

## The premise to teach

Every visitor arrives pre-trained by marketplaces: type a destination,
filter, compare. Ardum's arrival must invert that in one screen without a
tutorial. The premise is taught **by the form itself**, not by copy
explaining the form:

- The placeholder is an invitation to speak, not a query to type:
  *"What are you trying to make space for?"*
- There is no grid, no destination field, no price filter. The absence of
  the catalog **is** the argument. Never add a "browse retreats" affordance
  to the arrival surface — that reintroduces the marketplace by interface
  (see product-vision, "What Ardum is not").

## Phases

Arrival is a four-phase state machine, each phase doing one job:

| Phase | When | Job |
|---|---|---|
| `loading` | Shared server/client render, no bootstrap | Hold first paint identical — no greeting flicker |
| `aesthetic` | New visitor, calibration enabled | Introduce Mira's presence through choice, not text |
| `intention` | New visitor (or calibration skipped/disabled) | The sentence input — the premise, taught by form |
| `returning` | Active episode exists | Bridge the active intention, never restart |

### New visitor (`intention` phase)

- One sentence input, one submit, nothing else competing.
- Persistence is default-on with a visible transparency note (ADR 0004's
  anonymous actor cookie); there is deliberately **no checkbox** — a
  control that doesn't gate the submit is worse than honest default-on,
  and deletion lives at `/memory`.
- Mira's orb is present but quiet (`steady` posture). She has nothing to
  say yet — the absence of chatter is the first read of the restraint
  contract.
- When aesthetic calibration is enabled, the uncalibrated visitor gets a
  **preliminary vector derived from their intention** (`vectorFromIntention`)
  so imagery is coherent from the first recommendation even before they
  calibrate. Calibration is never a gate.

### Returning visitor (`returning` phase)

- The greeting is derived server-side from projected operational memory
  only (no Cognee recall on the home surface — bounded render cost, no
  remote-recall wait). Shape: *welcome back → the intention they're
  holding now → one line of past context as color, never the headline.*
- The active episode resumes where it is; arrival never restarts a journey
  in flight. Completed journeys hand off to the return close, not this
  surface.

## What arrival must never do

- No browse grid, no destination search, no filters (marketplace gravity).
- No sign-up wall, no cookie banner for the actor cookie, no auth prompt —
  identity is progressive (ADR 0011), recognition arrives before naming.
- No animation that delays the input from being focusable. The field is
  the hero; the orb is the atmosphere.
- No value-proposition paragraphs. The form teaches the premise faster
  than prose can.

## Enforcement

The marketplace-gravity row of the never-do list is enforced by
[`src/components/__tests__/arrival-marketplace-guard.test.ts`](../../src/components/__tests__/arrival-marketplace-guard.test.ts).
The guard reads `src/components/ArrivalScreen.tsx` and `src/app/page.tsx`
and fails the build if any of the patterns below appear in either file:

- `/browse\s+retreats/i`
- `/search\s+destination/i`
- `/filter\s+by/i`
- `/compare\s+prices/i`
- `/catalog/i`
- `href="/retreats"` (and variants)

When adding or removing a forbidden pattern, edit both this section and
the `FORBIDDEN` list at the top of the guard test in the same change.
The guard runs as part of `npm test` (vitest) inside the `verify` CI job.
