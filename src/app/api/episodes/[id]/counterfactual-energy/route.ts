// GET route for the counterfactual energy surface.
//
// Re-ranks the verified pool under a hypothetical energy state
// WITHOUT touching episode state \u2014 the second non-lens
// derived-view surface under the broadened AGENTS.md rule from
// commit 2075a69:
//
//   "Derived ranking views (lens re-rankings and similar) never
//    mutate episode state."
//
// Auth-gated, like the lens endpoint and the budget counterfactual
// route. The URL carries the override energy so the surface is a
// read-only GET. The helper in @/episodes/counterfactual only
// reads; the repository's save path is never reached by design.
//
// The server-side test at route.test.ts pins the broadened rule
// against this surface using the same revision-before /
// revision-after shape as the lens and budget tests (commit
// 3343142).

import { NextResponse } from "next/server";

import { ENERGY_STATES } from "@/calibration/schema";
import type { EnergyState } from "@/calibration/schema";
import { resolveActor } from "@/identity/actor";
import { episodeRepository } from "@/episodes/repository";
import { scoreCounterfactualEnergy } from "@/episodes/counterfactual";

export const dynamic = "force-dynamic";

const VALID_ENERGIES: readonly EnergyState[] = ENERGY_STATES.map((e) => e.value);

export async function GET(
  request: Request,
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
    const url = new URL(request.url);
    const rawEnergy = url.searchParams.get("energy");
    if (!rawEnergy || !VALID_ENERGIES.includes(rawEnergy as EnergyState)) {
      return NextResponse.json(
        {
          error: `Invalid energy. Expected one of: ${VALID_ENERGIES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      counterfactual: scoreCounterfactualEnergy(
        episode,
        rawEnergy as EnergyState,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not run the counterfactual.",
      },
      { status: 400 },
    );
  }
}
