import { scoreAll } from "@/agent/score";
import type { PractitionerProfile } from "@/calibration/schema";
import { localEvidence } from "@/evidence/catalog";
import {
  RANKING_POLICY_VERSION,
  currentIntention,
  type Episode,
  type RecommendationSnapshot,
} from "./model";

export function recommendForEpisode(
  episode: Episode,
  now: Date,
): RecommendationSnapshot {
  const intention = currentIntention(episode);
  const { energy, budget, social } = intention.constraints;
  if (!energy || !budget || !social) {
    throw new Error("The intention needs energy, budget, and social context.");
  }

  const profile: PractitionerProfile = {
    energy,
    budget,
    social,
    notes: [intention.statement, intention.desiredShift]
      .filter(Boolean)
      .join(" — "),
    createdAt: intention.createdAt,
  };

  const ranked = scoreAll(
    profile,
    localEvidence("retreat"),
  ).sort(
    (left, right) =>
      right.result.score - left.result.score ||
      left.result.retreatRootHash.localeCompare(right.result.retreatRootHash),
  );
  const top = ranked[0]?.result;
  if (!top) throw new Error("No retreat evidence is available.");

  const uncertainties: string[] = [];
  if (!intention.constraints.horizon) {
    uncertainties.push("You have not set a firm travel window yet.");
  }
  if (!intention.constraints.partySize) {
    uncertainties.push("The final party size is still open.");
  }
  if (top.score < 0.75) {
    uncertainties.push("The fit is useful, but at least one constraint is a stretch.");
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
