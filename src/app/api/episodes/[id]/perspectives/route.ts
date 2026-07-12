import { NextResponse } from "next/server";
import { episodeRepository } from "@/episodes/repository";
import { scoreEpisodePerspectives } from "@/episodes/perspectives";
import { resolveActor } from "@/identity/actor";

export const dynamic = "force-dynamic";

// GET re-scores the current intention under the three lenses without
// touching episode state. The returned perspectives may differ from
// the current recommendation when a non-balanced lens shifts the
// composite ranking enough.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actorId = await resolveActor();
    if (!actorId) {
      return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    }
    const { id } = await context.params;
    const episode = await episodeRepository.getOwned(actorId, id);
    if (!episode) {
      return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    }
    return NextResponse.json({
      perspectives: scoreEpisodePerspectives(episode),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not recompute the fit.",
      },
      { status: 400 },
    );
  }
}
