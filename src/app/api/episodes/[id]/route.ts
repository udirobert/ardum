import { NextResponse } from "next/server";
import { episodeRepository } from "@/episodes/repository";
import { nextDecision } from "@/episodes/model";
import { resolveActor } from "@/identity/actor";
import { projectActorMemory } from "@/memory/enrich";
import { cogneeMemory } from "@/memory/cognee";

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
  // Project memory from the actor's full episode set EXCLUDING the
  // current episode — matchLetter() reads `pastMatches[0]` for
  // "Welcome back. Last time I recommended X in Y", and that should
  // be the practitioner's PRIOR journey, never the pick we're showing
  // them right now. Without this filter, the recognition line would
  // name the very retreat we just surfaced and the wow moment would
  // collapse into a tautology. The LIST endpoint does NOT apply this
  // filter — see src/app/api/episodes/route.ts for the rationale.
  const siblings = (await episodeRepository.listOwned(actorId)).filter(
    (sibling) => sibling.id !== id,
  );
  const memory = await projectActorMemory(actorId, siblings, cogneeMemory);
  return NextResponse.json({
    episode,
    nextDecision: nextDecision(episode),
    memory,
  });
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
