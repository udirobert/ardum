// Calibration intake schema — a short conversational intake, not a quiz.
// Each axis is a closed enum so reasoning is explainable.

export type EnergyState = "settled" | "in-movement" | "low" | "sharp";

export type BudgetBand = "under-1k" | "1k-2k" | "2k-3k" | "3k-plus";

export type SocialComfort =
  | "solo"
  | "small-circle"
  | "open-circle"
  | "communal";

// How long the practitioner wants to be away. Scored against each retreat's
// `durationDays`, so "travel window" is a real ranking signal, not a standing
// uncertainty. A free-text date ("September") cannot be scored — the
// attestations carry no availability calendar — so the window is modelled as
// a duration band, which is the scoreable dimension the data actually has.
export type TravelWindow = "weekend" | "one-week" | "extended";

// Ideal day-range per window. A retreat inside the band scores 1.0; outside,
// the score decays with distance from the nearest bound.
export const TRAVEL_WINDOW_DAYS: Record<TravelWindow, [number, number]> = {
  weekend: [2, 4],
  "one-week": [5, 8],
  extended: [9, 21],
};

export const TRAVEL_WINDOWS: {
  value: TravelWindow;
  label: string;
  why: string;
}[] = [
  {
    value: "weekend",
    label: "A long weekend",
    why: "2–4 days — a short reset without a long absence.",
  },
  {
    value: "one-week",
    label: "About a week",
    why: "5–8 days — enough to settle in and let the practice land.",
  },
  {
    value: "extended",
    label: "An extended stay",
    why: "9+ days — a deep immersion or training container.",
  },
];

// Party-size options carry a representative head-count so the ClarifyPanel
// (which maps over {value,label,why}) can collect a number directly. The
// ranking policy compares this against each retreat's cohort `capacity`.
export const PARTY_SIZE_OPTIONS: {
  value: number;
  label: string;
  why: string;
}[] = [
  { value: 1, label: "Just me", why: "A solo container — space to be with yourself." },
  { value: 2, label: "Two of us", why: "You and one other person." },
  { value: 4, label: "A small group", why: "Around 3–5 people travelling together." },
  { value: 8, label: "A larger circle", why: "Roughly 6+ — a group that needs a bigger cohort." },
];

export type PoseBaseline = {
  // Simplified joint-mobility profile derived from a short MediaPipe sample.
  // Kept coarse on purpose — these are signals, not diagnoses.
  shoulderMobility: "tight" | "open" | "very-open";
  hipMobility: "tight" | "open" | "very-open";
  breathPhase: "shallow" | "even" | "extended";
  confidence: number; // 0..1 — pose detector's average confidence
};

export type PractitionerProfile = {
  energy: EnergyState;
  budget: BudgetBand;
  social: SocialComfort;
  pose?: PoseBaseline;
  notes?: string;
  createdAt: string;
  // Optional travel window — the duration band the practitioner wants to be
  // away. Scored against each retreat's `durationDays` by the ranking policy.
  travelWindow?: TravelWindow;
  // Optional party size — how many people are travelling. Scored against
  // each retreat's cohort `capacity` by the ranking policy.
  partySize?: number;
  // Cross-episode preferences from the actor profile (ADR 0011 §4).
  // Optional — absent when the practitioner hasn't set any. The ranking
  // policy treats these as soft tie-breakers, not hard constraints.
  preferences?: {
    accommodation?: string;
    dietary?: string;
    practiceStyle?: string;
  };
};

export const ENERGY_STATES: { value: EnergyState; label: string; why: string }[] = [
  {
    value: "settled",
    label: "Settled",
    why: "A grounded, even state — practice can deepen into subtlety.",
  },
  {
    value: "in-movement",
    label: "In movement",
    why: "Something is shifting — movement is the entry point.",
  },
  {
    value: "low",
    label: "Low",
    why: "Energy is scarce — restoration and slowness serve.",
  },
  {
    value: "sharp",
    label: "Sharp",
    why: "Bright and ready — heat-building practice can carry it.",
  },
];

export const BUDGET_BANDS: { value: BudgetBand; label: string; why: string }[] = [
  {
    value: "under-1k",
    label: "Under $1,000",
    why: "Shorter, locally-run retreats dominate this band.",
  },
  {
    value: "1k-2k",
    label: "$1,000 – $2,000",
    why: "Most week-long silent and yin retreats sit here.",
  },
  {
    value: "2k-3k",
    label: "$2,000 – $3,000",
    why: "All-inclusive intensives and teacher trainings begin here.",
  },
  {
    value: "3k-plus",
    label: "$3,000+",
    why: "Premium destinations, longer durations, 1:1 attention.",
  },
];

export const SOCIAL_COMFORT: {
  value: SocialComfort;
  label: string;
  why: string;
}[] = [
  {
    value: "solo",
    label: "Mostly alone",
    why: "Practices that hold space for solitude — small groups, solo rooms.",
  },
  {
    value: "small-circle",
    label: "Small circle",
    why: "Cohorts of 6–12, intimate and unhurried.",
  },
  {
    value: "open-circle",
    label: "Open circle",
    why: "Mid-size cohorts where you know some, meet many.",
  },
  {
    value: "communal",
    label: "Communal",
    why: "Larger gatherings, shared meals, group ritual.",
  },
];
