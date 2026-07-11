import { NextResponse } from "next/server";
import { episodeRepository } from "@/episodes/repository";
import { nextDecision } from "@/episodes/model";
import { resolveActor } from "@/identity/actor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actorId = await resolveActor();
  if (!actorId) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }
  const { id } = await context.params;
  const episode = await episodeRepository.getOwned(actorId, id);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }
  return NextResponse.json({ episode, nextDecision: nextDecision(episode) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actorId = await resolveActor();
  if (!actorId) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }
  const { id } = await context.params;
  await episodeRepository.deleteOwned(actorId, id);
  return NextResponse.json({ ok: true });
}
