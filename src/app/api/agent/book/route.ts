import { NextResponse } from "next/server";
import { verifyMessage } from "ethers";
import { uploadAttestation } from "@/lib/og-storage";
import type { BookingAttestation } from "@/booking/types";
import { episodeRepository } from "@/episodes/repository";
import { applyEpisodeCommand } from "@/episodes/service";
import {
  canonicalAgentBookingMessage,
  type AgentBookingAuthorization,
} from "@/booking/canonical";
import { verifyTimestamp, consumeNonce } from "@/booking/agent-replay";
import { verifyDepositTx } from "@/booking/deposit-verify";
import { SETTLE_CHAIN_ID } from "@/booking/constants";

export const dynamic = "force-dynamic";

// Agent-callable booking execution service (A2MCP free endpoint).
//
// Executes a retreat booking: verifies the on-chain deposit, confirms the
// agent owns the episode (actorId === agentAddress), verifies the signed
// authorization (with nonce + timestamp replay protection), and writes a
// signed booking attestation to 0G Storage.
//
// Request:
//   {
//     "episodeId": "uuid",
//     "retreatRootHash": "bali-sidemen-...",
//     "operatorAddress": "0x...",
//     "depositTxHash": "0x...",
//     "depositUsd": 1,
//     "agentAddress": "0x...",
//     "nonce": "random-8+-char-string",
//     "timestamp": 1700000000,
//     "signature": "0x..."  // EIP-191 personal_sign over canonicalAgentBookingMessage
//   }
//
// Response (HTTP 200):
//   {
//     "bookingRootHash": "booking-...",
//     "episodeStatus": "booked",
//     "attestor": "0x...",
//     "depositVerification": "full" | "sender"
//   }

type BookRequest = AgentBookingAuthorization & {
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
    nonce,
    timestamp,
    signature,
  } = body;

  // Validate required fields (issue 10: depositUsd + operatorAddress now required)
  const missing: string[] = [];
  if (!episodeId) missing.push("episodeId");
  if (!retreatRootHash) missing.push("retreatRootHash");
  if (!operatorAddress) missing.push("operatorAddress");
  if (!depositTxHash) missing.push("depositTxHash");
  if (!agentAddress) missing.push("agentAddress");
  if (!nonce) missing.push("nonce");
  if (!signature) missing.push("signature");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) {
    return NextResponse.json(
      { error: "agentAddress must be a 0x-prefixed 20-byte address." },
      { status: 400 },
    );
  }
  if (/^0x0{40}$/.test(operatorAddress)) {
    return NextResponse.json(
      { error: "operatorAddress must not be the zero address." },
      { status: 400 },
    );
  }
  if (typeof depositUsd !== "number" || depositUsd <= 0) {
    return NextResponse.json(
      { error: "depositUsd must be a positive number." },
      { status: 400 },
    );
  }
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return NextResponse.json(
      { error: "timestamp must be a finite number (unix seconds)." },
      { status: 400 },
    );
  }

  // Replay protection — issue 2 (timestamp window + nonce uniqueness)
  const tsCheck = verifyTimestamp(timestamp);
  if (!tsCheck.ok) {
    return NextResponse.json({ error: tsCheck.reason }, { status: 400 });
  }
  const nonceCheck = consumeNonce(agentAddress, nonce);
  if (!nonceCheck.ok) {
    return NextResponse.json({ error: nonceCheck.reason }, { status: 400 });
  }

  // Look up the episode. The agent must own it — actorId is set to the
  // agent's address by /api/agent/match (issue 2/3). No skipOwnershipCheck:
  // the signature proves identity, and the actorId match proves ownership.
  const episode = await episodeRepository.get(episodeId);
  if (!episode) {
    return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  }
  if (episode.actorId.toLowerCase() !== agentAddress.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Agent does not own this episode. Create it via /api/agent/match.",
        episodeActor: episode.actorId,
        agentAddress,
      },
      { status: 403 },
    );
  }

  // Verify the agent's signature over the canonical authorization message
  // (issue 2/5: includes operatorAddress, nonce, timestamp).
  const agentMessage = canonicalAgentBookingMessage({
    episodeId,
    retreatRootHash,
    operatorAddress,
    depositTxHash,
    depositUsd,
    agentAddress,
    nonce,
    timestamp,
  });
  let recovered: string;
  try {
    recovered = verifyMessage(agentMessage, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
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

  // Verify the on-chain deposit — issue 1. The agent claims a deposit tx;
  // the server fetches it from the settle RPC and confirms the sender is the
  // agent and the tx succeeded. For direct USDC transfers, also confirms
  // recipient + amount.
  const escrowAddress = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || undefined;
  const depositCheck = await verifyDepositTx({
    depositTxHash,
    agentAddress,
    expectedReceiver: escrowAddress,
    depositUsd,
  });
  if (depositCheck.verified === "failed") {
    return NextResponse.json(
      { error: `Deposit verification failed: ${depositCheck.reason}` },
      { status: 400 },
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
      operatorAddress,
      depositUsd,
      depositToken: "USDC",
      depositChainId: SETTLE_CHAIN_ID,
      settleChainId: SETTLE_CHAIN_ID,
      depositTxId: depositTxHash,
      escrowAddress: escrowAddress || undefined,
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

  // Record the commitment in the episode. No skipOwnershipCheck — the
  // actorId === agentAddress check above already proved ownership.
  await applyEpisodeCommand(agentAddress, episodeId, {
    type: "record-commitment",
    expectedRevision: episode.revision,
    bookingRootHash: result.rootHash,
    depositTxId: depositTxHash,
    bookedAt: new Date().toISOString(),
    idempotencyKey: `booking:${depositTxHash}`,
  });

  return NextResponse.json({
    bookingRootHash: result.rootHash,
    episodeStatus: "booked",
    attestor: recovered,
    depositTxHash,
    depositVerification: depositCheck.verified,
    escrowAddress: escrowAddress ?? null,
    message: "Booking recorded. The deposit is held in escrow on Arbitrum.",
  });
}

// GET — service discovery
export async function GET() {
  return NextResponse.json({
    service: "ardum-agent-booking",
    description:
      "Execute a retreat booking with on-chain deposit. The agent performs the USDC transfer to escrow before calling this endpoint, then submits the signed booking authorization here. The server verifies the deposit on-chain.",
    type: "free",
    endpoint: "POST /api/agent/book",
    requestSchema: {
      episodeId: "string (required) — from /api/agent/match",
      retreatRootHash: "string (required) — from /api/agent/match",
      operatorAddress: "string (required) — from /api/agent/match, non-zero",
      depositTxHash: "string (required) — on-chain tx hash of the USDC transfer",
      depositUsd: "number (required, > 0) — deposit amount in USD",
      agentAddress: "string (required) — agent's EOA address, must own the episode",
      nonce: "string (required, min 8 chars) — single-use random string",
      timestamp: "number (required) — unix seconds, within 5 min of server clock",
      signature:
        "string (required) — EIP-191 personal_sign of canonicalAgentBookingMessage",
    },
    responseSchema: {
      bookingRootHash: "string — 0G Storage root hash of the booking attestation",
      episodeStatus: "string — 'booked'",
      attestor: "string — verified agent address",
      depositTxHash: "string — on-chain deposit tx hash",
      depositVerification:
        "'full' (USDC transfer decoded + matched) | 'sender' (sender + success verified)",
      escrowAddress: "string — escrow contract address",
    },
    onchainSettlement: {
      chain: "Arbitrum Sepolia (testnet) / Arbitrum One (mainnet)",
      escrowContract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "(not deployed)",
      token: "USDC",
      tokenAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    },
    signatureFormat:
      "Sign the agent authorization message with EIP-191 personal_sign: 'Ardum agent booking authorization v2\\nepisodeId: <id>\\nretreatRootHash: <hash>\\noperatorAddress: <addr>\\ndepositTxHash: <tx>\\ndepositUsd: <amount>\\nagentAddress: <addr>\\nnonce: <nonce>\\ntimestamp: <unix-seconds>'",
    replayProtection: {
      maxTimestampSkewSeconds: 300,
      nonce: "Single-use per agentAddress; rejected if reused within the timestamp window.",
    },
  });
}
