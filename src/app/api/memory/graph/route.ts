// GET /api/memory/graph — fetch the real Cognee knowledge graph for
// the practitioner's dataset. Returns nodes and edges from
// GET /api/v1/datasets/{id}/graph.
//
// When Cognee is not configured or the dataset doesn't exist yet,
// returns null so the frontend can fall back to the synthetic graph.

import { NextResponse, type NextRequest } from "next/server";
import { getDatasetGraph, hasCognee } from "@/lib/cognee";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId." },
      { status: 400 },
    );
  }

  if (!hasCognee()) {
    return NextResponse.json({
      configured: false,
      graph: null,
    });
  }

  const graph = await getDatasetGraph(userId);
  return NextResponse.json({
    configured: true,
    graph,
  });
}
