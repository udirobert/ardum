// The intake is a conversation, not a quiz. Each step shows its "why" so the
// practitioner understands what is being inferred. Each option carries an
// `ack` — Mira's spoken acknowledgement when that answer is chosen — so the
// practitioner feels heard before the next question arrives.

import type { PractitionerProfile } from "./schema";

export type IntakeStep = {
  id: keyof Pick<PractitionerProfile, "energy" | "budget" | "social">;
  prompt: string;
  sub: string;
  why: string;
  mira: string; // Mira's opening line for this step
  options: { value: string; label: string; description?: string; ack: string }[];
};

export const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "energy",
    prompt: "How is your energy arriving?",
    sub: "Right now, this week — wherever is more honest.",
    why: `Matching on energy rather than category is what lets the agent
reason about the kind of practice that will actually meet you.`,
    mira: `Let's start with where you are. Not where you want to be — where you actually are, right now.`,
    options: [
      {
        value: "settled",
        label: "Settled",
        ack: "Settled. The kind of stillness that wants to stay still.",
      },
      {
        value: "in-movement",
        label: "In movement",
        ack: "In movement. We'll match the pace, not fight it.",
      },
      {
        value: "low",
        label: "Low",
        ack: "Low. The kind of low that needs ground, not more movement.",
      },
      {
        value: "sharp",
        label: "Sharp",
        ack: "Sharp. Let's aim that somewhere it can land.",
      },
    ],
  },
  {
    id: "budget",
    prompt: "What's the budget window for this retreat?",
    sub: "Per person, all-in. It's a guardrail, not a verdict.",
    why: `Budget narrows the field but doesn't rank it — a $1,200 week in
Sidemen can out-carry a $4,000 intensive in Tulum if the practice matches.`,
    mira: `Good. Now the practical side. This is a guardrail, not a verdict — I'll work with whatever you give me.`,
    options: [
      {
        value: "under-1k",
        label: "Under $1,000",
        ack: "Under a thousand. A real guardrail — I'll work within it, not around it.",
      },
      {
        value: "1k-2k",
        label: "$1,000 – $2,000",
        ack: "A thousand to two. That's where most of the honest work happens.",
      },
      {
        value: "2k-3k",
        label: "$2,000 – $3,000",
        ack: "Two to three thousand. Room to be selective.",
      },
      {
        value: "3k-plus",
        label: "$3,000+",
        ack: "Three thousand and up. I'll spend it where it matters, not where it shows.",
      },
    ],
  },
  {
    id: "social",
    prompt: "What does your social battery look like?",
    sub: "How much company do you want, in honest terms.",
    why: `Social comfort is the single biggest predictor of whether a retreat
feels nourishing or draining — and it's the one most filters get wrong.`,
    mira: `One more thing. This is the question most retreat platforms get wrong — how much company do you actually want?`,
    options: [
      {
        value: "solo",
        label: "Mostly alone",
        ack: "Mostly alone. I'll look for places that protect that.",
      },
      {
        value: "small-circle",
        label: "Small circle",
        ack: "A small circle. A few people, chosen well.",
      },
      {
        value: "open-circle",
        label: "Open circle",
        ack: "An open circle. You want company, but on your terms.",
      },
      {
        value: "communal",
        label: "Communal",
        ack: "Communal. You want to be in it, not beside it.",
      },
    ],
  },
];

// Mira's closing line after all three questions are answered — the bridge
// into the optional posture sample. Replaces the old "step 4 of 4" framing.
export const CLOSING_LINE =
  "I have what I need. This last step is optional — a five-second posture sample gives me a real baseline to reason from. Your camera frames never leave this browser tab.";
