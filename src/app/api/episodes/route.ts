import { NextResponse } from "next/server";
import { parseCreateEpisode } from "@/episodes/contracts";
import { buildEpisodeListPayload } from "@/episodes/detail-payload";
import { projectMiraPresence } from "@/agent/mira-presence";
import { episodeRepository } from "@/episodes/repository";
import { createEpisode } from "@/episodes/service";
import { resolveActor } from "@/identity/actor";
import { projectActorMemory } from "@/memory/enrich";
import { cogneeMemory } from "@/memory/cognee";

export const dynamic = "force-dynamic";

export async function GET() {
  const actorId = await resolveActor();
  if (!actorId) {
    return NextResponse.json({
      episodes: [],
      memory: null,
      activeMiraPresence: null,
    });
  }
  // Project from ALL the actor's episodes here — the LIST endpoint
  // serves each episode equally; there is no "current vs prior"
  // distinction the way the detail endpoint (`/api/episodes/[id]`)
  // has. The detail route filters out the current id so matchLetter
  // can read pastMatches[0] as a *prior* match. Don't add the same
  // filter here by analogy.
  const episodes = await episodeRepository.listOwned(actorId);
  const memory = await projectActorMemory(actorId, episodes, cogneeMemory);
  return NextResponse.json(buildEpisodeListPayload({ episodes, memory }));
}

export async function POST(request: Request) {
  try {
    const input = parseCreateEpisode(await request.json());
    const actorId = await resolveActor({ create: true });
    if (!actorId) throw new Error("Could not establish ownership.");
    const episode = await createEpisode(actorId, input);
    return NextResponse.json(
      { episode, miraPresence: projectMiraPresence(episode) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
