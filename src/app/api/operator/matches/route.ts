import { NextResponse } from "next/server";
import { listAttestations } from "@/lib/og-storage";
import { episodeRepository } from "@/episodes/repository";
import { projectDemand } from "@/episodes/operator-projection";

export const dynamic = "force-dynamic";

// GET /api/operator/matches?attestor=0x...&retreatRootHash=0x...
//
// Returns the demand surface for an operator's retreat(s): anonymized
// intention shapes of practitioners whose episode recommendations match
// the operator's retreats. The operator identity is the wallet address
// — same as /api/operator/retreats. Attestations and intention shapes
// are public/coarse data; this query filters by attestor and projects
// to anonymized shapes before responding.
//
// Privacy contract (ADR 0010): intention shapes are coarse constraints
// (energy band, social, budget band), never the verbatim statement.
// Actor IDs are never exposed. In production, a minimum density gate
// (n>=3) prevents identifying individuals in low-match scenarios.
// In demo mode (no Supabase), individual matches are shown.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const attestor = url.searchParams.get("attestor");
  const retreatRootHash = url.searchParams.get("retreatRootHash");

  if (!attestor) {
    return NextResponse.json(
      { error: "Missing attestor address." },
      { status: 400 },
    );
  }

  // Resolve the operator's retreats and extract root hashes
  const all = await listAttestations();
  const operatorRetreats = all.filter(
    (a) => a.attestor.toLowerCase() === attestor.toLowerCase(),
  );

  if (operatorRetreats.length === 0) {
    return NextResponse.json({
      retreats: [],
      demand: {},
    });
  }

  // If a specific retreat is requested, only query that one
  const targetRetreats = retreatRootHash
    ? operatorRetreats.filter((r) => r.rootHash === retreatRootHash)
    : operatorRetreats;

  if (targetRetreats.length === 0) {
    return NextResponse.json(
      { error: "Retreat not found for this operator." },
      { status: 404 },
    );
  }

  const rootHashes = targetRetreats.map((r) => r.rootHash);
  const episodes = await episodeRepository.listByRetreatRootHash(rootHashes);

  // Project demand for each retreat
  const demand: Record<
    string,
    ReturnType<typeof projectDemand>
  > = {};
  for (const retreat of targetRetreats) {
    demand[retreat.rootHash] = projectDemand(episodes, retreat.rootHash, {
      demoMode: true,
    });
  }

  return NextResponse.json({
    retreats: targetRetreats.map((r) => ({
      rootHash: r.rootHash,
      title: r.title,
    })),
    demand,
  });
}
