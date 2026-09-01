# Plan: The anticipation layer

> **Status:** Shipped (2026-09-01) — all four build items live:
> `preparation-presence.ts` + `BookedLanding` savoring beats +
> `RetreatVisionFrame`, and the completed-landing return close in
> `EpisodeWorkbench`. The full reflective ritual remains deferred by design.
> **Premise:** The emotional arc of a retreat does not end at "booked" —
> by the research, that is where most of the joy begins. Ardum currently
> goes quiet exactly when the practitioner is happiest.
> **Sibling plans:** [operator-value-surface.md](operator-value-surface.md)

## The thesis (research-grounded)

Travel happiness research consistently finds that **anticipation is a
primary driver of holiday wellbeing** — for experiential purchases
specifically, the waiting period is itself pleasurable:

- **Nawijn et al. (2010)**, 1,530 Dutch adults: vacationers reported
  higher happiness *before* the trip than during or after; the boost
  fades on return. Pre-trip happiness is the largest single effect.
  ([PMC2837207](https://pmc.ncbi.nlm.nih.gov/articles/PMC2837207/))
- **Kumar, Killingsworth & Gilovich (2014), "Waiting for Merlot"**:
  anticipation of *experiences* is more pleasurable than anticipation of
  possessions, and waiting for an experience tends to be pleasant
  (mingled with excitement) rather than impatient.
  ([Sage](https://journals.sagepub.com/doi/abs/10.1177/0956797614546556))
- **Nawijn (2011)** follow-up: frequent short vacations may maximize
  happiness because people experience more *anticipation cycles*.
- The widely-quoted "97% happier with a trip booked" figure is from
  commercial travel-industry surveys, not peer-reviewed work. Do not put
  it in operator-facing copy; cite Nawijn/Gilovich instead.

Adjacent established effects we lean on:

- **Peak-end rule** (Kahneman): remembered experience is shaped by its
  peaks and its ending. A journey that ends silently is remembered
  flatter than one that ends with a marked close.
- **Savoring** (Bryant & Veroff): pleasure from a future event is
  amplified by deliberate, spaced attention — rehearsal, mental imagery,
  counting down.
- **Prospection** (Gilbert & Wilson): people enjoy simulating future
  events; concrete imagery is the fuel of that simulation.

**Strategic read:** the booking-to-departure window is where most of the
product's emotional value lives, and no booking platform touches it.
Ardum becomes an **anticipation engine**: Mira holds the intention,
feeds visualization, and paces savoring across the wait.

## The contract (what this is NOT)

Product vision is explicit: Ardum is not an urgency engine, not a
social-proof layer, not a notification pipeline. So the anticipation
layer is:

- **Calm and spaced** — beats revealed on return visits, not pushed.
  The page is the notification (same stance as the operator surface).
- **Opt-in imagery** — the vision frame uses the aesthetic vector the
  practitioner already chose to build; nothing new is asked.
- **Honest loops** — "Mira is holding this for you" is an open loop that
  is *actually true* while the hold/watch state is real. Loops close
  visibly when they expire. No manufactured scarcity, no fake countdowns.
- **No new data demands** — everything derives from what the episode
  already holds. (A real retreat start date would sharpen the countdown
  later; the attestation schema currently has `durationDays` only.)

## Build

### 1. Countdown-driven presence — `src/agent/preparation-presence.ts`

Pure projection, mirrors `mira-presence.ts` / `operator-presence.ts`:
time since booking (against the 5-day plan arc) → orb posture.

| Days since booking | Posture | Read |
|---|---|---|
| 0 | `arriving` | just booked — the radiating moment |
| 1–2 | `holding` | the intention is held; settle into it |
| 3 | `gathering` | mid-arc; excitement builds |
| 4+ | `resolving` | approaching; the plan completes |

Same ring grammar the practitioner learned during matching
(`radiating` → `sealed` → `open` → `open`). The orb tells them where
they are in the wait without a single number.

### 2. Savoring beats — progressive preparation plan

The `BookedLanding` preparation plan currently renders all 5 days at
once. Rework: **days reveal as they become current** (day N + a peek at
day N+1), keyed to days since booking. Each return visit shows one new
beat — a small deliberate moment of attention (savoring), not a wall of
instructions. Past days collapse to their titles; the current day
expands; future days stay closed ("Mira will bring this when it's
time"). Anticipation voice lines in `mira-voice.ts` narrate the arc.

### 3. Visualization deepens — the vision frame on the booked landing

The aesthetic calibration already resolves a curated vision frame
matched to the practitioner's vector (`RetreatVision` +
`/api/aesthetics/vision`, cached by fingerprint). After booking, that
frame is promoted onto the `BookedLanding`: "a day at your retreat" —
the imagery of the place they're going to, in the palette they chose.
Prospection research: the simulation *is* the pleasure; we feed it.

### 4. The return ritual — peak-end close

Episodes support a `complete` command but nothing renders after it.
Add a quiet closing beat when the practitioner marks a journey
complete: Mira marks the return, one reflective line, graceful archive.
Peak-end: the remembered journey ends on a marked close, not silence.
Nawijn's frequency finding makes this the *ethical* re-engagement —
closing one loop well opens the next anticipation cycle. The returning
greeting on arrival already bridges to a new intention.

Deferred until a real return-flow exists: the full reflective ritual
(one question, answered at leisure, woven into future recognition like
`priorCheckIns`). The quiet close ships first.

## What this deliberately does not do

- No push notifications, streaks, or daily-reminder cadence.
- No fake urgency or scarcity — the hold system already provides *real*
  deadlines when they exist.
- No new schema fields, no new infrastructure, no new providers.
- No social mode — anticipation is private by construction.

## Measures (product-vision aligned)

- return visits to the booked landing during the wait (the page is the
  pull);
- time-in-app during the wait vs. before booking;
- completion rate of the preparation arc;
- next-intention rate after `complete` (the loop reopening itself).
