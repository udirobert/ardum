// Memory API — the frontend's interface to Mira's Cognee memory layer.
//
// Three actions:
//   GET  /api/memory?userId=...     → recall what Mira knows about this practitioner
//   POST /api/memory/improve        → run enrichment on the practitioner's graph
//   POST /api/memory/forget         → surgically wipe the practitioner's memory
//
// All routes are server-only. The Cognee API key never reaches the client.
// When Cognee is not configured, recall returns an empty memory context
// (isReturning: false) and improve/forget are no-ops — the app still works.

import { NextResponse, type NextRequest } from "next/server";

import {
  EMPTY_MEMORY,
  forget,
  hasCognee,
  improve,
  recallContext,
} from "@/lib/cognee";

export const dynamic = "force-dynamic";

// GET /api/memory?userId=... — recall Mira's memory for a practitioner.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId parameter." },
      { status: 400 },
    );
  }

  if (!hasCognee()) {
    // Demo mode — no persistent memory. Return the empty context so the
    // frontend can show "Mira doesn't have any memories yet" gracefully.
    return NextResponse.json({
      ...EMPTY_MEMORY,
      configured: false,
    });
  }

  const memory = await recallContext(userId);
  return NextResponse.json({
    ...memory,
    configured: true,
  });
}

// POST /api/memory with { action: "improve" | "forget", userId }
export async function POST(req: NextRequest) {
  let body: { action?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!body.action) {
    return NextResponse.json(
      { error: "Missing action. Use 'improve' or 'forget'." },
      { status: 400 },
    );
  }

  if (!hasCognee()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Cognee is not configured. No-op in demo mode.",
    });
  }

  if (body.action === "improve") {
    if (!body.userId) {
      return NextResponse.json(
        { error: "Missing userId for improve." },
        { status: 400 },
      );
    }
    await improve(body.userId);
    return NextResponse.json({
      ok: true,
      configured: true,
      message: "Memory enriched. Mira's graph has been refined.",
    });
  }

  if (body.action === "forget") {
    if (!body.userId) {
      return NextResponse.json(
        { error: "Missing userId for forget." },
        { status: 400 },
      );
    }
    await forget(body.userId);
    return NextResponse.json({
      ok: true,
      configured: true,
      message: "Mira has forgotten everything about this practitioner.",
    });
  }

  return NextResponse.json(
    { error: `Unknown action: ${body.action}. Use 'improve' or 'forget'.` },
    { status: 400 },
  );
}
