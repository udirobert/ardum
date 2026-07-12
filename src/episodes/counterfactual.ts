// Counterfactual budget simulator.
//
// This is the first non-lens derived-view surface, joining the lens
// toggle under the broadened AGENTS.md source-of-truth rule from
// commit 2075a69:
//
//   "Derived ranking views (lens re-rankings and similar) never
//    mutate episode state."
//
// The server-side test at
// src/app/api/episodes/[id]/counterfactual-budget/route.test.ts pins
// that rule against THIS surface using the same revision-before /
// revision-after shape as the lens test (commit 3343142).
//
// This module ONLY reads. The helper synthesises a PractitionerProfile
// with the caller's BudgetBand override, runs the existing
// deterministic scorer against the localEvidence pool, and returns
// the resulting top pick. No call to the repository's save path is
// possible by design — the helper has no reference to it.
//
// Why re-score instead of filtering the pool by priceUsd <= ceiling:
// the matching agent's budget axis (see budgetVerdict in src/agent/score.ts)
// implements soft reasoning — a slight overshoot still scores 0.6,
// and restorative retreats in a slightly higher band sometimes win
// on composite because of stronger energy/social alignment. Filtering
// would erase that nuance and turn the counterfactual into a literal
// catalog filter.

import "server-only";

import { scoreAll } from "@/agent/score";
import { localEvidence } from "@/evidence/catalog";
import { currentIntention, type Episode } from "./model";
import type {
  BudgetBand,
  PractitionerProfile,
} from "@/calibration/schema";
import type { MatchResult } from "@/matching/types";

export type CounterfactualResult = {
  topRanked: MatchResult | null;
};

// Re-rank the verified pool under a hypothetical budget band. Returns
// just the resulting top pick — the route echoes the override band so
// the UI can frame the comparison, and the UI itself already holds
// the un-overridden recommendation.
export function scoreCounterfactualBudget(
  episode: Episode,
  band: BudgetBand,
): CounterfactualResult {
  const intention = currentIntention(episode);
  const { energy, social } = intention.constraints;
  if (!energy || !social) {
    // Without every primary constraint the ranking policy cannot
    // meaningfully score. Same null-fallback as the lens helper —
    // surfacing "not yet ready" is the caller's call.
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
  // through budgetVerdict via the profile's `budget` field, which
  // is what makes this a "what if your budget were X" simulator
  // rather than a lens on the existing budget.
  const ranked = scoreAll(profile, pool);
  return { topRanked: ranked[0]?.result ?? null };
}
