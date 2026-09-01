// Mira's voice — the agent persona that guides users through Ardum.
//
// Not a chatbot. A guide who has been doing this for years.
// Warm, second-person, present tense. Never says "I am an AI."
// Talks like someone who knows retreats and knows people.
//
// These functions generate the narrative text that appears on the
// match detail page, in the booking flow, and in the preparation plan.

import type { MatchResult } from "@/matching/types";
import type { MemoryContext } from "@/memory/semantic-memory";
import type { Episode } from "@/episodes/model";
import { humanizeAgo } from "@/lib/time";
import { formatUsd } from "@/lib/format";

type PractitionerSignals = {
  energy?: string;
  budget?: string;
  social?: string;
};

// ── Match letter ────────────────────────────────────────────────────
// The match detail page opens with a letter from Mira, not a product
// listing. The reasoning is woven into the narrative.

export function matchLetter(
  match: MatchResult,
  signals: PractitionerSignals,
  memory?: MemoryContext,
): { lines: string[]; cta: string; recognitionLineCount: number } {
  const energy = signals.energy ?? "your energy";
  const social = signals.social ?? "your comfort";

  const energyPhrase: Record<string, string> = {
    low: "you're arriving depleted",
    settled: "you're arriving settled",
    "in-movement": "you're arriving in motion",
    sharp: "you're arriving sharp",
  };

  const socialPhrase: Record<string, string> = {
    solo: "you need space to yourself",
    "small-circle": "you want a small circle",
    "open-circle": "you're open to a larger group",
    communal: "you're seeking community",
  };

  const arrival = energyPhrase[signals.energy ?? ""] ?? `your energy is ${energy}`;
  const socialLine = socialPhrase[signals.social ?? ""] ?? `your social comfort leans ${social}`;

  const lines: string[] = [];
  let recognitionLineCount = 0;

  // If Mira has memory of this practitioner, open with a recognition line
  // instead of a cold start. This is the "AI that doesn't forget" moment.
  //
  // Recognition is operational: per AGENTS.md ("operational truth belongs
  // to the episode repository"), it gates on `isReturning`, which is
  // derived from the episode list by src/memory/projector.ts and is true
  // whenever the practitioner has ever surfaced a recommendation or
  // recorded a booking. The provider check stays where pastNotes /
  // priorCheckIns are woven (semantic-memory fields are by definition
  // lossy supplementary, and empty in projector-only mode).
  if (memory?.isReturning) {
    const lastEnergy = memory.energyHistory[memory.energyHistory.length - 1];
    const energyShifted =
      lastEnergy && lastEnergy !== signals.energy
        ? ` Last time you were ${lastEnergy} — I can see that's shifted.`
        : "";
    const lastMatch = memory.pastMatches[0];
    const lastBooking = memory.pastBookings[0];

    if (lastBooking) {
      lines.push(
        `Welcome back. You've been to ${lastBooking.title} in ${lastBooking.location}.${energyShifted}`,
      );
    } else if (lastMatch) {
      lines.push(
        `Welcome back. Last time I recommended ${lastMatch.title} in ${lastMatch.location}.${energyShifted}`,
      );
    } else {
      lines.push(`Welcome back. I remember you.${energyShifted}`);
    }
    recognitionLineCount++;

    // Prior MiraCheckIns take precedence over legacy pastNotes — they
    // are the freshest, most specific thing Mira has on this person.
    const hasPriorCheckIn = !!memory.priorCheckIns?.[0];
    if (memory.pastNotes.length > 0 && !hasPriorCheckIn) {
      lines.push(`You mentioned: "${memory.pastNotes[0]}". I've kept that with me.`);
      recognitionLineCount++;
    }

    // Prior MiraCheckIn answers — the post-booking loop. We weave the
    // most-recently-answered response so the recognition line names
    // something specific the practitioner actually said, anchored to
    // the date they said it. Day-5 answers ("Work stress", "A
    // relationship", "I feel ready") are the most narratable; earlier
    // days read as energy/temperament. Different copy for each band so
    // the letter doesn't sound templated. The temporal phrase sits
    // between "Last time" and the spoken answer — "Last time, three
    // days ago, you told me…" — so the compounding loop has both
    // content and timing as proof.
    const latestCheckIn = memory.priorCheckIns?.[0];
    if (latestCheckIn) {
      const ago = humanizeAgo(latestCheckIn.answeredAt);
      // Fall back to a temporal-less "Last time" if the timestamp
      // couldn't be parsed — don't drop the recognition entirely.
      const temporal =
        ago === null ? "Last time" : `Last time, ${ago},`;
      if (latestCheckIn.day >= 4) {
        const a = latestCheckIn.answer.toLowerCase();
        lines.push(
          `${temporal} you told me you were ready to let go of ${a} — let's see if that's shifted.`,
        );
      } else if (latestCheckIn.day === 3) {
        lines.push(
          `${temporal} your energy was "${latestCheckIn.answer.toLowerCase()}". I'll hold that as we reason about this one.`,
        );
      } else {
        lines.push(
          `${temporal} you said you felt "${latestCheckIn.answer.toLowerCase()}". I remember.`,
        );
      }
      recognitionLineCount++;
    }
  }

  // The "what" (title, location, price, cohort) lives on the recommendation
  // card directly below the voice block — don't repeat it here. The letter
  // carries only the "why": the arrival read, the social fit, the headline.
  // The deposit and preparation-plan lines belong to the hold and booking
  // steps respectively, not the review, so they stay out of the letter.
  lines.push(
    `I found a retreat that fits where you're heading.`,
    `I'm recommending this because ${arrival}, and ${socialLine}. This retreat specializes in ${match.practiceStyle.slice(0, 2).join(" and ")}.`,
    match.headline,
  );

  const cta = `Let's hold your spot.`;

  return { lines, cta, recognitionLineCount };
}

// ── Booking grant ceremony ──────────────────────────────────────────
// Commitment is a scoped grant, not a multi-phase rail walkthrough
// (docs/decisions/0008-agentic-commitment.md). Mira states amount and
// bounds; rails run ambiently under securing status.

export function bookingDialogue(depositUsd: number, retreatTitle: string) {
  const amount = formatUsd(depositUsd);
  return {
    ready: [
      `The pieces that matter now agree. I can secure your place on ${retreatTitle}.`,
      `Deposit ${amount}. Held until you arrive — I won't spend more without asking.`,
    ],
    /** Returning payer with a restored session — skip identity theater. */
    readyReturning: [
      `Welcome back. I can secure your place on ${retreatTitle}.`,
      `Deposit ${amount}. Held until you arrive. Confirm when you're ready — I already have what I need from you.`,
    ],
    needIdentity: [
      `I'll secure your place on ${retreatTitle}.`,
      `Continue with Google — I'll handle the rest. You won't manage wallets or chains.`,
    ],
    restoring: ["One moment — I'm finding your place…"],
    securing: ["Securing your place…"],
    done: [
      `You're booked.`,
      `I've built your preparation plan from what I've learned about your energy, your practice, and what this retreat offers.`,
      `Five minutes a day. Start tonight.`,
    ],
    /** Closes the worry loop after commitment (product-vision measures). */
    watchNext: [
      `I'll watch your place until you arrive — the deposit stays held, the check-in window stays open, and I'll surface anything that would change the plan.`,
    ],
  };
}

// ── Drop-in class invitation ────────────────────────────────────────
// Low-stakes grant, same contract as full commitment: human confirms
// amount and bounds; Mira handles payment rails ambiently
// (docs/decisions/0008-agentic-commitment.md).

export function classInvitation(
  retreatTitle: string,
  classPriceUsd: number,
  signals: PractitionerSignals,
) {
  const amount = formatUsd(classPriceUsd);
  const opener: Record<string, string> = {
    low: `Can't commit to the full retreat? That's okay — your energy is low right now.`,
    settled: `Not ready for the full retreat? That's fine.`,
    "in-movement": `Want to try before you commit? Good instinct.`,
    sharp: `Not sure about the full retreat? Let's start small.`,
  };

  const line = opener[signals.energy ?? ""] ?? `Can't commit to the full retreat?`;

  return {
    lines: [
      line,
      `Tomorrow's 6am practice at ${retreatTitle} is open. ${amount} — one session, no longer commitment.`,
      `If it resonates, the full retreat will still be here.`,
    ],
    needIdentity: [
      `Tomorrow's practice at ${retreatTitle} is open.`,
      `Continue with Google — I'll handle the rest. One session, nothing more.`,
    ],
    securing: ["Joining you to tomorrow's class…"],
    done: [
      `You're in. Tomorrow's practice starts at 6am.`,
      `I'll send a reminder 30 minutes before. No prep needed — just arrive as you are.`,
    ],
    cta: `Join tomorrow's class · ${amount}`,
    confirmLabel: `Confirm ${amount} for tomorrow's class`,
  };
}

// ── Preparation plan ────────────────────────────────────────────────
// After booking, Mira generates a personalized pre-retreat plan.
// Based on the same signals that drove the match.

export function preparationPlan(
  match: MatchResult,
  signals: PractitionerSignals,
  memory?: MemoryContext,
): { title: string; days: { day: number; title: string; description: string; duration: string }[] } {
  const energy = signals.energy ?? "settled";

  const plans: Record<string, { day: number; title: string; description: string; duration: string }[]> = {
    low: [
      { day: 1, title: "Arrive where you are", description: "Five minutes of seated breathing. Don't try to change anything. Just notice the rhythm you're in.", duration: "5 min" },
      { day: 2, title: "Lengthen the exhale", description: "Breathe in for 4, out for 6. This signals your nervous system to settle. Do this lying down.", duration: "5 min" },
      { day: 3, title: "Gentle movement", description: "Three rounds of cat-cow, slow. Let your breath lead the movement. No ambition here.", duration: "5 min" },
      { day: 4, title: "Write it down", description: "One sentence: what are you hoping to feel by the end of the retreat? Don't overthink it.", duration: "5 min" },
      { day: 5, title: "Rest", description: "No practice today. Just rest. The retreat starts when you arrive, not when you push.", duration: "0 min" },
    ],
    settled: [
      { day: 1, title: "Check your foundation", description: "Five minutes of mountain pose. Feel your feet. Let your breath find its natural depth.", duration: "5 min" },
      { day: 2, title: "Open the shoulders", description: "Three rounds of thread-the-needle. Your shoulders carry more than you think.", duration: "5 min" },
      { day: 3, title: "Find your edge", description: "Hold warrior II for five breaths longer than comfortable. Notice what happens in your mind.", duration: "5 min" },
      { day: 4, title: "Journal prompt", description: "What pattern in your practice are you ready to release? Write for three minutes.", duration: "5 min" },
      { day: 5, title: "Integrate", description: "Five minutes of seated meditation. Let the week's practice settle into your body.", duration: "5 min" },
    ],
    "in-movement": [
      { day: 1, title: "Slow it down", description: "Five sun salutations at half speed. Let each breath be longer than the movement.", duration: "5 min" },
      { day: 2, title: "Ground through the feet", description: "Standing forward fold, knees bent. Let your weight sink. Stay for ten breaths.", duration: "5 min" },
      { day: 3, title: "Hip openers", description: "Pigeon pose, both sides. This is where you store momentum. Let it release.", duration: "5 min" },
      { day: 4, title: "Write it down", description: "What are you running toward? What are you running from? One sentence each.", duration: "5 min" },
      { day: 5, title: "Pause", description: "No movement today. Five minutes of seated breathing. Let stillness be the practice.", duration: "5 min" },
    ],
    sharp: [
      { day: 1, title: "Drop the edge", description: "Five minutes of alternate-nostril breathing. This balances the nervous system. Do it seated.", duration: "5 min" },
      { day: 2, title: "Long exhales", description: "Breathe in for 4, out for 8. If you can't do 8, do 6. The point is the ratio, not the count.", duration: "5 min" },
      { day: 3, title: "Restorative poses", description: "Legs-up-the-wall for five minutes. This is the most underused pose in yoga.", duration: "5 min" },
      { day: 4, title: "Journal prompt", description: "What would it feel like to not push for a week? Write for three minutes.", duration: "5 min" },
      { day: 5, title: "Soften", description: "Five minutes of savasana. Let your body tell you what it needs. Don't instruct.", duration: "5 min" },
    ],
  };

  const days = plans[energy] ?? plans.settled;

  // If Mira has memory of past practice, weave it into day 1's description.
  // This is the improve() payoff — the preparation plan gets sharper the
  // more the practitioner uses Ardum. pastNotes are supplied by semantic
  // memory (Cognee) — they are LOSSY by AGENTS.md, so the weave stays
  // gated on provider !== "none" rather than on isReturning alone.
  if (memory?.isReturning && memory.provider !== "none" && memory.pastNotes.length > 0) {
    days[0] = {
      ...days[0],
      description: `${days[0].description} You've told me before: "${memory.pastNotes[0]}". See if that's still true today.`,
    };
  }

  return {
    title: `Your 5-day preparation`,
    days,
  };
}

// ── Anticipation voice ─────────────────────────────────────────────
// Narrates the wait after booking (docs/plans/anticipation-layer.md).
// Anticipation research (Nawijn 2010; Kumar/Gilovich 2014) finds the
// booking-to-departure window carries much of the joy of an experience;
// Mira paces it with one line per arc phase — calm, never pushing.
// `days` is whole days since booking against the 5-day preparation arc.

export function anticipationLine(days: number): string {
  if (days <= 0)
    return "You're booked. The retreat starts working on you now — let it.";
  if (days === 1)
    return "One day in. Nothing to do yet — carry the place with you.";
  if (days === 2)
    return "Two days in. Today's practice is small on purpose.";
  if (days === 3)
    return "Halfway. The looking-forward usually peaks here — let it.";
  if (days === 4)
    return "Nearly there. Finish the plan gently — arrival is close.";
  return "The plan is complete. Travel lightly.";
}

// ── Aesthetic calibration voice ─────────────────────────────────────
// Per-swipe voice lines that make the calibration feel like a
// conversation with Mira, not a calibration widget. The orb is the
// focus; these lines are Mira reacting to what the practitioner chooses.

/** Voice line before the first swipe — Mira introduces herself. */
export function calibrationIntro(): string {
  return "I'm Mira. Show me what you're drawn to — I'll use it to find what fits where you're heading.";
}

/** Voice line after each swipe, indexed by reaction count (0-based). */
export function calibrationReactionLine(
  reactionCount: number,
  qualities: string[],
): string {
  if (reactionCount <= 0) return "Got it.";
  if (reactionCount === 1) return "I'm finding your shape.";
  if (reactionCount === 2) return "One more — let's narrow it.";
  if (qualities.length > 0) {
    return `Here's what I'm seeing — ${qualities.join(", ")}. Let's find what fits.`;
  }
  return "Here's what I'm seeing. Let's find what fits.";
}

// ── Reasoning beat ──────────────────────────────────────────────────
// The "thinking" beat between the recommend command and the card.
// Surfaces Mira's actual reasoning — the constraint-to-retreat mapping,
// the specific attributes that drove each score, and what was considered
// and rejected — so the recommendation feels earned, not instant. Each
// line has a delay (ms from the start of the beat) controlling when it
// fades in.

export interface ReasoningStep {
  text: string;
  delayMs: number;
}

/**
 * Build the reasoning beat from the actual recommendation data.
 *
 * The beat surfaces, in order:
 * 1. An opening acknowledgment ("Let me sit with what you've told me.")
 * 2. The constraint-to-retreat mapping — what the practitioner asked for.
 * 3. The pool size being weighed.
 * 4. (If topPick provided) The top pick's strongest axes, citing the
 *    specific retreat attributes that drove each score.
 * 5. (If alternative provided) What was considered and rejected — the
 *    top alternative and why it scored lower.
 * 6. The conclusion ("One sits closest.")
 *
 * When called without a topPick (the initial `recommend` command, where
 * the new recommendation hasn't arrived yet), only steps 1-3 and 6 are
 * emitted — the full reasoning arrives with the card.
 */
export function reasoningBeat(
  topPick?: MatchResult,
  alternative?: MatchResult,
  constraints?: {
    energy?: string;
    budget?: string;
    social?: string;
    partySize?: number;
    travelWindow?: string;
  },
  poolSize?: number,
): ReasoningStep[] {
  const steps: ReasoningStep[] = [
    { text: "Let me work with what you've told me.", delayMs: 0 },
  ];

  // ── Constraint-to-retreat mapping ──
  const constraintParts: string[] = [];
  if (constraints?.energy) constraintParts.push(`${constraints.energy} energy`);
  if (constraints?.budget) constraintParts.push(`${constraints.budget} budget`);
  if (constraints?.social) constraintParts.push(`${constraints.social} comfort`);
  if (constraints?.partySize) {
    constraintParts.push(
      constraints.partySize === 1
        ? "a solo trip"
        : `a party of ${constraints.partySize}`,
    );
  }
  if (constraints?.travelWindow) {
    const windowPhrase: Record<string, string> = {
      weekend: "a long weekend",
      "one-week": "about a week",
      extended: "an extended stay",
    };
    constraintParts.push(
      windowPhrase[constraints.travelWindow] ?? constraints.travelWindow,
    );
  }
  if (constraintParts.length > 0) {
    steps.push({
      text: `You asked for ${constraintParts.join(", ")}.`,
      delayMs: 800,
    });
  }

  if (poolSize && poolSize > 0) {
    steps.push({
      text: `I'm weighing ${poolSize} ${poolSize === 1 ? "retreat" : "retreats"} against that.`,
      delayMs: 1600,
    });
  }

  // Without a top pick, we stop here — the full reasoning arrives with
  // the card. Emit the conclusion and return.
  if (!topPick) {
    steps.push({ text: "One sits closest.", delayMs: 2400 });
    return steps;
  }

  // ── Top pick's strongest axes ──
  // Surface the top 2 reasoning steps from the top pick. These cite
  // specific retreat attributes ("Practitioner energy: low. Retreat
  // fits: low, settled." → "Strong energy fit; pulls toward this match.")
  const topReasoning = topPick.reasoning
    .filter((r) => r.weight > 0) // skip display-only axes
    .slice(0, 2);

  for (let i = 0; i < topReasoning.length; i++) {
    const step = topReasoning[i];
    steps.push({
      text: `${step.then}`,
      delayMs: 2400 + i * 700,
    });
  }

  // ── Considered and rejected ──
  // Surface the top alternative and why it scored lower. We don't have
  // per-axis scores in the reasoning data (only weights), so we proxy
  // "where it lost ground" by surfacing the highest-weight axis — the
  // most important one, where a mismatch is most costly. For a
  // mismatched alternative, this is likely where it lost the most
  // ground (high weight × low per-axis score).
  if (alternative) {
    const altWeakest = alternative.reasoning
      .filter((r) => r.weight > 0)
      .sort((a, b) => b.weight - a.weight)[0];
    const scoreGap = Math.round((topPick.score - alternative.score) * 100);
    if (altWeakest && scoreGap > 0) {
      steps.push({
        text: `I also weighed ${alternative.retreatTitle} — ${altWeakest.then} It scored ${scoreGap} points lower.`,
        delayMs: 2400 + topReasoning.length * 700 + 800,
      });
    } else {
      steps.push({
        text: `I also weighed ${alternative.retreatTitle} — it was close, but ${topPick.retreatTitle} fit better overall.`,
        delayMs: 2400 + topReasoning.length * 700 + 800,
      });
    }
  }

  steps.push({ text: "One sits closest.", delayMs: 2400 + topReasoning.length * 700 + (alternative ? 1600 : 800) });
  return steps;
}

// ── Nudge ───────────────────────────────────────────────────────────
// When the practitioner presses and holds the orb, Mira offers one
// insight drawn from the current episode state. The nudge is a pure
// projection — no fetches, no LLM, no new state. It reads existing
// data (recommendation, monitor, hold, preparation) and returns zero
// or one nudge, prioritized by urgency and relevance.
//
// The function returns null when there's nothing worth saying — the
// companionable idle, not silence. The voice lines follow the same
// register as matchLetter and bookingDialogue: second-person, present
// tense, warm, never alarming.

export type NudgeKind =
  | "uncertainty"
  | "thin-trust"
  | "provisional-fit"
  | "price-drop"
  | "slot-opened"
  | "hold-expiring"
  | "preparation-ready"
  | "preparation-complete"
  | "reaching"
  | "idle";

export type Nudge = {
  kind: NudgeKind;
  text: string;
};

const HOLD_PRESSURE_MS = 12 * 60 * 60 * 1000;

export function nudgeForEpisode(
  episode: Episode,
  now: number = Date.now(),
): Nudge | null {
  const status = episode.status;

  // ── Pre-hold: recommendation surfaced but not yet held ──
  if (status === "recommendation-ready" || status === "ready") {
    const rec = episode.recommendation;
    if (rec) {
      const match = rec.result;

      // Uncertainties — Mira's honest gaps
      if (rec.uncertainties.length > 0) {
        const first = rec.uncertainties[0];
        return {
          kind: "uncertainty",
          text: `I'm not certain about ${first}. Here's what I'd watch.`,
        };
      }

      // Thin trust signal
      if (match.attestationCount <= 1) {
        return {
          kind: "thin-trust",
          text: `One practitioner has vouched for this retreat. That's thin — I'm watching for more.`,
        };
      }

      // Provisional fit — strong and weak axes
      if (match.score < 0.7 && match.reasoning.length > 0) {
        const weighted = match.reasoning.filter((r) => r.weight > 0);
        const strongest = [...weighted].sort((a, b) => b.weight - a.weight)[0];
        const weakest = [...weighted].sort((a, b) => a.weight - b.weight)[0];
        if (strongest && weakest && strongest.axis !== weakest.axis) {
          return {
            kind: "provisional-fit",
            text: `This is a provisional fit. ${strongest.then} But ${weakest.then}`,
          };
        }
      }
    }
  }

  // ── Post-hold: monitoring active ──
  if (status === "monitoring" || status === "held" || status === "ready-to-book") {
    const obs = episode.monitor?.observations.at(-1);
    const rec = episode.recommendation;

    if (obs) {
      // Price drop — current observed price is lower than the recommended
      // price. The practitioner should know their hold covers a better deal.
      if (rec && obs.priceUsd < rec.result.priceUsd) {
        return {
          kind: "price-drop",
          text: `The price dropped to ${formatUsd(obs.priceUsd)}. Your hold still covers it.`,
        };
      }

      // Slot opened — current observation shows availability when the
      // previous one did not. Compare against the prior observation so
      // we detect a genuine transition, not a steady available state.
      const prevObs = episode.monitor?.observations.at(-2);
      if (obs.available && prevObs && !prevObs.available) {
        return {
          kind: "slot-opened",
          text: `A spot opened up. It's yours if you want it.`,
        };
      }
    }

    // Hold expiring
    if (episode.hold?.status === "active") {
      const remaining = new Date(episode.hold.expiresAt).getTime() - now;
      if (remaining > 0 && remaining <= HOLD_PRESSURE_MS) {
        const hours = Math.max(1, Math.round(remaining / (60 * 60 * 1000)));
        return {
          kind: "hold-expiring",
          text: `Your hold expires in ${hours} ${hours === 1 ? "hour" : "hours"}. I can extend it or let it go.`,
        };
      }
    }
  }

  // ── Post-booking: preparation arc ──
  if (status === "booked" && episode.commitment?.status === "booked") {
    const days = daysSinceBookingSafe(episode.commitment.bookedAt, now);
    if (days >= 0 && days < 5) {
      return {
        kind: "preparation-ready",
        text: `Today's practice is ready when you are.`,
      };
    }
    if (days >= 5) {
      return {
        kind: "preparation-complete",
        text: `You're ready. Travel lightly.`,
      };
    }
  }

  // ── Pre-intention: the arrival surface ──
  // When there's no recommendation to discuss and no hold or booking arc
  // in progress, Mira bridges to the intention input. This is the first
  // nudge a new practitioner sees when they hold the orb on the arrival
  // screen — not the generic idle, but a warm reach that echoes the
  // page's own question.
  if (
    status === "capturing" ||
    status === "paused" ||
    status === "clarifying"
  ) {
    return {
      kind: "reaching",
      text: `I'm here. Tell me what you're trying to make space for.`,
    };
  }

  // ── Default: companionable idle ──
  // Not silence — Mira is here, present, with nothing urgent.
  return {
    kind: "idle",
    text: `I'm here. Nothing needs your attention right now.`,
  };
}

/**
 * True when the episode has a non-idle nudge ready. The `reaching` kind
 * (the arrival-surface bridge) is excluded — it's companionable, not
 * urgent, so it should not trigger the poke lean-in. Pure, no side effects.
 */
export function hasNudge(episode: Episode, now: number = Date.now()): boolean {
  const nudge = nudgeForEpisode(episode, now);
  return nudge !== null && nudge.kind !== "idle" && nudge.kind !== "reaching";
}

function daysSinceBookingSafe(bookedAt: string, now: number): number {
  const booked = new Date(bookedAt);
  if (Number.isNaN(booked.getTime())) return -1;
  const ms = now - booked.getTime();
  return Math.max(-1, Math.floor(ms / 86_400_000));
}

// ── Failure vocabulary ──────────────────────────────────────────────
// The moments trust is won or lost are the moments something goes
// wrong. Mira speaks through these the way she speaks everywhere else:
// advocate register, no blame, no jargon, one honest sentence. These
// are the canonical lines — surfaces must not improvise failure copy.
//
// Wiring points (keep in sync when new failure paths ship):
//   - noFitLine()          → ListeningSurface / alternatives-empty state
//   - providerFailureLine() → workbench error banners (RPC, commit provider)
//   - holdExpiredLine()    → nudgeForEpisode hold-expiring aftermath, detail payload
//   - memoryDeletedLine()  → /memory deletion confirmation

/** The pool held nothing that fits — the honest answer, not a stretch. */
export function noFitLine(): string {
  return "Nothing here fits you yet. That's not a flaw in what you asked for — the right place may not have published. I'll keep looking.";
}

/** Infrastructure failed. Calm, specific about what, zero jargon. */
export function providerFailureLine(what: string): string {
  return `${what} didn't go through just now. Nothing is lost — we can try again whenever you're ready.`;
}

/** The hold window closed while the practitioner was away. */
export function holdExpiredLine(): string {
  return "The hold I was keeping has ended. The place isn't gone — say the word and I'll start watching again, or hold it fresh.";
}

/** The practitioner deleted their memory on /memory. Boundary honored. */
export function memoryDeletedLine(): string {
  return "It's done — what I remembered is gone. We start fresh, and that's exactly as it should be.";
}
