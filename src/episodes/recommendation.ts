import { scoreAll } from "@/agent/score";
import { BUDGET_BANDS, type BudgetBand } from "@/calibration/schema";
import { formatUsd } from "@/lib/format";
import type { PractitionerProfile } from "@/calibration/schema";
import { localEvidence } from "@/evidence/catalog";
import {
  RANKING_POLICY_VERSION,
  currentIntention,
  type Episode,
  type RecommendationSnapshot,
} from "./model";

// ADR 0011 §4: cross-episode preferences from the actor profile. Optional —
// absent when the practitioner hasn't set any. The ranking policy treats
// these as soft tie-breakers (weight 0.10), never hard constraints.
type Preferences = PractitionerProfile["preferences"];

export function recommendForEpisode(
  episode: Episode,
  now: Date,
  preferences?: Preferences,
  excludedRootHashes?: string[],
): RecommendationSnapshot {
  const intention = currentIntention(episode);
  const { energy, budget, social, partySize, travelWindow } = intention.constraints;
  if (!energy || !budget || !social) {
    throw new Error("The intention needs energy, budget, and social context.");
  }

  const profile: PractitionerProfile = {
    energy,
    budget,
    social,
    partySize,
    travelWindow,
    notes: [intention.statement, intention.desiredShift]
      .filter(Boolean)
      .join(" — "),
    createdAt: intention.createdAt,
    preferences: preferences && (preferences.accommodation || preferences.dietary || preferences.practiceStyle)
      ? preferences
      : undefined,
  };

  const excluded = new Set(excludedRootHashes ?? []);
  const ranked = scoreAll(
    profile,
    localEvidence("retreat"),
  )
    .filter((entry) => !excluded.has(entry.result.retreatRootHash))
    .sort(
      (left, right) =>
        right.result.score - left.result.score ||
        left.result.retreatRootHash.localeCompare(right.result.retreatRootHash),
    );
  const top = ranked[0]?.result;
  if (!top) throw new Error("No retreat evidence is available after exclusions.");

  // Only the actionable weak-fit signal. partySize and travelWindow are now
  // collected during clarify and fed into the ranking as real axes, so they
  // are no longer standing uncertainties on every pick.
  const uncertainties: string[] = [];
  const budgetCeiling: Record<BudgetBand, number> = {
    "under-1k": 1000,
    "1k-2k": 2000,
    "2k-3k": 3000,
    "3k-plus": Infinity,
  };
  const ceiling = budgetCeiling[budget];
  if (Number.isFinite(ceiling) && top.priceUsd > ceiling) {
    const bandLabel =
      BUDGET_BANDS.find((b) => b.value === budget)?.label ?? budget;
    uncertainties.push(
      `Your limit is ${bandLabel}; this option is ${formatUsd(top.priceUsd)}. Continue only if that stretch is alright.`,
    );
  } else if (top.score < 0.75) {
    uncertainties.push(
      "The fit is useful, but at least one constraint is a stretch.",
    );
  }

  return {
    intentionVersion: intention.version,
    rankingPolicyVersion: RANKING_POLICY_VERSION,
    result: top,
    alternatives: ranked.slice(1, 3).map((entry) => entry.result),
    uncertainties,
    generatedAt: now.toISOString(),
  };
}
