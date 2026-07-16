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
import { humanizeAgo } from "@/lib/time";

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

  lines.push(
    `I found a retreat that fits where you are right now.`,
    `${match.retreatTitle} in ${match.retreatLocation}.`,
    `I'm recommending this because ${arrival}, and ${socialLine}. This retreat specializes in ${match.practiceStyle.slice(0, 2).join(" and ")}.`,
    match.headline,
    `The deposit is $${match.priceUsd.toLocaleString()}. It's held in escrow on Arbitrum — the operator doesn't get it until you check in.`,
    `If you book, I'll build you a preparation plan based on what I've learned about you. Five minutes a day until you leave.`,
  );

  const cta = `Want me to hold your spot?`;

  return { lines, cta, recognitionLineCount };
}

// ── Booking grant ceremony ──────────────────────────────────────────
// Commitment is a scoped grant, not a multi-phase rail walkthrough
// (docs/decisions/0008-agentic-commitment.md). Mira states amount and
// bounds; rails run ambiently under securing status.

export function bookingDialogue(depositUsd: number, retreatTitle: string) {
  const amount = `$${depositUsd.toLocaleString()}`;
  return {
    ready: [
      `The pieces that matter now agree. I can secure your place on ${retreatTitle}.`,
      `Deposit ${amount}. Held until you arrive. I will not spend more without asking.`,
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
      `I've started your preparation plan. It's based on what I've learned about your energy, your practice, and what this retreat offers.`,
      `Five minutes a day. Start tonight.`,
    ],
    /** Closes the worry loop after commitment (product-vision measures). */
    watchNext: [
      `I'll keep watching your place until you arrive — the deposit stays held, the check-in window stays open, and I'll surface anything that would change the plan.`,
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
  const amount = `$${classPriceUsd.toLocaleString()}`;
  const opener: Record<string, string> = {
    low: `Can't commit to the full retreat? I understand. Your energy is low right now.`,
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
