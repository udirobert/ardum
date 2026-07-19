import type { Episode, ParticipantResponse } from "../model";
import type { InviteRecord } from "../repository";

declare global {
  var __ardumEpisodes: Map<string, Episode> | undefined;
  var __ardumEpisodeInvites: Map<string, InviteRecord> | undefined;
}

const episodes =
  globalThis.__ardumEpisodes ?? new Map<string, Episode>();
const invites =
  globalThis.__ardumEpisodeInvites ?? new Map<string, InviteRecord>();

if (!globalThis.__ardumEpisodes) globalThis.__ardumEpisodes = episodes;
if (!globalThis.__ardumEpisodeInvites) {
  globalThis.__ardumEpisodeInvites = invites;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function create(episode: Episode): Promise<Episode> {
  if (episodes.has(episode.id)) throw new Error("Episode already exists.");
  episodes.set(episode.id, clone(episode));
  return clone(episode);
}

export async function getOwned(
  actorId: string,
  episodeId: string,
): Promise<Episode | undefined> {
  const episode = episodes.get(episodeId);
  if (!episode || episode.actorId !== actorId) return;
  return clone(episode);
}

export async function get(
  episodeId: string,
): Promise<Episode | undefined> {
  const episode = episodes.get(episodeId);
  return episode ? clone(episode) : undefined;
}

export async function listOwned(actorId: string): Promise<Episode[]> {
  return [...episodes.values()]
    .filter((episode) => episode.actorId === actorId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(clone);
}

export async function listDue(now: Date): Promise<Episode[]> {
  return [...episodes.values()]
    .filter(
      (episode) =>
        episode.monitor?.status === "active" &&
        new Date(episode.monitor.nextCheckAt).getTime() <= now.getTime(),
    )
    .map(clone);
}

export async function save(
  actorId: string,
  episode: Episode,
  expectedRevision: number,
): Promise<Episode> {
  const existing = episodes.get(episode.id);
  if (!existing || existing.actorId !== actorId) {
    throw new Error("Episode not found.");
  }
  if (existing.revision !== expectedRevision) {
    throw new Error("Episode changed. Refresh before trying again.");
  }
  if (episode.revision !== expectedRevision + 1) {
    throw new Error("Episode revision must advance exactly once.");
  }
  episodes.set(episode.id, clone(episode));
  return clone(episode);
}

export async function createInvite(record: InviteRecord): Promise<void> {
  if (invites.has(record.tokenHash)) throw new Error("Invite already exists.");
  invites.set(record.tokenHash, clone(record));
}

export async function getInvite(
  tokenHash: string,
): Promise<InviteRecord | undefined> {
  const invite = invites.get(tokenHash);
  return invite ? clone(invite) : undefined;
}

export async function respondToInvite(
  tokenHash: string,
  response: ParticipantResponse,
): Promise<Episode> {
  const invite = invites.get(tokenHash);
  if (!invite) throw new Error("Invitation not found.");
  if (invite.respondedAt) throw new Error("Invitation already answered.");
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw new Error("Invitation expired.");
  }
  const episode = episodes.get(invite.episodeId);
  if (!episode) throw new Error("Episode not found.");

  const updated: Episode = {
    ...episode,
    revision: episode.revision + 1,
    status: response.decision === "yes" ? "ready-to-book" : "coordinating",
    coordination: {
      sharingConsent: true,
      participantName: invite.participantName,
      inviteCreatedAt: episode.coordination?.inviteCreatedAt,
      inviteExpiresAt: invite.expiresAt,
      responses: [
        ...(episode.coordination?.responses ?? []),
        response,
      ],
    },
    events: [
      ...episode.events,
      {
        id: crypto.randomUUID(),
        type: "participant-responded",
        summary: `${invite.participantName} responded ${response.decision}.`,
        createdAt: response.respondedAt,
      },
    ],
    updatedAt: response.respondedAt,
  };
  episodes.set(updated.id, clone(updated));
  invites.set(tokenHash, { ...invite, respondedAt: response.respondedAt });
  return clone(updated);
}

export async function deleteOwned(
  actorId: string,
  episodeId: string,
): Promise<void> {
  const episode = episodes.get(episodeId);
  if (!episode || episode.actorId !== actorId) return;
  episodes.delete(episodeId);
  for (const [hash, invite] of invites) {
    if (invite.episodeId === episodeId) invites.delete(hash);
  }
}
