# Plan: Fix the recommendation dead end and Mira's absence

## Problem

Two issues from user testing, both rooted in the same cause:

1. **Users feel stuck at the recommendation** — they get one retreat card and a
   hold button. No visible alternatives, no "not this" option, no way to say
   "show me something else" without going through categorical feedback that
   silently clears the recommendation and sends them back to clarification.

2. **Mira feels like a background thing** — at the recommendation stage, Mira's
   letter (the "why this fits" explanation) is **never shown for new users**.
   The code renders only `letter.lines.slice(0, letter.recognitionLineCount)`,
   which is the recognition lines for returning users. The main letter lines
   ("I found a retreat that fits where you are right now...", "I'm
   recommending this because...") exist in `matchLetter()` but are only
   rendered in `RetreatExplorationView`'s Beat 2, which is wired to
   clarification steps, not the `review-recommendation` state.

## Root cause

There are two separate recommendation flows:

- **RetreatExplorationView** (new, Beat 2/3) — has Mira's letter, alternatives
  with "elevate this"/"not this", voice lane. Uses the inventory's
  `buildRecommendation` (client-side, not persisted). Wired to clarification
  steps only.
- **EpisodeWorkbench old flow** (lines 391-595) — shows the episode's
  recommendation from `scoreAll` (server-side, persisted, with all scoring
  axes including preference fit). Wired to `review-recommendation` state.
  Shows one retreat card, hold button, collapsed alternatives, categorical
  feedback. **This is what users see.**

The new flow was built but never connected to the review-recommendation state.
The old flow lacks the new flow's UX features.

## Approach: enhance the old flow

Bridging `RetreatExplorationView` to the episode command system would be a
large refactor — the two flows use different recommendation sources (inventory
vs `scoreAll`), different state machines, and different command patterns. The
risk is high and the gain is marginal since the old flow is already wired to
the real scoring policy.

Instead, enhance the old flow with the key UX features from the new flow:
Mira's letter, prominent alternatives with actions, and a "not this" path that
doesn't reset the user to clarification.

## Changes

### 1. Show Mira's letter for all users (not just returning)

**File:** `src/episodes/EpisodeWorkbench.tsx` (lines 391-415)

Currently only shows `letter.lines.slice(0, letter.recognitionLineCount)` —
the recognition lines for returning users. The main letter lines (indices
`recognitionLineCount` through end) are never rendered.

Change: show the full letter — recognition lines (if any) as the "note from
Mira" aside, then the main letter lines as the primary voice above the
retreat card. For new users, `recognitionLineCount` is 0, so they'll see the
main letter ("I found a retreat that fits where you are right now...") for the
first time.

This is the single highest-leverage change for "Mira feels background."

### 2. Add a prominent "See other possibilities" action

**File:** `src/episodes/EpisodeWorkbench.tsx` (lines 499-517)

Currently `ExploreOtherFits` is a collapsed section that shows alternatives as
read-only text with lens toggles and counterfactuals. Users don't see it.

Change: add a visible secondary button below the hold button:
"See other possibilities I'm weighing →". Clicking it expands the alternatives
section. Each alternative gets:
- Title, location, duration, price
- A one-line reason (from the episode's `alternatives` array, which already
  has `reasoning` — or generate one from the scoring steps)
- **"Choose this instead"** button — sends a new command to elevate this
  alternative to the top pick
- **"Not this"** button — removes it from the alternatives set

Keep the lens toggles and counterfactuals as a tertiary disclosure within the
expanded section — they're useful but not the primary action.

### 3. Add "Not this one" on the main recommendation

**File:** `src/episodes/EpisodeWorkbench.tsx` (lines 555-581)

Currently the only way to reject the main recommendation is "This doesn't feel
right →" which expands categorical feedback buttons (timing, budget, group,
place, intention). Clicking one sends `feedback` which clears the
recommendation and sends the user back to clarification — a jarring reset.

Change: add a "Not this one" button next to the hold button. Clicking it:
- Sends `feedback` with reason "place" (the closest existing category for
  "I don't want this specific retreat")
- BUT instead of sending the user back to clarification, immediately
  re-recommends with the rejected retreat excluded
- Shows the next-best retreat with Mira's letter

This requires a new command or a modification to the `feedback` command:
- Option A: add `excludedRetreats: string[]` to the feedback command, and
  have `recommendForEpisode` skip excluded retreats
- Option B: add a new `reject-recommendation` command that clears the current
  recommendation, adds the retreat to a rejected list, and re-recommends

Option B is cleaner — it doesn't conflate "this specific retreat is wrong"
with "my constraints are wrong."

### 4. Make Mira's voice present at more stages

**File:** `src/episodes/EpisodeWorkbench.tsx`

Currently Mira is silent during:
- The hold state (just a HoldPanel with logistics)
- The monitoring state (just a "Check for changes" button)
- The "stuck" moment between recommendation and decision

Change: add short Mira voice lines at these stages:
- After hold: "I'm watching this for you. I'll let you know if anything
  changes." (from `bookingDialogue`'s `watchNext` lines — already exists)
- After monitoring: "Last checked [time]. [summary]" (already shown but
  formatted as system text, not Mira's voice)
- At the recommendation, before the letter: a small Mira orb (40px) with
  the letter, making her presence visible

### 5. Reduce the field veil in the workbench

**File:** `src/episodes/EpisodeWorkbench.tsx`

Currently the field veil is 0.4 (heavy darkening for content legibility).
This makes Mira's orb barely visible.

Change: reduce to 0.28 — still legible but Mira's presence is more felt.
This is a one-line change but addresses "Mira feels background" at the
visual level.

## What NOT to change

- **Don't bridge RetreatExplorationView to the review state.** The two systems
  use different recommendation sources. Bridging is a large refactor with
  marginal gain over enhancing the old flow.
- **Don't remove the old flow.** It's wired to the episode command system
  (hold, feedback, monitoring, coordination, booking). The new flow's
  `onCommit` doesn't actually create a hold.
- **Don't add audio voice.** Text-based voice is the design. Audio is a
  separate decision.
- **Don't make the orb interactive.** The orb is ambient by design (ADR 0011
  surface hierarchy). Making it clickable would change the product contract.

## New command: `reject-recommendation`

**File:** `src/episodes/model.ts`

```typescript
| { type: "reject-recommendation"; retreatRootHash: string }
```

**File:** `src/episodes/service.ts`

In `applyEpisodeCommand`:
- Add the rejected retreat to `episode.rejectedRetreats` (new field on
  `Episode`)
- Clear the current recommendation
- Re-recommend, excluding rejected retreats
- If no retreats remain, set status to "clarifying" with a Mira line:
  "I've set aside everything that fits so far. Let's revisit what matters."

**File:** `src/episodes/recommendation.ts`

`recommendForEpisode` needs to accept an optional `excludedRootHashes`
parameter and filter them from the pool before scoring.

## Files to change

1. `src/episodes/EpisodeWorkbench.tsx` — show full letter, add "See other
   possibilities" button, add "Not this one" button, add Mira voice at hold/
   monitor stages, reduce veil
2. `src/episodes/model.ts` — add `reject-recommendation` command, add
   `rejectedRetreats` field to Episode
3. `src/episodes/service.ts` — handle `reject-recommendation` command
4. `src/episodes/recommendation.ts` — accept `excludedRootHashes` parameter
5. `src/agent/mira-voice.ts` — add a "rejection" voice line for when the user
   says "not this one" and Mira presents the next option
6. `src/episodes/EpisodeWorkbench.tsx` — add "Choose this instead" action on
   alternatives (sends `reject-recommendation` for the current top pick, then
   the alternative becomes the new top via re-recommendation)

## Testing

1. Unit test: `reject-recommendation` command adds to `rejectedRetreats` and
   re-recommends excluding rejected retreats
2. Unit test: `recommendForEpisode` with `excludedRootHashes` skips them
3. Unit test: `matchLetter` main lines are shown when `recognitionLineCount`
   is 0 (new user)
4. Smoke journey: after recommendation, "Not this one" produces a different
   recommendation
5. Manual: new user sees Mira's letter at the recommendation (not just a
   retreat card)

## Out of scope

- Wiring RetreatExplorationView to the review state (separate refactor)
- Audio voice (separate product decision)
- Orb interactivity (separate product decision)
- Unifying the two recommendation systems (separate refactor)
