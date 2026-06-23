// The intake is a conversation, not a quiz. Each step shows its "why" so the
// practitioner understands what is being inferred.

import type { PractitionerProfile } from "./schema";

export type IntakeStep = {
  id: keyof Pick<PractitionerProfile, "energy" | "budget" | "social">;
  prompt: string;
  sub: string;
  why: string;
  options: { value: string; label: string; description?: string }[];
};

export const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "energy",
    prompt: "How is your energy arriving?",
    sub: "Right now, this week — wherever is more honest.",
    why: `Matching on energy rather than category is what lets the agent
reason about the kind of practice that will actually meet you.`,
    options: [
      { value: "settled", label: "Settled" },
      { value: "in-movement", label: "In movement" },
      { value: "low", label: "Low" },
      { value: "sharp", label: "Sharp" },
    ],
  },
  {
    id: "budget",
    prompt: "What's the budget window for this retreat?",
    sub: "Per person, all-in. It's a guardrail, not a verdict.",
    why: `Budget narrows the field but doesn't rank it — a $1,200 week in
Sidemen can out-carry a $4,000 intensive in Tulum if the practice matches.`,
    options: [
      { value: "under-1k", label: "Under $1,000" },
      { value: "1k-2k", label: "$1,000 – $2,000" },
      { value: "2k-3k", label: "$2,000 – $3,000" },
      { value: "3k-plus", label: "$3,000+" },
    ],
  },
  {
    id: "social",
    prompt: "What does your social battery look like?",
    sub: "How much company do you want, in honest terms.",
    why: `Social comfort is the single biggest predictor of whether a retreat
feels nourishing or draining — and it's the one most filters get wrong.`,
    options: [
      { value: "solo", label: "Mostly alone" },
      { value: "small-circle", label: "Small circle" },
      { value: "open-circle", label: "Open circle" },
      { value: "communal", label: "Communal" },
    ],
  },
];
