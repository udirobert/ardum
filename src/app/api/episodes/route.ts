import { NextResponse } from "next/server";
import { parseCreateEpisode } from "@/episodes/contracts";
import { episodeRepository } from "@/episodes/repository";
import { createEpisode } from "@/episodes/service";
import { resolveActor } from "@/identity/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  const actorId = await resolveActor();
  if (!actorId) return NextResponse.json({ episodes: [] });
  const episodes = await episodeRepository.listOwned(actorId);
  return NextResponse.json({ episodes });
}

export async function POST(request: Request) {
  try {
    const input = parseCreateEpisode(await request.json());
    const actorId = await resolveActor({ create: true });
    if (!actorId) throw new Error("Could not establish ownership.");
    const episode = await createEpisode(actorId, input);
    return NextResponse.json({ episode }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
