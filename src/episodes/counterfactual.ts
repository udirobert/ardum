// Counterfactual simulators.
//
// These are non-lens derived-view surfaces, joining the lens toggle
// under the broadened AGENTS.md source-of-truth rule from commit
// 2075a69:
//
//   "Derived ranking views (lens re-rankings and similar) never
//    mutate episode state."
//
// The server-side tests at
//   - src/app/api/episodes/[id]/counterfactual-budget/route.test.ts
//   - src/app/api/episodes/[id]/counterfactual-energy/route.test.ts
// pin the rule against each surface using the same
// revision-before / revision-after shape from commit 3343142.
//
// This module ONLY reads. Each helper synthesises a
// PractitionerProfile with the caller's axis override, runs the
// existing deterministic scorer against the localEvidence pool,
// and returns the resulting top pick. No call to the repository's
// save path is possible by design — the helpers have no reference
// to it.
//
// Why re-score instead of filtering the pool by axis match: each
// axis implements soft reasoning in the AXES registry
// (e.g. budgetVerdict: a slight overshoot still scores 0.6;
// energy alignment reads every retreat's energyFit list).
// Filtering the pool would erase that nuance and turn the
// counterfactual into a literal catalog filter, not a confidence
// check.

import "server-only";

import { scoreAll } from "@/agent/score";
import { localEvidence } from "@/evidence/catalog";
import { currentIntention, type Episode } from "./model";
import type {
  BudgetBand,
  EnergyState,
  PractitionerProfile,
} from "@/calibration/schema";
import type { MatchResult } from "@/matching/types";

export type CounterfactualResult = {
  topRanked: MatchResult | null;
};

// Re-rank the verified pool under a hypothetical budget band.
// Returns just the resulting top pick — the route echoes the
// override band so the UI can frame the comparison, and the UI
// itself already holds the un-overridden recommendation.
export function scoreCounterfactualBudget(
  episode: Episode,
  band: BudgetBand,
): CounterfactualResult {
  const intention = currentIntention(episode);
  const { energy, social } = intention.constraints;
  if (!energy || !social) {
    // Without every primary constraint the ranking policy cannot
    // meaningfully score. Same null-fallback as the lens helper.
    return { topRanked: null };
  }

  const profile: PractitionerProfile = {
    energy,
    social,
    budget: band,
    notes: [intention.statement, intention.desiredShift]
      .filter(Boolean)
      .join(" \u2014 "),
    createdAt: intention.createdAt,
  };
  const pool = localEvidence("retreat");

  // Empty third arg means no composite-weight overrides \u2014 every
  // axis keeps its default weight from AXES. The override flows
  // through budgetVerdict via the profile's `budget` field.
  const ranked = scoreAll(profile, pool);
  return { topRanked: ranked[0]?.result ?? null };
}

// Re-rank the verified pool under a hypothetical energy state.
// Same shape as scoreCounterfactualBudget but the override flows
// through the energy axis's energyFit-list membership check rather
// than the budget ceiling. The energy axis is binary-ish in score
// (1.0 if the practitioner's stated energy lands inside the
// retreat's energyFit list, 0 otherwise), so a swap on this axis
// is more likely to flip the top pick than a budget swap.
export function scoreCounterfactualEnergy(
  episode: Episode,
  energy: EnergyState,
): CounterfactualResult {
  const intention = currentIntention(episode);
  const { budget, social } = intention.constraints;
  if (!budget || !social) {
    return { topRanked: null };
  }

  const profile: PractitionerProfile = {
    energy,
    social,
    budget,
    notes: [intention.statement, intention.desiredShift]
      .filter(Boolean)
      .join(" \u2014 "),
    createdAt: intention.createdAt,
  };
  const pool = localEvidence("retreat");

  const ranked = scoreAll(profile, pool);
  return { topRanked: ranked[0]?.result ?? null };
}
