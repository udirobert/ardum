// Memory summary endpoint.
//
// AGENTS.md: "Derived ranking views (lens re-rankings and similar)
// never mutate episode state." This route reads episodes and
// projects a MemoryContext — it never writes. The page surfaces
// "what Mira is keeping in mind" from operational truth.
//
// Like the home page (src/app/page.tsx), this is deliberately
// projector-only — `semantic` is not threaded into projectActorMemory.
// Reason: the memory page is about operational recognition ("I
// remember you surfacing X recommendations, Y bookings"); the
// pastNotes weave is a smaller-blast-radius choice and list/detail
// surfaces (where a single recommendation is the focus) choose it
// there. Keeping this route projector-only also avoids any slow or
// unreachable Cognee blocking the memory list first paint.

import { NextResponse } from "next/server";
import { episodeRepository } from "@/episodes/repository";
import { resolveActor } from "@/identity/actor";
import { projectActorMemory } from "@/memory/enrich";

export const dynamic = "force-dynamic";

export async function GET() {
  const actorId = await resolveActor();
  if (!actorId) {
    // No ownership cookie yet — structurally identical to "no
    // episodes" for callers. The page gates its summary card on
    // `memory?.isReturning` anyway, so a null response is the
    // correct shape for the not-set case.
    return NextResponse.json({ memory: null });
  }
  const episodes = await episodeRepository.listOwned(actorId);
  // Project-from-all: there is no "current vs prior" distinction on
  // this surface. Mirrors src/app/api/episodes/route.ts.
  const memory = await projectActorMemory(actorId, episodes);
  return NextResponse.json({ memory });
}
