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
aestheticVector, veil })` — posture comes from operational projections,
the palette from the aesthetic vector, and `veil` darkens the field where copy
needs quiet. The episode workbench keeps a light veil (`0.18`, dropped to
`0.12` during the thinking beat) so Mira's impulses and posture shifts stay
visible between decisions. `MiraImpulseProvider` also lives at the shell
level, so any surface's impulses reach the field.

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

**Voice lane (composition contract):** on arrival, Mira is the *medium* for
the ask — not wallpaper behind a form. Copy and input obey three bindings:

| Binding | Rule |
|---------|------|
| **Spatial** | Mira's question lives in the orb's **lower third** (voice lane), not a top-of-page headline stacked above a panel |
| **Temporal** | Prompt lines appear under `activity: speaking`; the textarea focus maps to `activity: listening`; submit maps to `processing` → `arriving` |
| **Optical** | raised `veil` while typing — the field recedes so language reads first |

No bordered “settings card” on the first intention ask. One serif question,
one quiet underline input, one primary action. Panel chrome (`DUSK_PANEL`)
remains for invite (multi-party branch), not for the solo arrival ask.

**Performance tiering:** every field surface crossfades — the lightweight
2D metaball paints from the first frame while the 3D scene chunk streams in,
then eases over (`MiraOrb fill` handles the handoff internally). Arrival
warms the scene chunk eagerly (`preloadMiraScene` at module scope) so the
capsule shell is ready before the intention is; episode routes reuse the
already-warm scene. The camera answers the cursor with a subtle parallax,
so the presence reads as aware of the person, not looping behind glass.

Phases:

1. **First paint** — the 2D metaball field is visible from the first
   frame (`MiraOrb fill` underlay) while the 3D scene streams in behind it.
2. **Aesthetic calibration** — four image reactions (`AestheticCalibration`)
   build a session vector over the ambient field. Swipe left/right on mobile;
   resonate/skip impulses ripple the orb and each reaction retunes its
   palette live (`onVector`). Calibration is off by default
   (`NEXT_PUBLIC_AESTHETIC_CALIBRATION_ENABLED`); the intention ask is the
   first interaction, not image reactions. When calibration is off (or not
   yet completed), `vectorFromIntention` derives a preliminary aesthetic
   vector from the intention statement so the retreat vision and orb
   palette carry signal from the first moment rather than the neutral
   default. A stored calibrated vector always takes precedence.
3. **Retreat vision** — after calibration, `RetreatVision` resolves a
   **curated frame** from the local asset catalog
   (`public/aesthetics/visions/`). Deterministic matching from the aesthetic
   vector + calibration reactions. Cached in `localStorage` by fingerprint.
   For un-calibrated practitioners, the vision uses the intention-derived
   vector, so the frame still reflects the stated need.
4. **Intention / returning** — voice lane + input lane (see above).
   When the practitioner has set a preferred name (`actors.preferred_name`),
   the intention heading personalizes: "What are you trying to make space
   for, {name}?" The returning phase uses the name in Mira's line: "I kept
   this alive for you, {name}." The name is part of Mira's *letter*, not
   header chrome — it never appears in operator-facing surfaces or
   attestation records.
   Committing an intention fires the orb's strongest impulse (`commit`)
   during the arrival beat, then the route changes beneath Mira's persistent
   field.

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

### Recommendation surface

> **Status note (2026-08):** The section below described a four-beat
> cinematic flow (`RetreatExplorationView`) as built. That flow was
> never implemented. What ships is `EpisodeWorkbench`, which renders
> Mira's letter, the retreat card, and hold/feedback actions on a
> single scrollable page. The four-beat description below is a design
> target, not current behavior. The companion design docs it
> referenced (`recommendation-reveal.md`, `refinement-alternatives.md`,
> `inventory-led-implementation-summary.md`) were never written.

The **design target** is a four-beat reveal flow, not a browse grid.
Mira owns ranking and presents **one** retreat as her strongest current
fit; alternatives and refinement are summoned by the practitioner, not
always-on. The full contract was to live in two companion docs (Beat 2
and Beat 3); both were aspirational and neither was written.

**Target beats:**
1. **Looking** — orb + quiet "looking at what fits" line. The breath
   between intention and recommendation.
2. **Arriving → settled** — image emerges from the orb, then settles
   into the dark-glass decision card: Mira's letter (the *why*) →
   retreat identity → one Hold CTA → status → collapsed disclosure
   (alternatives, provenance, wider-aperture evidence when dense,
   counterfactual, operator). No scroll,
   no chat input, no floating button.
3. **Listening** — summoned only via "see other possibilities" or
   "not this." Bounded 3–5 alternative cards with one-line
   differentiating reasons, elevate/not-this actions, and the voice
   lane (the only place free-text refinement lives).
4. **Committing** — the existing WebGPU commitment transition fires
   from the card's Hold CTA.

**What ships instead:** `EpisodeWorkbench` renders Mira's letter (via
`matchLetter`), the retreat card, a thinking beat (`reasoningBeat`),
Hold / Watch / Not-this actions, collapsed secondary tools (lenses,
alternatives, counterfactuals), a voice-lane feedback path, and the
`CommitmentPanel`. It is denser than the target contract's "one
primary decision per state" — multiple actionable paths are visible
simultaneously below the recommendation.

**Reduced motion support:** all motion respects `prefers-reduced-motion`.


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

**Cross-device continuity CTA** (ADR 0011 §5): after the booking succeeds,
`BookedLanding` shows a quiet "keep this across devices — optional" section
with a link to `/memory` — but only when the actor is not yet authenticated.
This is the moment the practitioner has a reason to want continuity; the CTA
never appears on arrival or for authenticated practitioners. The
`isAuthenticated` flag is threaded from the actor profile repository through
the episode detail payload.

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

`MiraImpulseProvider` lives at the shell level (`MiraFieldProvider` in
`app/layout.tsx`), so every journey surface — arrival, workbench, invite,
operator — reaches the orb. Kinds: `lean`, `commit`, `reject`, `resonate`,
`skip`. Decaying 0–1 scalar drives shader uniforms on hero `MiraScene`.

## Anticipation layer (booked → departure)

The booking-to-departure window is where travel-happiness research finds
most of the joy (Nawijn 2010; Kumar/Gilovich 2014) — see
[plans/anticipation-layer.md](../plans/anticipation-layer.md). The booked
landing paces the wait; it never pushes:

- **Wait presence** — `preparationPresence` (`agent/preparation-presence.ts`)
  projects days-since-booking into the orb's posture across the 5-day arc:
  `arriving` (day 0) → `holding` → `gathering` (the anticipation peak) →
  `resolving`. Same ring grammar as matching.
- **Savoring beats** — the preparation plan reveals one day at a time,
  keyed to days since booking. Past days collapse to titles; the current
  day expands; future days stay closed ("Mira will bring it when it's
  time"). One beat per return visit; the page is the notification.
- **Prospection feed** — `RetreatVisionFrame` holds the curated vision
  frame (aesthetic-vector-matched, cached) on the booked landing: the
  imagery of the place, in the palette they chose. No CTA — just held.
- **Peak-end close** — once the arc completes, a quiet "I'm back — close
  this journey" affordance fires `complete`; the completed landing marks
  the return and bridges to a new intention (the next anticipation
  cycle). Never suggested before the arc has run.

No push notifications, no streaks, no manufactured urgency — the hold
system provides real deadlines when they exist.

## Transitions

- Route changes: React `<ViewTransition>` (`app/layout.tsx`, gated by
  `experimental.viewTransition`). The page content fades/rises; the header
  (`site-header`) is pinned as a spatial anchor. Mira does not transition:
  the shell field is a persistent element outside the page group, so the
  orb simply stays while content changes around her. CSS in `globals.css`
  under the view-transition pseudo-elements; reduced motion zeroes all
  durations.
- In-flow steps: transitions.dev `t-page-slide`, `t-stagger`.
- Recommendation emergence: `GooeyEmergence` SVG filter makes the retreat
  card bud off from the orb with viscous fluid detachment
  (`components/GooeyEmergence.tsx`). Filter auto-removes after settle.
- Commitment gesture: `CommitmentArc` — a CSS-driven range slider using
  trigonometric arc physics (`sin(π×val/100)`) for parabolic lift, shadow
  depth, and terracotta fill (`components/CommitmentArc.tsx`).
- Commitment dissolve: `FluidParticlePour` — 2D SPH fluid particles
  stream from the confirmation area into the orb on booking success
  (`components/FluidParticlePour.tsx`). Canvas self-destructs after ~2.5s.
- Hold-state drip: `uHoldTension` uniform in the capsule shell — lower-
  hemisphere capsules oscillate downward like a suspended droplet deciding
  whether to fall.

## Dependencies

Hero 3D loads lazily: `three`, `@react-three/fiber`, `@react-three/drei`,
`@react-three/postprocessing`. Inline orbs remain lightweight 2D WebGL metaballs.
