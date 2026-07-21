// Episode detail + action API payloads — single assembly point for routes
// and client islands. Projects miraPresence from operational episode truth.

import { projectMiraPresence, type MiraPresence } from "@/agent/mira-presence";
import { resolveWiderApertureEvidence } from "@/evidence/resolve-wider-aperture";
import type { WiderApertureStores } from "@/evidence/resolve-wider-aperture";
import type { WiderApertureEvidence } from "@/evidence/wider-aperture";
import { nextDecision, type Episode, type NextDecision } from "./model";
import type { MemoryContext } from "@/memory/semantic-memory";

export type EpisodeDetailPayload = {
  episode: Episode;
  nextDecision: NextDecision;
  miraPresence: MiraPresence;
  memory?: MemoryContext;
  /** Tier B/C evidence for Beat 2 disclosure — null fields when gates fail. */
  widerApertureEvidence?: WiderApertureEvidence;
  /** ADR 0011 §5: whether the actor has an authenticated provider subject.
   *  Used by the booked landing to decide whether to show the cross-device
   *  continuity CTA. False when the actor is anonymous-only. */
  isAuthenticated?: boolean;
};

export type EpisodeActionPayload = {
  episode: Episode;
  nextDecision: NextDecision;
  miraPresence: MiraPresence;
  shareToken?: string;
};

export type EpisodeListPayload = {
  episodes: Episode[];
  memory: MemoryContext | null;
  /** Posture for the practitioner's active (non-completed) episode, if any. */
  activeMiraPresence: MiraPresence | null;
};

export function buildEpisodeDetailPayload(input: {
  episode: Episode;
  memory?: MemoryContext;
  now?: number;
  widerApertureStores?: WiderApertureStores;
  isAuthenticated?: boolean;
}): EpisodeDetailPayload {
  const intention = input.episode.intentions.at(-1);
  const recommendation = input.episode.recommendation?.result;
  const widerApertureEvidence =
    intention && recommendation && input.widerApertureStores
      ? resolveWiderApertureEvidence({
          constraints: intention.constraints,
          retreatKey: recommendation.retreatRootHash,
          stores: input.widerApertureStores,
        })
      : undefined;

  return {
    episode: input.episode,
    nextDecision: nextDecision(input.episode),
    memory: input.memory,
    miraPresence: projectMiraPresence(input.episode, input.now),
    widerApertureEvidence,
    isAuthenticated: input.isAuthenticated,
  };
}

export function buildEpisodeActionPayload(
  result: { episode: Episode; shareToken?: string },
  now?: number,
): EpisodeActionPayload {
  return {
    episode: result.episode,
    nextDecision: nextDecision(result.episode),
    miraPresence: projectMiraPresence(result.episode, now),
    shareToken: result.shareToken,
  };
}

export function activeEpisodePresence(
  episodes: Episode[],
  now?: number,
): MiraPresence | null {
  const active = episodes.find((episode) => episode.status !== "completed");
  return active ? projectMiraPresence(active, now) : null;
}

export function buildEpisodeListPayload(input: {
  episodes: Episode[];
  memory: MemoryContext | null;
  now?: number;
}): EpisodeListPayload {
  return {
    episodes: input.episodes,
    memory: input.memory,
    activeMiraPresence: activeEpisodePresence(input.episodes, input.now),
  };
}
