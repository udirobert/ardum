# Plan: Arrival-to-recommendation redesign

## Problem

Test users say:
1. The orb still feels like background, not a character
2. The swipe step doesn't introduce Mira or set expectations
3. The result comes too quickly with no visible thought process
4. No real way to tweak the factors that shaped the recommendation
5. No conversational way to share feedback about the result
6. Still feels like a dead end (hold or do nothing)

Root cause: the interaction model is form → result → decision. Mira is
decorative text on top of a form submission. The codebase already has the
infrastructure for a conversational character experience (inquiry posture,
processing activity, the use-retreat-exploration hook with "looking" state,
the Beat 3 voice lane) but the orchestration skips every conversational beat
and jumps straight to results.

## Design principle

Mira is the medium, not the wallpaper. Every transition should feel like
Mira doing something — thinking, considering, presenting, adjusting — not
the system loading data. The orb is the focus during transitions, not a
background element. Text is Mira's voice, not system copy.

## Changes

### 1. Aesthetic calibration as Mira's introduction

**Files:** `src/aesthetics/AestheticCalibration.tsx`,
`src/components/ArrivalScreen.tsx`

Currently the swipe step opens with "Show me what feels closer. Swipe or
tap. I shift as you choose." — a UI instruction, not an introduction.

Change the opening to frame Mira as a character who is getting to know you:

- Before the first swipe: a brief intro beat (2-3s) where the orb is the
  focus (large, centered, inquiry posture) with Mira's voice:
  "I'm Mira. Before words — show me what you're drawn to. I'll learn from
  what you choose."
- After each swipe: the orb reacts (relief on "this feels right", gentle
  setback on "not this") and a short voice line appears:
  - First swipe: "Noted."
  - Second: "I'm seeing a pattern."
  - Third: "Almost there — one more."
  - Fourth: "I have a sense of what you're drawn to."
- The quality tags ("leaning toward warm, dark") become Mira's voice, not
  system feedback: "You're leaning toward warm and grounded."

This makes the swipe step feel like a conversation, not a calibration
widget. The orb is the focus, not background.

### 2. Thinking beat before the recommendation

**Files:** `src/episodes/EpisodeWorkbench.tsx`,
`src/agent/mira-voice.ts` (new function)

Currently: user clicks "Consider what matters" → recommendation appears
immediately as a finished card. No sense of process.

Add a visible "thinking" beat between the recommend command and the card:

- When `act({ type: "recommend" })` fires, show a 3-4 second thinking
  state:
  - Orb is prominent (inquiry posture, processing activity, veil reduced
    to 0.15 so the orb is clearly visible)
  - Mira's voice surfaces her reasoning step by step, fading in:
    1. (1s) "Let me sit with what you've told me."
    2. (2s) "You want [energy state]. [Budget band]. [Social comfort]."
    3. (3s) "I'm weighing [N] retreats against that."
    4. (4s) "One sits closest."
  - Then the recommendation card fades in with the full letter

This makes the recommendation feel earned — Mira thought about it, not
just queried a database. The reasoning is the reveal, not a footnote.

Implementation: a new `reasoningBeat()` function in mira-voice.ts that
takes the intention constraints and returns timed reasoning lines. The
EpisodeWorkbench shows these lines during the `busy` state after a
recommend command, with the orb in inquiry posture.

### 3. Surface the factors as part of the main flow

**Files:** `src/episodes/EpisodeWorkbench.tsx`

Currently: lens toggles (balanced/restorative/movement) and counterfactuals
(budget/energy) are buried in a collapsed "See other possibilities" section.
The user doesn't know they can shape how Mira weighs things.

Move the factor controls into the main flow, below the recommendation
letter but above the hold button:

- A section titled "What if we weighted this differently?" with:
  - Three lens buttons (balanced / restorative / movement) — prominent,
    not collapsed
  - One line of Mira's voice: "These change how I weigh what fits. They
    don't change what you asked for."
  - When a lens is selected, show the outcome inline: "Under [lens],
    [retreat] still sits closest" or "Under [lens], [different retreat]
    rises to the top."
- Budget and energy counterfactuals stay as a secondary disclosure —
  they're for deeper exploration, not the primary conversation.

This makes the factors visible and tweakable without overwhelming the
primary decision. The user can shape Mira's thinking, not just accept
or reject her result.

### 4. Conversational feedback — wire the voice lane

**Files:** `src/episodes/EpisodeWorkbench.tsx`,
`src/agent/conversation-extractor.ts` (existing)

Currently: "This doesn't feel right" gives 5 categorical buttons that
reset to clarification. The RetreatExplorationView has a voice lane
("tell me what feels off") but it's not wired to the review state.

Add a voice lane to the recommendation review:

- Below the factors section, a text input: "Tell Mira what feels off"
- When the user submits text:
  - Extract constraints from the text (conversation-extractor already
    does this)
  - If constraints extracted: apply them via `revise-intention` and
    re-recommend, with a brief "thinking" beat
  - If no constraints extracted: Mira responds with a specific nudge
    ("Tell me about the place — that's still open for me.")
- Keep the categorical buttons as a fallback disclosure below the voice
  lane, not the primary path

This lets the user say "I don't want somewhere remote" in their own words
and have Mira respond, instead of picking from 5 buttons.

### 5. Recommendation as the beginning, not the end

**Files:** `src/episodes/EpisodeWorkbench.tsx`,
`src/agent/mira-voice.ts`

Currently: the recommendation screen ends with "Hold this for 48 hours"
or "Not this one." The relationship ends at the decision.

Reframe the bottom of the screen so it feels like the beginning of an
ongoing process:

- After the hold button, add Mira's voice: "I'll keep watching this for
  you. If something fits better, I'll let you know." (This already exists
  in the hold state — move it to the recommendation state too, as a
  forward-looking statement.)
- Change "Not this one — show me another" to feel less like rejection
  and more like continuation: "Show me what else you're weighing" —
  which opens the alternatives with the voice lane.
- Remove the terminal feeling by making the screen feel like a checkpoint,
  not a finish line. The copy should imply Mira is still working: "This
  is my strongest current fit" (already exists) → "I'm still watching
  for changes."

### 6. Make loading states Mira's voice

**Files:** `src/components/ArrivalScreen.tsx`,
`src/episodes/EpisodeWorkbench.tsx`

Small but high-leverage wording changes:

- "Let me find where we left things…" → "Let me recall where we left
  things…"
- "Returning to your intention…" → "I'm returning to your intention…"
- "Considering what matters…" → "Sitting with what you've told me…"

These are one-line changes that make system states feel like character
actions.

### 7. Orb prominence during key moments

**Files:** `src/components/ArrivalScreen.tsx`,
`src/episodes/EpisodeWorkbench.tsx`

During the thinking beat and the aesthetic calibration intro, the orb
should be the focus, not background:

- During the thinking beat: veil reduced to 0.15, orb in inquiry posture
  with processing activity
- During the aesthetic calibration intro: orb centered and large (not
  full-bleed background, but a visible character)
- During the recommendation reveal: orb transitions from inquiry to
  offering posture as the card appears

The veil reduction I already did (0.4 → 0.28) applies to the steady
state. During transitions, go further (0.15) so Mira is clearly visible
when she's "doing something."

## What NOT to change

- **Don't restructure the state machine.** The episode statuses
  (capturing → clarifying → ready → recommendation-ready) are correct.
  The changes are in how transitions are presented, not in the states
  themselves.
- **Don't bridge RetreatExplorationView to the review state.** The
  inventory-based recommendation system it uses is separate from the
  episode scoring policy. The voice lane and factor controls can be
  added directly to the EpisodeWorkbench without bridging the two
  systems.
- **Don't add audio voice.** Text-based voice is the design.
- **Don't make the orb interactive (clickable).** The orb is ambient by
  design. Making it prominent during transitions is different from
  making it a button.

## Files to change

1. `src/aesthetics/AestheticCalibration.tsx` — intro beat, per-swipe
   voice lines, quality tags as Mira's voice
2. `src/components/ArrivalScreen.tsx` — orb prominence during calibration,
   loading state wording
3. `src/episodes/EpisodeWorkbench.tsx` — thinking beat, factor controls
   in main flow, voice lane, recommendation-as-beginning copy, loading
   state wording, orb prominence during transitions
4. `src/agent/mira-voice.ts` — new `reasoningBeat()` function for the
   thinking beat, per-swipe voice lines for calibration

## Testing

1. Manual: new user flow — calibration feels like meeting Mira, not a
   widget
2. Manual: recommendation feels earned after a visible thinking beat
3. Manual: user can tweak lens weighting and see the outcome inline
4. Manual: user can type "I don't want somewhere remote" and Mira
   responds
5. Smoke journey: all existing steps still pass
6. Unit test: `reasoningBeat()` returns timed lines for given constraints

## Out of scope

- Bridging RetreatExplorationView to the review state (separate refactor)
- Audio voice (separate product decision)
- Orb interactivity (separate product decision)
- Restructuring the episode state machine
- Changing the scoring policy or recommendation engine
