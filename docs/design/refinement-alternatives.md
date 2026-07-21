# Refinement & alternatives (Beat 3 spec)

The summoned expansion from Beat 2's disclosure row "see other
possibilities I'm weighing." This is the only place the cinematic
inventory-led scroll grid lives, and it lives on the user's terms — never
as the steady state of the episode workbench.

Companion to [recommendation-reveal.md](recommendation-reveal.md). Read
that first: Beat 3 only makes sense as a branch from Beat 2.

## Why this beat exists

The current `RetreatExplorationView` treats the catalog scroll as the home
base and refinement as an always-on input bar. Both are wrong:

- The catalog scroll is a **secondary tool**, not the spine. The vision is
  explicit: "browsing, alternatives, technical provenance, and provider
  status can exist as secondary tools. They do not define the primary
  journey."
- Refinement is **summoned**, not persistent. An always-on chat input
  competes with the primary decision and turns the workbench into "a
  chatbot wrapped around checkout" — the pattern the vision rejects.

Beat 3 is the correct shape for both: a bounded view the user opens when
they signal mismatch, presents a *small* set of alternatives Mira is
actually weighing, accepts a reaction, and returns to Beat 2 with a new
top pick.

## Entry triggers

Beat 3 opens only when the user signals that the current top pick is not
right. Three legitimate triggers:

1. **Disclosure row:** "see other possibilities I'm weighing" — explicit
   summon.
2. **"Not this" on the decision card:** a quiet secondary control (not a
   co-primary CTA) that means "the top pick is wrong, show me what else
   you're weighing." Re-enters clarity, per the 0008 decision tree
   (`recommend → not this → feedback → re-clarify / re-rank`).
3. **Voice lane, only after a mismatch signal:** the orb's lower-third
   voice lane appears *only* when Beat 3 is open. It is not present in
   Beat 2. This is the key correction to the current design — the arrival
   voice lane was for intention articulation; it does not carry forward
   as a persistent refinement input on every screen.

Never auto-open. Even under high uncertainty, Beat 2 surfaces a quiet
nudge row ("there are 2 things I'm uncertain about") rather than
force-expanding alternatives. The user summons.

## Composition

A **bounded overlay** over the Beat 2 card, not a route change. The field
and orb persist; the decision card dims underneath.

```
┌─────────────────────────────────────────────────┐
│  [field + orb persist, dimmed]                  │
│                                                 │
│  Other possibilities I'm weighing              │  ← Mira's frame
│  Three that sit close to what you named.        │     (≤2 lines)
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ [hero image, 16:9]                        │  │
│  │ Forest Silence Solo                       │  │  ← card 1
│  │ 3 days · $750 · Pacific Northwest         │  │
│  │ "Solo, settled, short — closest to        │  │  ← one-line reason
│  │  what you named."                         │  │     (Mira's voice)
│  │              [elevate this] [not this]    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ [hero image, 16:9]                        │  │
│  │ Coastal Flow & Restore                    │  │  ← card 2
│  │ 7 days · $1,650 · Algarve                 │  │
│  │ "Same energy, longer container, ocean."   │  │
│  │              [elevate this] [not this]    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ [hero image, 16:9]                        │  │
│  │ Silent Mountain Retreat                   │  │  ← card 3
│  │ 7 days · $1,850 · Himalayan foothills     │  │
│  │ "Deeper silence, further travel."         │  │
│  │              [elevate this] [not this]    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ voice lane: tell me what feels off       │    │  ← only here, not Beat 2
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [close — return to top pick]                   │
└─────────────────────────────────────────────────┘
```

### Bounded, not infinite

- **3–5 alternatives, never the whole catalog.** These are the retreats
  Mira is *actually weighing* — the ranking policy's next tier, not a
  browse feed. If the catalog has 50 retreats, the user sees 4.
- **No infinite scroll.** The view fits in 1–2 viewport heights. If it
  doesn't fit, the set is too big — narrow it.
- **Each card is compact:** hero image (16:9, not full-bleed), identity
  line, one-line reason in Mira's voice, two actions. No gallery, no
  operator bio, no highlights — those are Beat 2 disclosure material once
  one is elevated.

### One-line reason per alternative

Each card carries a **one-line reason in Mira's voice** explaining how it
differs from the current top pick. Not a brochure sentence — a
differentiation:

- "Solo, settled, short — closest to what you named."
- "Same energy, longer container, ocean."
- "Deeper silence, further travel."

These are generated by the same letter logic as Beat 2's Mira letter
(see [recommendation-reveal.md](recommendation-reveal.md) §Copy contract),
but compressed to one differentiating clause. Never generic ("a retreat
that might resonate"). Never plural.

## Actions on each alternative card

Two actions, equal weight, both quiet:

| Action | Effect |
|--------|--------|
| **Elevate this** | This retreat becomes the new top pick. Beat 3 closes. Beat 2 replays the reveal choreography (≤1.5s) with the new retreat. |
| **Not this** | This retreat is removed from the weighed set for this episode. The remaining set re-renders. If the set drops below 2, Beat 3 auto-closes back to Beat 2 with the survivor. |

"Not this" is **feedback that re-enters clarity** — it tells Mira
something about the practitioner's preference and shapes future
re-ranks. It is not a destructive action on a hold (no hold is active
during Beat 3 in the primary path).

## Voice lane (only in Beat 3)

The voice lane appears at the bottom of the Beat 3 overlay — the same
lower-third composition as arrival, over the dimmed field. It is the
*only* place free-text refinement lives.

- Placeholder: "tell me what feels off"
- On submit: extract constraints (`extractConstraints`), merge
  (`mergeConstraints`), re-rank, replace the alternatives set. The voice
  lane stays open; the cards re-render with motion-path transitions
  (existing choreography).
- If extraction yields nothing: Mira responds in-lane ("I want to
  understand — is it the timing, the place, or the feel?") rather than
  silently failing or showing generic copy.
- Closing Beat 3 dismisses the voice lane. It does not persist into
  Beat 2.

This is the correction to the current always-on top input bar: refinement
is a mode the user enters, not a permanent fixture.

## Field and posture

- `fieldTier: hero` persists from Beat 2 (no tier downgrade on overlay).
- Posture: `activity: listening` while Beat 3 is open and voice lane is
  unfocused; `processing` during re-rank; returns to `idle` when Beat 3
  closes back to Beat 2.
- Veil raises slightly over the dimmed Beat 2 card so the alternatives
  read first.

## Transitions

- **Beat 2 → Beat 3:** the decision card dims and compresses (200ms);
  the alternatives overlay rises from the lower third with staggered
  card entrance (existing `t-stagger`). The orb does not move.
- **Re-rank within Beat 3:** old cards arc away toward the orb (existing
  motion-path exit), new cards emerge (existing motion-path enter).
  Staggered, ≤1.2s total.
- **Beat 3 → Beat 2 (elevate):** overlay collapses, the elevated
  retreat's hero emerges from the orb in the Beat 2 reveal
  choreography (≤1.5s, shorter than initial reveal).
- **Beat 3 → Beat 2 (close without elevate):** overlay fades, original
  top pick's card restores. No re-reveal — the original is still
  settled.

## What is NOT on this beat

- **No hold CTA.** Holding happens in Beat 2. Beat 3 is for choosing
  what to hold, not holding itself.
- **No operator chrome.** No revision counters, no wallet substrings, no
  attestation IDs. Those are Beat 2 disclosure.
- **No gallery, no highlights, no full description.** Those belong to
  the Beat 2 card once a retreat is elevated. Beat 3 cards are
  comparison surfaces, not brochures.
- **No "what stands out to you?"** The frame is set by Mira ("other
  possibilities I'm weighing"), and the user reacts to specific cards or
  speaks into the voice lane.

## Accessibility

- Each alternative card is a `role="group"` with an accessible name
  (the retreat title).
- "Elevate this" and "Not this" are real buttons with discernible
  labels, not icon-only.
- Voice lane input is a labeled textarea (visually styled as the orb's
  lower-third lane, semantically a form field).
- Escape closes Beat 3 and returns to Beat 2 without elevating.
- All motion respects `prefers-reduced-motion` (cross-fade fallback).

## Open questions for review

1. **Set size.** 3–5 is a guess. The right number is "enough to feel
   like a real choice, few enough that each one carries weight." 3
   feels right for a curated catalog; 5 may be needed once the live
   catalog grows. Tie this to the ranking policy's natural tier break,
   not a hardcoded constant.
2. **"Not this" persistence.** When the user rejects an alternative,
   does it stay rejected for the episode lifetime, or just this Beat 3
   session? My read: episode lifetime — it's preference signal that
   should shape future re-ranks. But it should be inspectable and
   reversible in disclosure ("retreats you've set aside").
3. **Voice lane extraction failure.** When `extractConstraints` returns
   empty, the current hook shows generic "I'd love to understand
   better" copy. The spec calls for a specific in-lane nudge ("is it
   the timing, the place, or the feel?"). That requires the extractor
   to expose *what dimensions are still open* — a small API addition.
