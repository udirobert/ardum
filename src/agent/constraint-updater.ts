/**
 * Constraint Updater - Track A, Phase A2
 * 
 * Merges extracted constraints from natural language into existing episode
 * constraints. Maps to the IntentionConstraints type from the episode model.
 * 
 * This ensures constraints flow through the existing episode state machine
 * and maintain the same validation rules as the quiz-based intake.
 */

import type { EnergyState, BudgetBand, SocialComfort } from "@/calibration/schema";
import type { ExtractedConstraints } from "./conversation-extractor";

/**
 * IntentionConstraints from the episode model.
 * 
 * Note: The episode model defines this in src/episodes/model.ts, but we redefine
 * it here to avoid circular imports. The types must match exactly.
 */
export type IntentionConstraints = {
  energy?: EnergyState;
  budget?: BudgetBand;
  social?: SocialComfort;
  horizon?: string; // "YYYY-MM" prefix
  dates?: string; // "YYYY-MM" prefix (alias for horizon)
  duration?: number; // max days
  partySize?: number;
};

/**
 * Merge extracted constraints into existing constraints.
 * 
 * Rules:
 * - Extracted constraints override existing ones (user is being specific)
 * - Only override if extracted constraint is defined
 * - Return new object (immutable update)
 * - Validate extracted values before applying
 */
export function mergeConstraints(
  existing: IntentionConstraints,
  extracted: ExtractedConstraints
): IntentionConstraints {
  const updated = { ...existing };

  // Energy
  if (extracted.energy && isValidEnergyState(extracted.energy)) {
    updated.energy = extracted.energy;
  }

  // Budget
  if (extracted.budget && isValidBudgetBand(extracted.budget)) {
    updated.budget = extracted.budget;
  }

  // Social
  if (extracted.social && isValidSocialComfort(extracted.social)) {
    updated.social = extracted.social;
  }

  // Duration
  if (extracted.duration && extracted.duration > 0) {
    updated.duration = extracted.duration;
  }

  // Dates/Horizon
  if (extracted.dates && isValidDateString(extracted.dates)) {
    updated.horizon = extracted.dates;
    updated.dates = extracted.dates;
  }

  return updated;
}

/**
 * Validate EnergyState values.
 */
function isValidEnergyState(value: string): value is EnergyState {
  return ["settled", "in-movement", "low", "sharp"].includes(value);
}

/**
 * Validate BudgetBand values.
 */
function isValidBudgetBand(value: string): value is BudgetBand {
  return ["under-1k", "1k-2k", "2k-3k", "3k-plus"].includes(value);
}

/**
 * Validate SocialComfort values.
 */
function isValidSocialComfort(value: string): value is SocialComfort {
  return ["solo", "small-circle", "open-circle", "communal"].includes(value);
}

/**
 * Validate date string format (YYYY-MM).
 */
function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

/**
 * Check if constraints have changed.
 * Used to determine if we need to re-rank retreats.
 */
export function constraintsChanged(
  oldConstraints: IntentionConstraints,
  newConstraints: IntentionConstraints
): boolean {
  return JSON.stringify(oldConstraints) !== JSON.stringify(newConstraints);
}

/**
 * Generate a human-readable summary of what constraints were applied.
 * Used for logging and debugging.
 */
export function describeConstraintsApplied(
  extracted: ExtractedConstraints
): string {
  const parts: string[] = [];

  if (extracted.budget) parts.push(`budget: ${extracted.budget}`);
  if (extracted.duration) parts.push(`duration: ≤${extracted.duration} days`);
  if (extracted.social) parts.push(`social: ${extracted.social}`);
  if (extracted.dates) parts.push(`dates: ${extracted.dates}`);
  if (extracted.energy) parts.push(`energy: ${extracted.energy}`);

  return parts.length > 0 ? parts.join(", ") : "no constraints extracted";
}
