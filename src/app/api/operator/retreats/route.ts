import { NextResponse } from "next/server";
import { listAttestations } from "@/lib/og-storage";
import { episodeRepository } from "@/episodes/repository";
import { projectDemand } from "@/episodes/operator-projection";

export const dynamic = "force-dynamic";

// GET /api/operator/retreats?attestor=0x...
// Returns the operator's retreats enriched with demand summary: how many
// practitioners match, how many are holding, how many have booked. The
// operator identity is the wallet address from the Particle Auth session.
// Attestations are public data; this query filters by attestor and
// cross-references episodes to produce per-retreat demand counts.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const attestor = url.searchParams.get("attestor");
  if (!attestor) {
    return NextResponse.json(
      { error: "Missing attestor address." },
      { status: 400 },
    );
  }

  const all = await listAttestations();
  const retreats = all.filter(
    (a) => a.attestor.toLowerCase() === attestor.toLowerCase(),
  );

  if (retreats.length === 0) {
    return NextResponse.json({ retreats: [] });
  }

  // Cross-reference episodes to get demand summary per retreat
  const rootHashes = retreats.map((r) => r.rootHash);
  const episodes = await episodeRepository.listByRetreatRootHash(rootHashes);

  const enriched = retreats.map((retreat) => {
    const demand = projectDemand(episodes, retreat.rootHash, {
      demoMode: true,
    });
    return {
      ...retreat,
      demand: {
        totalMatches: demand.totalMatches,
        activeHolds: demand.activeHolds,
        bookings: demand.bookings,
      },
    };
  });

  return NextResponse.json({ retreats: enriched });
}
