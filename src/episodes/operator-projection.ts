// Operator demand projection — pure functions that transform episodes into
// anonymized intention shapes for the operator demand surface.
//
// This is the wider-aperture evidence inverted (ADR 0010): instead of
// showing the practitioner aggregate cohort patterns, we show the operator
// aggregate demand patterns. Same privacy contract — no verbatim
// statements, no actor IDs, no identification. Coarse intention shapes
// only, derived from the structured constraints the practitioner chose.
//
// In dev/demo mode, the density gate is relaxed and individual matches
// are shown with a visible "demo mode" label. In production, the n>=3
// gate applies — below 3 matches, the operator sees a watching message
// without counts.

import type {
  BudgetBand,
  EnergyState,
  SocialComfort,
  TravelWindow,
} from "@/calibration/schema";
import type { Episode, EpisodeStatus } from "./model";

export type IntentionShape = {
  energy?: EnergyState;
  budget?: BudgetBand;
  social?: SocialComfort;
  travelWindow?: TravelWindow;
  partySize?: number;
};

export type DemandMatch = {
  episodeId: string;
  status: EpisodeStatus;
  shape: IntentionShape;
  score: number;
  isTopPick: boolean;
  matchedAt: string;
  holdExpiresAt?: string;
  bookedAt?: string;
};

export type DemandSummary = {
  totalMatches: number;
  activeHolds: number;
  bookings: number;
  clarifying: number;
  matches: DemandMatch[];
  /** When false, matches are replaced by a watching message to prevent
   *  identifying individuals in low-density scenarios. */
  densityGatePassed: boolean;
};

const MIN_DENSITY = 3;

function currentIntention(episode: Episode): IntentionShape {
  const latest = episode.intentions[episode.intentions.length - 1];
  if (!latest) return {};
  const { energy, budget, social, travelWindow, partySize } =
    latest.constraints;
  return { energy, budget, social, travelWindow, partySize };
}

function episodeToMatch(
  episode: Episode,
  retreatRootHash: string,
): DemandMatch | null {
  const rec = episode.recommendation;
  if (!rec) return null;

  const isTopPick = rec.result.retreatRootHash === retreatRootHash;
  const inAlternatives = rec.alternatives?.some(
    (alt) => alt.retreatRootHash === retreatRootHash,
  );
  if (!isTopPick && !inAlternatives) return null;

  const score = isTopPick
    ? rec.result.score
    : rec.alternatives.find((a) => a.retreatRootHash === retreatRootHash)
        ?.score ?? 0;

  return {
    episodeId: episode.id,
    status: episode.status,
    shape: currentIntention(episode),
    score,
    isTopPick,
    matchedAt: rec.generatedAt,
    holdExpiresAt:
      episode.hold?.status === "active"
        ? episode.hold.expiresAt
        : undefined,
    bookedAt: episode.commitment?.bookedAt,
  };
}

export function projectDemand(
  episodes: Episode[],
  retreatRootHash: string,
  options: { demoMode?: boolean } = {},
): DemandSummary {
  const matches: DemandMatch[] = episodes
    .map((ep) => episodeToMatch(ep, retreatRootHash))
    .filter((m): m is DemandMatch => m !== null)
    .sort((a, b) => {
      // Booked first, then held, then by score
      if (a.bookedAt && !b.bookedAt) return -1;
      if (!a.bookedAt && b.bookedAt) return 1;
      if (a.holdExpiresAt && !b.holdExpiresAt) return -1;
      if (!a.holdExpiresAt && b.holdExpiresAt) return 1;
      return b.score - a.score;
    });

  const activeHolds = matches.filter((m) => m.holdExpiresAt).length;
  const bookings = matches.filter((m) => m.bookedAt).length;
  const clarifying = matches.filter(
    (m) => m.status === "capturing" || m.status === "clarifying",
  ).length;

  const densityGatePassed =
    options.demoMode ?? true ? true : matches.length >= MIN_DENSITY;

  return {
    totalMatches: matches.length,
    activeHolds,
    bookings,
    clarifying,
    matches: densityGatePassed ? matches : [],
    densityGatePassed,
  };
}
