// /api/prep-checkin — POST a post-booking MiraCheckIn response.
//
// Mirrors the existing /api/memory/route.ts pattern.
//   POST { ... } → remember this check-in response in Cognee.
//
// The written text is shaped so buildMemoryContext()/parsePriorCheckIns()
// can later extract it: the match-page stream emits a `memory` event that
// carries these prior check-ins, so a returning practitioner's letter
// opens with recognition of what they said — cross-device, no client read
// needed here. That is why there is no GET: the read path lives in the
// stream route's recallContext(), not a second parallel endpoint.
//
// When Cognee is not configured the POST is a silent no-op; the MiraCheckIn
// UI keeps localStorage as its same-device source of truth.

import { NextResponse, type NextRequest } from "next/server";

import { hasCognee, remember } from "@/lib/cognee";

export const dynamic = "force-dynamic";

type CheckInBody = {
  userId?: string;
  retreatRootHash?: string;
  retreatTitle?: string;
  day?: number;
  answer?: string;
  adaptedPlan?: string;
};

function validate(body: CheckInBody): string | null {
  if (!body.userId) return "Missing userId.";
  if (!body.retreatRootHash) return "Missing retreatRootHash.";
  if (typeof body.day !== "number") return "Missing day (number).";
  if (!body.answer || typeof body.answer !== "string") {
    return "Missing answer.";
  }
  if (!body.adaptedPlan || typeof body.adaptedPlan !== "string") {
    return "Missing adaptedPlan.";
  }
  return null;
}

// POST /api/prep-checkin
// Body: { userId, retreatRootHash, retreatTitle?, day, answer, adaptedPlan }
export async function POST(req: NextRequest) {
  let body: CheckInBody;
  try {
    body = (await req.json()) as CheckInBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const err = validate(body);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const {
    userId,
    retreatRootHash,
    retreatTitle,
    day,
    answer,
    adaptedPlan,
  } = body;

  if (!hasCognee()) {
    // Demo mode — fire-and-forget. Caller already keeps the response
    // in localStorage as the source of truth, so this is purely the
    // cross-session recall path. No-op silently.
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Cognee is not configured. Response is held in localStorage only.",
    });
  }

  const text = [
    `MiraCheckIn response on ${new Date().toISOString()}.`,
    `Retreat: ${retreatTitle ?? retreatRootHash}.`,
    `Day ${day}.`,
    `Practitioner said: "${answer}".`,
    `Mira adapted the preparation plan: "${adaptedPlan}".`,
  ].join("\n");

  await remember(userId!, text);
  return NextResponse.json({ ok: true, configured: true });
}
