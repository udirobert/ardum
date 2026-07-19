import { NextResponse } from "next/server";
import { verifyMessage } from "ethers";
import { uploadAttestation } from "@/lib/og-storage";
import type { BookingAttestation } from "@/booking/types";
import { episodeRepository } from "@/episodes/repository";
import { applyEpisodeCommand } from "@/episodes/service";

export const dynamic = "force-dynamic";

// Agent-callable booking execution service (A2MCP free endpoint).
//
// Executes a retreat booking: records the on-chain deposit reference and
// writes a signed booking attestation to 0G Storage. The actual on-chain
// deposit (USDC transfer to escrow) is performed by the agent before calling
// this endpoint — this service records the result.
//
// Request:
//   {
//     "episodeId": "uuid",
//     "retreatRootHash": "bali-sidemen-...",
//     "operatorAddress": "0x...",
//     "depositTxHash": "0x...",
//     "depositUsd": 1,
//     "agentAddress": "0x...",
//     "signature": "0x..."  // EIP-191 personal_sign over canonical booking message
//   }
//
// Response (HTTP 200):
//   {
//     "bookingRootHash": "booking-...",
//     "episodeStatus": "booked",
//     "attestor": "0x..."
//   }

type BookRequest = {
  episodeId: string;
  retreatRootHash: string;
  operatorAddress: string;
  depositTxHash: string;
  depositUsd: number;
  agentAddress: string;
  signature: string;
};

export async function POST(req: Request) {
  let body: BookRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    episodeId,
    retreatRootHash,
    operatorAddress,
    depositTxHash,
    depositUsd,
    agentAddress,
    signature,
  } = body;

  // Validate required fields
  if (!episodeId || !retreatRootHash || !depositTxHash || !agentAddress || !signature) {
    return NextResponse.json(
      { error: "Missing required fields: episodeId, retreatRootHash, depositTxHash, agentAddress, signature" },
      { status: 400 },
    );
  }

  // Look up the episode by ID — the signature proves the agent's identity,
  // not a cookie. This is the agent API path.
  const episode = await episodeRepository.get(episodeId);
  if (!episode) {
    return NextResponse.json(
      { error: "Episode not found." },
      { status: 404 },
    );
  }

  // Verify the agent's signature over the booking intent — the agent signs
  // a message containing the fields it knows (before the server generates
  // the bookingRootHash and bookedAt). This proves the agent authorized
  // this specific deposit for this specific retreat.
  const agentMessage = [
    "Ardum agent booking authorization v1",
    `episodeId: ${episodeId}`,
    `retreatRootHash: ${retreatRootHash}`,
    `depositTxHash: ${depositTxHash}`,
    `depositUsd: ${depositUsd}`,
    `agentAddress: ${agentAddress}`,
  ].join("\n");
  let recovered: string;
  try {
    recovered = verifyMessage(agentMessage, signature);
  } catch {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 },
    );
  }
  if (recovered.toLowerCase() !== agentAddress.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Signature does not match agent address.",
        recovered,
        expected: agentAddress,
      },
      { status: 403 },
    );
  }

  // Build the booking attestation (server generates rootHash + bookedAt)
  const bookingRootHash = `booking-${retreatRootHash.slice(0, 16)}-${Date.now().toString(36)}`;
  const booking: BookingAttestation = {
    rootHash: bookingRootHash,
    kind: "booking",
    title: `Agent booking: ${retreatRootHash.slice(0, 20)}`,
    description: `Deposit of $${depositUsd} for retreat ${retreatRootHash.slice(0, 20)}`,
    claims: {
      retreatRootHash,
      practitionerAddress: agentAddress,
      operatorAddress: operatorAddress || "0x0000000000000000000000000000000000000000",
      depositUsd: depositUsd || 0,
      depositToken: "USDC",
      depositChainId: 421614,
      settleChainId: 421614,
      depositTxId: depositTxHash,
      escrowAddress: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || undefined,
      status: "deposit-confirmed",
      bookedAt: new Date().toISOString(),
      checkInWindowHours: 168,
    },
    attestor: agentAddress,
    createdAt: new Date().toISOString(),
  };

  // Write to 0G Storage
  const result = await uploadAttestation(
    booking as unknown as Parameters<typeof uploadAttestation>[0],
  );

  // Record the commitment in the episode — the signature proves identity,
  // so we skip the cookie-based ownership check
  await applyEpisodeCommand(
    agentAddress,
    episodeId,
    {
      type: "record-commitment",
      expectedRevision: episode.revision,
      bookingRootHash: result.rootHash,
      depositTxId: depositTxHash,
      bookedAt: new Date().toISOString(),
      idempotencyKey: `booking:${result.rootHash}`,
    },
    { skipOwnershipCheck: true },
  );

  return NextResponse.json({
    bookingRootHash: result.rootHash,
    episodeStatus: "booked",
    attestor: recovered,
    depositTxHash,
    escrowAddress: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? null,
    message: "Booking recorded. The deposit is held in escrow on Arbitrum Sepolia.",
  });
}

// GET — service discovery
export async function GET() {
  return NextResponse.json({
    service: "ardum-agent-booking",
    description:
      "Execute a retreat booking with on-chain deposit. The agent performs the USDC transfer to escrow before calling this endpoint, then submits the signed booking attestation here.",
    type: "free",
    endpoint: "POST /api/agent/book",
    requestSchema: {
      episodeId: "string (required) — from /api/agent/match",
      retreatRootHash: "string (required) — from /api/agent/match",
      operatorAddress: "string (required) — from /api/agent/match",
      depositTxHash: "string (required) — on-chain tx hash of the USDC transfer to escrow",
      depositUsd: "number (required) — deposit amount in USD",
      agentAddress: "string (required) — agent's EOA address",
      signature: "string (required) — EIP-191 personal_sign of the canonical booking message",
    },
    responseSchema: {
      bookingRootHash: "string — 0G Storage root hash of the booking attestation",
      episodeStatus: "string — 'booked'",
      attestor: "string — verified agent address",
      depositTxHash: "string — on-chain deposit tx hash",
      escrowAddress: "string — escrow contract address",
    },
    onchainSettlement: {
      chain: "Arbitrum Sepolia (testnet) / Arbitrum One (mainnet)",
      escrowContract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "(not deployed)",
      token: "USDC",
      tokenAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    },
    signatureFormat:
      "Sign the agent authorization message with EIP-191 personal_sign: 'Ardum agent booking authorization v1\\nepisodeId: <id>\\nretreatRootHash: <hash>\\ndepositTxHash: <tx>\\ndepositUsd: <amount>\\nagentAddress: <addr>'",
  });
}
