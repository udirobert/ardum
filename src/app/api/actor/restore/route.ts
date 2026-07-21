import { NextResponse } from "next/server";
import { verifyMessage } from "ethers";
import { setActorCookie } from "@/identity/actor";
import { actorProfileRepository } from "@/identity/actor-profile";

// ADR 0011 §3: cross-device restore.
//
// A practitioner on a new device signs in with Magic (getting a wallet
// address), then signs a canonical message proving ownership of that
// address. The server verifies the signature, looks up the actors row
// by external_subject, and re-signs the cookie against the existing
// actor. The practitioner's episodes and profile are now accessible
// on the new device.
//
// The canonical message includes a timestamp to prevent replay. The
// skew window is 5 minutes, matching the agent API (ADR 0009).

export const dynamic = "force-dynamic";

const RESTORE_PREFIX = "Ardum cross-device restore v1";
const SKEW_SECONDS = 300;

type RestoreBody = {
  address?: string;
  signature?: string;
  timestamp?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RestoreBody;
    const address = body.address?.trim();
    const signature = body.signature?.trim();
    const timestamp = body.timestamp;

    if (!address || !signature || typeof timestamp !== "number") {
      return NextResponse.json(
        { error: "Missing address, signature, or timestamp." },
        { status: 400 },
      );
    }

    // Replay protection: reject timestamps outside the skew window.
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > SKEW_SECONDS) {
      return NextResponse.json(
        { error: "Timestamp outside the allowed window." },
        { status: 400 },
      );
    }

    const message = canonicalRestoreMessage(address, timestamp);
    const recovered = verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: "Signature does not match the claimed address." },
        { status: 401 },
      );
    }

    const existingActorId = await actorProfileRepository.findByExternalSubject(
      address.toLowerCase(),
    );
    if (!existingActorId) {
      return NextResponse.json(
        { restored: false, error: "No existing identity found for this wallet." },
        { status: 404 },
      );
    }

    await setActorCookie(existingActorId);
    return NextResponse.json({ restored: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}

export function canonicalRestoreMessage(
  address: string,
  timestamp: number,
): string {
  return [
    RESTORE_PREFIX,
    `address: ${address}`,
    `timestamp: ${timestamp}`,
  ].join("\n");
}
