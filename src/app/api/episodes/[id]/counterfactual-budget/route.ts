// GET route for the counterfactual budget simulator.
//
// Re-ranks the verified pool under a hypothetical budget band WITHOUT
// touching episode state \u2014 the first non-lens derived-view surface
// under the broadened AGENTS.md rule from commit 2075a69:
//
//   "Derived ranking views (lens re-rankings and similar) never
//    mutate episode state."
//
// Auth-gated, like the lens endpoint. The URL carries the override
// band so the surface is a read-only GET. The helper in
// @/episodes/counterfactual only reads; the repository's save path
// is never reached by design.
//
// The server-side test at route.test.ts pins the broadened rule
// against this surface using the same revision-before /
// revision-after shape as the lens test (commit 3343142).

import { NextResponse } from "next/server";

import { BUDGET_BANDS } from "@/calibration/schema";
import type { BudgetBand } from "@/calibration/schema";
import { resolveActor } from "@/identity/actor";
import { episodeRepository } from "@/episodes/repository";
import { scoreCounterfactualBudget } from "@/episodes/counterfactual";

export const dynamic = "force-dynamic";

const VALID_BANDS: readonly BudgetBand[] = BUDGET_BANDS.map((b) => b.value);

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
    const rawBand = url.searchParams.get("band");
    if (!rawBand || !VALID_BANDS.includes(rawBand as BudgetBand)) {
      return NextResponse.json(
        {
          error: `Invalid band. Expected one of: ${VALID_BANDS.join(", ")}`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      counterfactual: scoreCounterfactualBudget(
        episode,
        rawBand as BudgetBand,
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
