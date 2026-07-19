import "server-only";

import { supabaseAdmin } from "@/lib/supabase";
import type { Episode, ParticipantResponse } from "../model";
import type { InviteRecord } from "../repository";

function client() {
  const value = supabaseAdmin();
  if (!value) throw new Error("Supabase is not configured.");
  return value;
}

function nextActionAt(episode: Episode): string | null {
  return episode.monitor?.status === "active"
    ? episode.monitor.nextCheckAt
    : episode.hold?.status === "active"
      ? episode.hold.expiresAt
      : null;
}

export async function create(episode: Episode): Promise<Episode> {
  const sb = client();
  const { error: actorError } = await sb
    .from("actors")
    .upsert({ id: episode.actorId, kind: "anonymous" }, { onConflict: "id" });
  if (actorError) throw new Error(actorError.message);
  const { error } = await sb.from("episodes").insert({
    id: episode.id,
    actor_id: episode.actorId,
    status: episode.status,
    revision: episode.revision,
    state: episode,
    next_action_at: nextActionAt(episode),
    created_at: episode.createdAt,
    updated_at: episode.updatedAt,
  });
  if (error) throw new Error(error.message);
  return episode;
}

export async function getOwned(
  actorId: string,
  episodeId: string,
): Promise<Episode | undefined> {
  const { data, error } = await client()
    .from("episodes")
    .select("state")
    .eq("id", episodeId)
    .eq("actor_id", actorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.state as Episode | undefined;
}

export async function get(
  episodeId: string,
): Promise<Episode | undefined> {
  const { data, error } = await client()
    .from("episodes")
    .select("state")
    .eq("id", episodeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.state as Episode | undefined;
}

export async function listOwned(actorId: string): Promise<Episode[]> {
  const { data, error } = await client()
    .from("episodes")
    .select("state")
    .eq("actor_id", actorId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.state as Episode);
}

export async function listDue(now: Date): Promise<Episode[]> {
  const { data, error } = await client()
    .from("episodes")
    .select("state")
    .lte("next_action_at", now.toISOString())
    .not("next_action_at", "is", null)
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.state as Episode);
}

export async function save(
  actorId: string,
  episode: Episode,
  expectedRevision: number,
): Promise<Episode> {
  const { data, error } = await client()
    .from("episodes")
    .update({
      status: episode.status,
      revision: episode.revision,
      state: episode,
      next_action_at: nextActionAt(episode),
      updated_at: episode.updatedAt,
    })
    .eq("id", episode.id)
    .eq("actor_id", actorId)
    .eq("revision", expectedRevision)
    .select("state")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Episode changed. Refresh before trying again.");
  return data.state as Episode;
}

export async function createInvite(record: InviteRecord): Promise<void> {
  const { error } = await client().from("coordination_invites").insert({
    token_hash: record.tokenHash,
    episode_id: record.episodeId,
    participant_name: record.participantName,
    expires_at: record.expiresAt,
  });
  if (error) throw new Error(error.message);
}

export async function getInvite(
  tokenHash: string,
): Promise<InviteRecord | undefined> {
  const { data, error } = await client()
    .from("coordination_invites")
    .select("token_hash, episode_id, participant_name, expires_at, responded_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  return {
    tokenHash: data.token_hash,
    episodeId: data.episode_id,
    participantName: data.participant_name,
    expiresAt: data.expires_at,
    respondedAt: data.responded_at ?? undefined,
  };
}

export async function respondToInvite(
  tokenHash: string,
  response: ParticipantResponse,
): Promise<Episode> {
  const invite = await getInvite(tokenHash);
  if (!invite || invite.respondedAt) throw new Error("Invitation unavailable.");
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw new Error("Invitation expired.");
  }
  const sb = client();
  const { data: row, error: readError } = await sb
    .from("episodes")
    .select("state, revision")
    .eq("id", invite.episodeId)
    .single();
  if (readError) throw new Error(readError.message);
  const episode = row.state as Episode;
  const updated: Episode = {
    ...episode,
    revision: episode.revision + 1,
    status: response.decision === "yes" ? "ready-to-book" : "coordinating",
    coordination: {
      sharingConsent: true,
      participantName: invite.participantName,
      inviteCreatedAt: episode.coordination?.inviteCreatedAt,
      inviteExpiresAt: invite.expiresAt,
      responses: [...(episode.coordination?.responses ?? []), response],
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
  const saved = await save(
    episode.actorId,
    updated,
    episode.revision,
  );
  const { error: inviteError } = await sb
    .from("coordination_invites")
    .update({ responded_at: response.respondedAt })
    .eq("token_hash", tokenHash)
    .is("responded_at", null);
  if (inviteError) throw new Error(inviteError.message);
  return saved;
}

export async function deleteOwned(
  actorId: string,
  episodeId: string,
): Promise<void> {
  const { error } = await client()
    .from("episodes")
    .delete()
    .eq("id", episodeId)
    .eq("actor_id", actorId);
  if (error) throw new Error(error.message);
}
