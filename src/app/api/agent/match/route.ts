import { NextResponse } from "next/server";
import { applyEpisodeCommand, createEpisode } from "@/episodes/service";
import { resolveActor } from "@/identity/actor";
import { listAttestations } from "@/lib/og-storage";

export const dynamic = "force-dynamic";

// Agent-callable retreat matching service (A2MCP free endpoint).
//
// Takes an intention + optional constraints and returns matched retreat(s).
// This is the discovery layer — agents call this to find retreats that fit
// their user's needs, then call /api/agent/book to execute the booking.
//
// Request:
//   {
//     "intention": "I need a quiet week before October. Solitude matters.",
//     "desiredShift": "Come back to my edges with a little softness.",
//     "constraints": {
//       "energy": "settled" | "in-movement" | "low" | "sharp",
//       "budget": "under-500" | "500-1k" | "1k-2k" | "2k-plus",
//       "social": "solo" | "cohort"
//     }
//   }
//
// Response (HTTP 200):
//   {
//     "matches": [
//       {
//         "retreatTitle": "Sidemen Restoration Retreat",
//         "retreatRootHash": "bali-sidemen-...",
//         "operatorAddress": "0x...",
//         "priceUsd": 1200,
//         "description": "...",
//         "location": "Bali, Indonesia",
//         "duration": "7 days"
//       }
//     ],
//     "episodeId": "uuid"  // created for this matching session
//   }

type MatchRequest = {
  intention: string;
  desiredShift?: string;
  constraints?: {
    energy?: "settled" | "in-movement" | "low" | "sharp";
    budget?: "under-500" | "500-1k" | "1k-2k" | "2k-plus";
    social?: "solo" | "cohort";
  };
};

export async function POST(req: Request) {
  let body: MatchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.intention || body.intention.trim().length < 10) {
    return NextResponse.json(
      { error: "intention is required (min 10 characters)" },
      { status: 400 },
    );
  }

  // Create an episode to run the matching through the real pipeline
  const actorId = await resolveActor({ create: true });
  if (!actorId) {
    return NextResponse.json(
      { error: "Could not establish ownership." },
      { status: 500 },
    );
  }

  // Capture the intention — agent calls set persistenceConsent=true
  // because the agent is acting on behalf of a user who has consented
  const episode = await createEpisode(actorId, {
    statement: body.intention,
    desiredShift: body.desiredShift ?? "",
    persistenceConsent: true,
  });

  let revision = episode.revision;

  // Apply constraints if provided
  if (body.constraints) {
    const constraints: Record<string, string> = {};
    if (body.constraints.energy) constraints.energy = body.constraints.energy;
    if (body.constraints.budget) constraints.budget = body.constraints.budget;
    if (body.constraints.social) constraints.social = body.constraints.social;

    if (Object.keys(constraints).length > 0) {
      const result = await applyEpisodeCommand(actorId, episode.id, {
        type: "revise-intention",
        expectedRevision: revision,
        constraints,
        reason: "Agent-provided constraints",
      });
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 },
        );
      }
      revision = result.episode.revision;
    }
  }

  // Get recommendation
  const recResult = await applyEpisodeCommand(actorId, episode.id, {
    type: "recommend",
    expectedRevision: revision,
  });

  if ("error" in recResult) {
    return NextResponse.json(
      { error: recResult.error },
      { status: 400 },
    );
  }

  const match = recResult.episode.recommendation?.result;
  if (!match) {
    return NextResponse.json(
      {
        matches: [],
        episodeId: episode.id,
        message: "No retreats matched the given intention and constraints.",
      },
      { status: 200 },
    );
  }

  // Also list all available retreats for the agent to browse
  const allAttestations = await listAttestations();
  const retreatAttestations = allAttestations
    .filter((a: { kind?: string }) => a.kind !== "booking")
    .map((a: {
      rootHash?: string;
      title?: string;
      description?: string;
      attestor?: string;
      claims?: { priceUsd?: number; location?: string; duration?: string };
    }) => ({
      retreatRootHash: a.rootHash,
      title: a.title,
      description: a.description,
      operatorAddress: a.attestor,
      priceUsd: a.claims?.priceUsd,
      location: a.claims?.location,
      duration: a.claims?.duration,
    }));

  return NextResponse.json(
    {
      topMatch: {
        retreatTitle: match.retreatTitle,
        retreatRootHash: match.retreatRootHash,
        operatorAddress: match.attestor,
        priceUsd: match.priceUsd,
        score: match.score,
        headline: match.headline,
      },
      allRetreats: retreatAttestations,
      episodeId: episode.id,
      nextStep: {
        action: "book",
        endpoint: "/api/agent/book",
        description:
          "Call /api/agent/book with episodeId, retreatRootHash, and agent wallet to execute the booking with on-chain deposit.",
      },
    },
    { status: 200 },
  );
}

// GET — service discovery (so agents can introspect the service)
export async function GET() {
  return NextResponse.json({
    service: "ardum-retreat-matching",
    description:
      "Discover wellness retreats that match a user's intention. Agent-callable retreat matching for the Ardum booking infrastructure.",
    type: "free",
    endpoint: "POST /api/agent/match",
    requestSchema: {
      intention: "string (required, min 10 chars) — what the user wants to make space for",
      desiredShift: "string (optional) — the desired outcome",
      constraints: {
        energy: "settled | in-movement | low | sharp",
        budget: "under-500 | 500-1k | 1k-2k | 2k-plus",
        social: "solo | cohort",
      },
    },
    responseSchema: {
      topMatch: "object — best-matched retreat with title, rootHash, operator, price",
      allRetreats: "array — all available retreats in the pool",
      episodeId: "string — use this for the subsequent booking call",
      nextStep: "object — instructions for executing the booking",
    },
    bookingEndpoint: "/api/agent/book",
    onchainSettlement: {
      chain: "Arbitrum Sepolia (testnet) / Arbitrum One (mainnet)",
      escrowContract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "(not deployed)",
      token: "USDC",
    },
  });
}
