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
| `hero` | ≥ 96 px | Full metaball morph, reactions, marble shader |
| `standard` | 40–95 px | Metaball morph, mudra ring |
| `inline` | < 40 px | Breath, ring, palette — simplified mask |

`MiraOrb` selects the tier from `size`. Multiple orbs may mount on one page;
WebGL contexts remain capped (`MAX_GL_ORBS`). Beyond the budget, CSS fallback
applies.

## Activity overlay

Outside an episode (arrival, booking dialogue, invitations), callers pass an
activity overlay via `mergePresence()`:

- `processing` → inquiry posture;
- `speaking` → offering posture;
- `arriving` → arriving posture.

Episode projection wins for posture; activity only overrides when explicitly
merged for transient UI work (submitting, narrating a phase).

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
