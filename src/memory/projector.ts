// Episode → MemoryContext projector.
//
// AGENTS.md: "Operational truth belongs to the episode repository. Semantic
// memory can help Mira recognize patterns and language, but it is lossy
// context rather than a ledger." So recognition lives here, derived from
// episodes we already own. Cognee (src/memory/cognee.ts) is the optional
// supplementary layer; see src/memory/enrich.ts for how it adds pastNotes
// and raw recall atop this projector.
//
// This module is pure. No env reads, no async, no SDK imports. The route
// layer composes it with a SemanticMemory implementation when needed.
// The fire-and-forget observation hook that talks to Cognee lives in
// src/memory/observe.ts — keeping it here would drag the `import
// "server-only"` boundary into any importer of the pure projector.

import type { Episode } from "@/episodes/model";
import {
  EMPTY_MEMORY,
  type MemoryContext,
} from "./semantic-memory";

export function projectMemoryForActor(
  _actorId: string,
  episodes: Episode[],
): MemoryContext {
  if (episodes.length === 0) return EMPTY_MEMORY;

  // Episodes come newest-first from EpisodeRepository.listOwned (see
  // src/episodes/repositories/local.ts + supabase.ts). We collect in the
  // order we receive them so callers can rely on pastMatches[0] being the
  // most-recent recommendation and energyHistory[energyHistory.length-1]
  // being the most-recent energy state — that's what matchLetter() reads.
  //
  // The single pass keeps allocations bounded and avoids sorting; the
  // episode list is already ordered by the repository.
  const pastMatches: MemoryContext["pastMatches"] = [];
  const pastBookings: MemoryContext["pastBookings"] = [];
  const energyHistory: MemoryContext["energyHistory"] = [];

  for (const episode of episodes) {
    const result = episode.recommendation?.result;
    if (result) {
      pastMatches.push({
        title: result.retreatTitle,
        location: result.retreatLocation,
        score: result.score,
      });
    }
    if (episode.commitment?.status === "booked" && result) {
      pastBookings.push({
        title: result.retreatTitle,
        location: result.retreatLocation,
      });
    }
    for (const intention of episode.intentions) {
      const energy = intention.constraints.energy;
      if (energy) energyHistory.push(energy);
    }
  }

  // Episodes are newest-first but intentions within each episode are also
  // newest-first (the service appends new revisions). energyHistory should
  // read oldest-first so the temporal phrase "last time you were X"
  // matches reality — the last entry IS the most recent.
  energyHistory.reverse();

  // Returning-ness is true when there is real history worth naming:
  // a recommendation was surfaced once OR a booking was recorded.
  // An empty intention that never reached recommendation does not count.
  const isReturning = pastMatches.length > 0 || pastBookings.length > 0;

  return {
    isReturning,
    energyHistory,
    pastMatches,
    pastBookings,
    // Operational memory never invents these — they belong to the
    // semantic-memory adapter. enrichWithSemanticMemory() may fill them
    // when Cognee returns non-empty recall.
    pastNotes: [],
    priorCheckIns: [],
    rawRecall: [],
    // Provider is "none" until Cognee speaks. Recognize this as
    // "the projector ran; Cognee did not contribute anything".
    provider: "none",
  };
}
