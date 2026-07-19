import "server-only";

import type { Episode, ParticipantResponse } from "./model";
import { hasSupabase } from "@/lib/env";
import * as local from "./repositories/local";
import * as supabase from "./repositories/supabase";

export type InviteRecord = {
  tokenHash: string;
  episodeId: string;
  participantName: string;
  expiresAt: string;
  respondedAt?: string;
};

export interface EpisodeRepository {
  create(episode: Episode): Promise<Episode>;
  getOwned(actorId: string, episodeId: string): Promise<Episode | undefined>;
  /** Get any episode by ID, regardless of actor. For agent API calls where
   *  identity is proven by signature, not cookie. */
  get(episodeId: string): Promise<Episode | undefined>;
  listOwned(actorId: string): Promise<Episode[]>;
  listDue(now: Date): Promise<Episode[]>;
  save(
    actorId: string,
    episode: Episode,
    expectedRevision: number,
  ): Promise<Episode>;
  createInvite(record: InviteRecord): Promise<void>;
  getInvite(tokenHash: string): Promise<InviteRecord | undefined>;
  respondToInvite(
    tokenHash: string,
    response: ParticipantResponse,
  ): Promise<Episode>;
  deleteOwned(actorId: string, episodeId: string): Promise<void>;
}

// Callers never branch on the provider. Both adapters obey the same aggregate
// contract and optimistic-concurrency semantics.
export const episodeRepository: EpisodeRepository = hasSupabase()
  ? supabase
  : local;
