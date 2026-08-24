# Visual Wow-Factor Roadmap

> Four techniques drawn from external inspiration, applied to Mira's living
> presence and the commitment ceremony. Each extends the existing visual
> language: Mira is a liquid presence — things emerge from her, pour into
> her, and she reshapes continuously.

## References

| # | Repo / Source | Technique | Link |
|---|---|---|---|
| 1 | saharan/works/drops | GPU fluid particle simulation (SPH) | https://github.com/saharan/works/tree/main/drops |
| 2 | oguzhantufenk/gooey-search | SVG filter gooey effect + Framer Motion | https://github.com/oguzhantufenk/gooey-search |
| 3 | phobon/raymarching-tsl | Raymarched SDF liquid blobs (Three.js TSL) | https://github.com/phobon/raymarching-tsl |
| 4 | CSS flight slider (Álvaro Montoro) | Trigonometric arc physics, CSS-only range input | CodePen (pure CSS flight progress) |

---

## 1. Gooey Filter — Recommendation Emergence

**Inspiration:** gooey-search (SVG `feGaussianBlur` + `feColorMatrix` contrast
bump makes separate DOM elements appear to merge/divide like fluid).

**Where it applies:**
- Recommendation cards budding off from the orb region
- Input focus states (Mira accent dot merges into the field border)

**Mechanism:**
A hidden SVG `<filter id="goo">` using blur + contrast matrix wraps the
emergence container. As cards animate outward with Framer Motion springs,
the filter creates a viscous "detaching" read. The filter is removed once
elements settle, restoring text crispness.

**Implementation:** `src/components/GooeyEmergence.tsx`

**Performance:** Pure SVG filter compositing — no extra GPU contexts, no
dependencies. Degraded gracefully (filter simply removed) on
`prefers-reduced-motion`.

---

## 2. Trigonometric Arc Slider — Commitment Gesture

**Inspiration:** CSS flight slider — `sin(π × val / 100)` creates parabolic
arcs from a linear `<input type="range">`, giving physical lift, shadow
depth, and scale without JS animation.

**Where it applies:**
- The hold → commit decisive gesture
- Intention clarity gauge (during clarification)

**Mechanism:**
A styled `<input type="range">` driven by CSS custom property `--val`.
Derived properties use `sin()` and `clamp()` for:
- Thumb scale (lifts mid-drag, settles at endpoints)
- Shadow depth (casts deeper shadow at the arc's peak)
- Background fill (terracotta liquid rising)
- Haptic feedback point (at 80%, indicating point of no return)

At `--val: 100`, fires the `commit` impulse and triggers `breath-ripple`.

**Implementation:** `src/components/CommitmentArc.tsx` + CSS in `globals.css`

**Performance:** Zero JS animation frames — all `calc()` + CSS trig. One
`oninput` handler updates `--val`. Accessible via native range semantics.

---

## 3. Raymarched SDF Core — Living Orb Interior

**Inspiration:** phobon/raymarching-tsl — signed-distance-field metaballs
rendered via raymarching in fragment shaders, producing topology-changing
liquid blob merges.

**Where it applies:**
- Replaces or augments `GlassCore` (the `MeshTransmissionMaterial` sphere)
  in `MiraScene` at hero tier
- Posture transitions: SDF smooth-union parameter morphs between states

**Mechanism:**
A fullscreen-quad `ShaderMaterial` in the R3F scene, positioned behind the
capsule shell, rendering raymarched SDF blobs. Uniforms map to
`MorphParams`:
- `blobCount` → number of SDF primitives
- `orbitSpeed` → rotation velocity
- `turbulence` → noise displacement amplitude
- `asymmetry` → non-uniform scaling
- `bloom` → smooth-union blending radius (controls how fluidly blobs merge)

Rendered to a 512×512 offscreen target for performance, composited as a
texture on a quad inside the scene. The existing tier system handles
degradation — standard tier continues using `MeshTransmissionMaterial`.

**Implementation:** `src/components/mira-sdf-core.ts` (GLSL) +
`SDFCore` component in `MiraScene.tsx`

**Performance:** Fragment-heavy but bounded by render target resolution.
At 512×512, maintains 60fps on integrated GPUs. Falls back to existing
glass core when WebGL2 is unavailable or on low-power hint.

---

## 4. Fluid Particle Pour — Commitment Dissolve

**Inspiration:** saharan/drops — SPH fluid simulation with surface tension,
gravity, and viscosity creating organic liquid behavior.

**Where it applies:**
- Commitment ceremony: intention text dissolves into fluid particles that
  stream downward into the orb
- Hold state: surface-tension drip oscillation on the capsule shell

**Mechanism:**
A 2D `<canvas>` layered above `MiraField`, running a simplified SPH sim
(~200–400 particles). On commitment:
1. Text glyphs fragment into particles at their DOM positions
2. Gravity + viscosity pull particles toward the orb center
3. Surface tension creates cohesive streams (not scattered dust)
4. On arrival at orb center, particles fade and orb's `blobCount` /
   `brightness` posture params increase

For hold-state tension: a `holdTension` uniform added to
`mira-scene-shaders.ts` makes capsule clusters drip downward in slow
oscillation, then spring back.

**Implementation:** `src/components/FluidParticlePour.tsx` +
uniform additions to `mira-scene-shaders.ts`

**Performance:** 200–400 particles with neighbor search is ~0.5ms per
frame on modern hardware. The canvas is destroyed after the pour
animation completes (~2.5s). Reduced motion skips entirely (commitment
confirmed via a simple fade).

---

## Compound Theme: The Living Surface

| Moment | Technique | Source |
|--------|-----------|--------|
| Mira idle | Raymarched SDF blobs breathing | raymarching-tsl |
| Recommendations surface | Gooey filter budding from orb | gooey-search |
| Hold tension | Surface-tension drip oscillation | saharan/drops |
| Commitment gesture | Trigonometric arc slider | flight CSS |
| Intention dissolve | Particle fluid pour into orb | saharan/drops |
| State transitions | SDF smooth-union morphing | raymarching-tsl |
| Input focus | Gooey merge dot → field | gooey-search |
| Reduced motion | All degrade to opacity/scale | existing system |

---

## Priority & Effort

| # | Technique | Effort | Dependencies | Risk |
|---|---|---|---|---|
| 1 | Gooey emergence | ~30 min | None (SVG + existing Framer Motion) | Low |
| 2 | Trig arc slider | ~1–2 hrs | None (pure CSS) | Low |
| 3 | Raymarched SDF core | ~4–6 hrs | None (existing Three.js) | Medium (perf) |
| 4 | Fluid particle pour | ~6–8 hrs | None (vanilla canvas) | Medium (complexity) |

---

## Accessibility Contract

All four techniques respect `prefers-reduced-motion`:
- Gooey: filter removed, cards appear with simple opacity fade
- Arc slider: trig-derived transforms zeroed, standard range input renders
- SDF core: falls back to static radial gradient (existing `StaticOrbFallback`)
- Particle pour: skipped entirely, commitment confirmed via crossfade

Screen reader semantics are preserved: the slider uses native `<input
type="range">` with `aria-label`; gooey containers carry `aria-live`;
the canvas is `aria-hidden`.
