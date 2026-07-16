# Experience layer

Bold, experimental surfaces that carry the product contract — not decoration
on top of forms.

## The Mira field

The app shell owns one persistent hero orb. `MiraFieldProvider`
(`components/MiraField.tsx`, mounted in `app/layout.tsx`) renders a fixed
full-bleed stack — dusk gradient, `MiraOrb fill`, legibility scrims, an
optional veil — behind every journey route (`/`, `/episode/*`,
`/invite/*`). The field
survives navigation: Mira never remounts, shrinks, or pops in between
arrival and episode. Header and footer carry explicit cream backgrounds and
mask the field; page content floats above it at `z-10`.

Journey surfaces feed the field through `useMiraField({ presence, activity,
aestheticVector, veil })` — posture comes from operational projections, the
palette from the aesthetic vector, and `veil` darkens the field where dense
content needs quiet (the episode workbench uses `0.4`; arrival `0`).
`MiraImpulseProvider` also lives at the shell level, so any surface's
impulses reach the field.

Content over the field opts into the **`.dusk` token scope**
(`globals.css`): it redefines the design tokens (`--muted`, `--hairline`,
`--surface`, …) to cream-on-dark, so token-driven components restyle
wholesale — surface cards become dark glass, headings gain glow-proof
shadows. Secondary tooling surfaces (memory, attest, retreats) keep the
light document look; the field is pathname-gated off there.

## Arrival

Mira is the atmosphere for the entire arrival — every phase renders over
the shell field. There is no phase where she is a badge watching from the
sidelines.

1. **First paint** — the hero orb is visible from the first frame. `MiraOrb
   fill` paints its dependency-free 2D metaball shader immediately
   (aspect-corrected, field lifted to match the 3D framing) while the
   `MiraScene` chunk loads, then crossfades to the instanced-capsule scene
   and releases the 2D GL context. Journey bundles warm the scene chunk at
   module evaluation (`preloadMiraScene`), and the `/api/episodes` fetch
   never gates the field — only which copy floats over it.
2. **Aesthetic calibration** — four image reactions (`AestheticCalibration`)
   build a session vector, presented over the orb in the cream-on-dark
   treatment (`aesthetics/dusk-theme.ts`). Swipe left/right on mobile;
   resonate/skip impulses ripple the hero orb and each reaction retunes its
   palette live (`onVector`). CloudField is gone — the orb is the only
   atmosphere, so a single WebGL surface is active.
3. **Retreat vision** — after calibration, `RetreatVision` resolves a
   **curated frame** from the local asset catalog (`public/aesthetics/visions/`).
   Deterministic matching from the aesthetic vector + calibration reactions.
   Result is cached in `localStorage` by fingerprint — zero runtime API cost.
4. **Intention / returning** — staggered copy reveal over the orb; the
   question sits above the orb's glow, the action below it, legibility from
   top/bottom scrims. Committing an intention plays a kinetic word-gather
   beat, then the route changes beneath Mira's persistent field.

## Episode workbench

The workbench floats over the same field that carried arrival. The episode's
`miraPresence` projection drives the field's posture; `busy` maps to a
`processing` activity overlay. Content sits in the `.dusk` scope — the
decision card is dark glass, and the only page-level orbs are inline
signatures (the 40px "note from Mira").

The workbench is a **letter with one ask**, not an operator console. Copy
hierarchy on the decision card:

1. Mira’s meaning (letter / prompt)
2. one primary human decision
3. status (what Mira is doing)
4. provenance and secondary tools (disclosure)

Secondary tools — lens re-ranking, budget/energy counterfactuals, alternatives,
monitor detail, “how Mira chose this” — never mutate a hold. **Uncertainty
gate:** expand when recommendation uncertainties are present, when “this
doesn’t feel right” is open, or before a hold; collapse under an active hold
with low uncertainty. Operator chrome (revision counters, wallet substrings)
does not belong in the primary card. Journey history lives in a quiet
disclosure (“the journey so far”), not as hero metadata.

Hold after recommendation:

- **Primary:** hold for the bounded window (non-binding, nothing charged).
- **Secondary:** watch for changes; not this (feedback re-enters clarity).
- **After hold (solo):** secure my place is available without forcing invite.
- **After hold (optional):** invite someone who must agree — multi-party branch.

## Commitment ceremony

Commitment is a **grant**, not a multi-phase rail walkthrough. Product
contract: [0008-agentic-commitment](../decisions/0008-agentic-commitment.md).

Target human moments (at most three):

1. **Ready** — “The pieces that matter now agree. I can secure this for you.”
2. **Identity only if missing** — progressive sign-in; no wallet tutorial on
   the primary path.
3. **Confirm amount and bounds** — deposit amount, plain hold/refund rule,
   single commit action; optional “How this is secured.”

While Mira executes, the shell field carries posture (`resolving` →
`arriving`) and calm status (“Securing your place…” → “You’re booked.”).
Account upgrade, chain routing, escrow, and attestation are **internal** —
available under disclosure, never named user phases. Ritual (e.g. breath
sync) may remain only with human labels; chain and storage names stay
secondary.

`booking/CommitmentPanel` and `booking/ConversationalBooking` inherit the
`.dusk` token scope. Implementation should converge on this ceremony; any
remaining infra phase labels are debt against the contract, not the target UX.

Success lands on the **preparation plan** by default (practice begins), then
**what Mira will watch next** (place, deposit hold, check-in window) so worry
can drop after commitment. Quiet provenance and optional share stay secondary
— not a receipt hero.

Failure stays in Mira’s register: nothing charged, partial progress without
teaching stack vocabulary, retry or cancel without discarding the episode.

Return bookers: wait for Magic session restore (`sessionReady`) before showing
identity vs confirm. Restored session → Confirm amount only; welcome-back
copy when a prior payment-identity hint exists.

## Invite

The participant's one decision uses the arrival pattern over the field:
question above the orb's glow, the yes/unsure/no answer grounded in a dark
glass panel below it (`DUSK_PANEL`, shared with the intention form via
`aesthetics/dusk-theme.ts`). Invite is a multi-party **branch** of an active
hold, not a universal gate to booking.

To refresh bundled vision assets after pool changes:

```bash
node scripts/sync-vision-assets.mjs
```

## Episode clarification

Energy, budget, and social steps use dimension-specific choice beats
(`MiraChoices`) inside `DecisionSlide` (`t-page-slide`). Hover and select
fire `MiraImpulse` (`lean` / `commit`) — the hero orb reacts in real time.
Mira stays fixed; the decision surface slides.

## Mira impulse

`MiraImpulseProvider` wraps arrival and episode workbench. Kinds:
`lean`, `commit`, `reject`, `resonate`, `skip`. Decaying 0–1 scalar drives
shader uniforms on hero `MiraScene`.

## Transitions

- Route changes: React `<ViewTransition>` (`app/layout.tsx`, gated by
  `experimental.viewTransition`). The page content fades/rises; the header
  (`site-header`) is pinned as a spatial anchor. Mira does not transition:
  the shell field is a persistent element outside the page group, so the
  orb simply stays while content changes around her. CSS in `globals.css`
  under the view-transition pseudo-elements; reduced motion zeroes all
  durations.
- In-flow steps: transitions.dev `t-page-slide`, `t-stagger`.

## Dependencies

Hero 3D loads lazily: `three`, `@react-three/fiber`, `@react-three/drei`,
`@react-three/postprocessing`. Inline orbs remain lightweight 2D WebGL metaballs.
