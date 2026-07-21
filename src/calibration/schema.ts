// Calibration intake schema — a short conversational intake, not a quiz.
// Each axis is a closed enum so reasoning is explainable.

export type EnergyState = "settled" | "in-movement" | "low" | "sharp";

export type BudgetBand = "under-1k" | "1k-2k" | "2k-3k" | "3k-plus";

export type SocialComfort =
  | "solo"
  | "small-circle"
  | "open-circle"
  | "communal";

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
