# Experience layer

Bold, experimental surfaces that carry the product contract — not decoration
on top of forms.

## Arrival

1. **Aesthetic calibration** — four image reactions (`AestheticCalibration`)
   build a session vector; CloudField and Mira orb palette respond live.
   Swipe left/right on mobile; resonate/skip impulses feed Mira.
2. **Retreat vision** — after calibration, `RetreatVision` resolves a
   **curated frame** from the local asset catalog (`public/aesthetics/visions/`).
   Deterministic matching from the aesthetic vector + calibration reactions.
   Result is cached in `localStorage` by fingerprint — zero runtime API cost.
3. **Hero Mira** — 128px `MiraScene` (Three.js glass core + attractor shell + bloom).
4. **Intention** — staggered copy reveal after atmosphere is established.

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

- Route changes: keyed `page-enter` on pathname (no child-retrigger jank).
- In-flow steps: transitions.dev `t-page-slide`, `t-stagger`.
- Scroll resets to top on navigation.

## Dependencies

Hero 3D loads lazily: `three`, `@react-three/fiber`, `@react-three/drei`,
`@react-three/postprocessing`. Inline orbs remain lightweight 2D WebGL metaballs.
