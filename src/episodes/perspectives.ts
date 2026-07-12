import "server-only";

import {
  DEFAULT_PERSPECTIVE,
  MOVEMENT_LENS,
  RESTORATIVE_LENS,
  scoreWithPerspective,
} from "@/agent/score";
import type { MatchResult } from "@/matching/types";
import { localEvidence } from "@/evidence/catalog";
import {
  currentIntention,
  type Episode,
} from "./model";
import type { PractitionerProfile } from "@/calibration/schema";

// Three lenses — the same composite-weight overrides that score.ts
// registers. Exported here so the route handler and the Workbench can
// share the canonical labels.
export const PERSPECTIVES = [
  DEFAULT_PERSPECTIVE,
  RESTORATIVE_LENS,
  MOVEMENT_LENS,
] as const;

export type PerspectiveName =
  | "balanced"
  | "restorative"
  | "movement";

export function perspectiveToName(
  perspective: (typeof PERSPECTIVES)[number],
): PerspectiveName {
  if (perspective.name === "Restorative") return "restorative";
  if (perspective.name === "Movement") return "movement";
  return "balanced";
}

export type PerspectivesResult = Record<
  PerspectiveName,
  MatchResult | null
>;

export function scoreEpisodePerspectives(
  episode: Episode,
): PerspectivesResult {
  const intention = currentIntention(episode);
  const { energy, budget, social } = intention.constraints;
  if (!energy || !budget || !social) {
    // Without every primary constraint the ranking policy cannot
    // meaningfully re-rank. Return nulls rather than throwing — the
    // caller decides how to surface "not yet ready."
    return { balanced: null, restorative: null, movement: null };
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
  const pool = localEvidence("retreat");

  const rank = (perspective: (typeof PERSPECTIVES)[number]) => {
    const ranked = scoreWithPerspective(profile, pool, perspective).sort(
      (left, right) =>
        right.result.score - left.result.score ||
        left.result.retreatRootHash.localeCompare(right.result.retreatRootHash),
    );
    return ranked[0]?.result ?? null;
  };

  return {
    balanced: rank(DEFAULT_PERSPECTIVE),      restorative: rank(RESTORATIVE_LENS),
      movement: rank(MOVEMENT_LENS),
  };
}
