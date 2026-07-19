# Mira presence

Mira's visual presence is a **journey posture**, not a mood mirror. The orb
morphs to reflect what Mira is doing for the episode and how much tension the
journey currently carries — never to guess how the person feels.

Operational truth for posture lives in `src/agent/mira-presence.ts`. The
episode repository remains authoritative; presence is a pure projection from
episode state, events, and stated calibration. `MiraOrb` consumes the
projection and renders it. Voice (`mira-voice.ts`) and orb stay aligned
because both read the same contract.

## Posture vocabulary

| Posture | When | Visual read |
|---|---|---|
| `steady` | Default, capturing, paused | Settled sphere |
| `inquiry` | Clarifying, processing | Open seal, inward knot |
| `offering` | Recommendation surfaced, speaking | Outward bloom |
| `watching` | Active monitoring | Slow orbit, held asymmetry |
| `holding` | Non-binding hold active | Contained pulse |
| `gathering` | Coordination in flight | Merging lobes |
| `resolving` | Setback absorbed, re-forming | Brief pinch → deliberate return |
| `arriving` | Booked, commitment settled | Warm expansion |

Postures interpolate in a continuous morph space (attractor positions,
pinch, bloom, asymmetry). They are not hard cuts between bespoke models.

## Valence

`valence` is a scalar from `-1` (settled) to `1` (disrupted). It modulates
the same posture — faster breath, more turbulence — without inventing a new
shape name.

Derived from operational signals only:

- recommendation uncertainties;
- hold expiry pressure;
- negative monitor observations;
- participant declines;
- stated energy calibration (`low`, `sharp` raise tension slightly).

Mira never infers psychology from chat text or typing patterns.

## Reactions

When a noteworthy episode event lands, the projector may attach a one-shot
reaction:

| Kind | Typical trigger |
|---|---|
| `setback` | Participant declined |
| `relief` | Hold created, commitment recorded |
| `deadline` | Hold expired |
| `surprise` | Intention revised, negative monitor observation |

Reactions carry the originating `eventId`. The orb plays a brief morph pulse
when the id changes, then eases back to the sustained posture. Reactions must
not compete with the next human decision — subtle at inline sizes, fuller only
on hero or workbench orbs.

## Render tiers

Fidelity scales with footprint and page budget:

| Tier | Size | Expression |
|---|---|---|
| `hero` | ≥ 96 px | **MiraScene** — glass transmission core, attractor shell, bloom, chromatic aberration |
| `standard` | 64–95 px | MiraScene at reduced footprint |
| `inline` | < 64 px | 2D metaball WebGL or CSS fallback |

`MiraOrb` selects the tier from `size`. Multiple orbs may mount on one page;
WebGL contexts remain capped (`MAX_GL_ORBS`). Beyond the budget, CSS fallback
applies.

## Interaction impulse

`MiraImpulseProvider` exposes a decaying 0–1 scalar when the person leans on
or commits to a choice (`lean`, `commit`, `resonate`, `skip`). Hero
`MiraScene` reads impulse via shader uniforms — faster orbit, brighter bloom,
glass distortion. Impulse is ephemeral UI feedback; it never writes episode
state.

## Activity overlay

Outside an episode (arrival, booking dialogue, invitations), callers pass an
activity overlay via `mergePresence()`:

- `processing` → inquiry posture;
- `speaking` → offering posture (prompt reveal on arrival);
- `listening` → steady posture, slightly negative valence (textarea focused);
- `arriving` → arriving posture.

Episode projection wins for posture; activity only overrides when explicitly
merged for transient UI work (submitting, narrating a phase, or waiting on
input).

## Accessibility

`presenceAnnouncement()` drives the `aria-live` region. The decorative orb
stays `aria-hidden`. Reduced motion settles to a static frame with no morph
loop.

## API surface

Episode routes project `miraPresence` alongside operational payload fields:

| Route | Field |
|---|---|
| `GET /api/episodes` | `activeMiraPresence` for the first non-completed episode |
| `GET /api/episodes/[id]` | `miraPresence` for the requested episode |
| `POST /api/episodes/[id]/actions` | `miraPresence` after each command (reactions fire here) |
| `POST /api/episodes` | `miraPresence` on create |

Assembly lives in `src/episodes/detail-payload.ts`. Clients should consume
server-projected presence rather than re-projecting episode state locally.

## What Mira is not

- Not a mascot with random cute animations.
- Not a sentiment mirror ("you seem anxious").
- Not a reasoning dashboard — provenance stays in copy and inspectable state.

The orb amplifies Mira's role as guide. Copy carries meaning; the form shows
that something is happening in the journey.
