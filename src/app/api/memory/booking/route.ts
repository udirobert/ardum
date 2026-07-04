// POST /api/memory/booking — store a booking in Cognee memory.
//
// Called from the ConversationalBooking component when the deposit
// confirms. Fire-and-forget — the booking flow doesn't wait on this.
// Graceful no-op when Cognee is not configured.

import { NextResponse } from "next/server";
import { rememberBooking, hasCognee } from "@/lib/cognee";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    userId?: string;
    retreatTitle?: string;
    retreatLocation?: string;
    depositUsd?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!body.userId || !body.retreatTitle) {
    return NextResponse.json(
      { error: "Missing userId or retreatTitle." },
      { status: 400 },
    );
  }

  if (!hasCognee()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Cognee not configured. Booking not stored in memory.",
    });
  }

  await rememberBooking(body.userId, {
    retreatTitle: body.retreatTitle,
    retreatLocation: body.retreatLocation ?? "",
    depositUsd: body.depositUsd ?? 0,
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    message: "Booking stored in Mira's memory.",
  });
}
