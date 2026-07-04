// POST /api/memory/feedback — store a feedback signal in Cognee memory
// and trigger improve() to enrich the graph.
//
// This is the endpoint that closes the remember → recall → improve loop.
// Every interaction that reveals a preference shift (ChangedMyMind,
// WhyNotThisOne, Counterfactual, Perspectives) fires this endpoint so
// the graph gets richer without the user visiting a settings page.
//
// Fire-and-forget from the client. Graceful no-op when Cognee is not
// configured.

import { NextResponse, type NextRequest } from "next/server";
import { remember, improve, hasCognee } from "@/lib/cognee";

export const dynamic = "force-dynamic";

type FeedbackBody = {
  userId?: string;
  // The type of feedback signal — used for logging and graph context.
  type: "changed-mind" | "why-not" | "counterfactual" | "perspectives";
  // A human-readable description of what the user did or expressed.
  // This is the text that gets stored in Cognee as memory.
  description: string;
  // Optional structured details (which signal changed, which preset, etc.)
  details?: Record<string, string | number>;
};

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.userId || !body.type || !body.description) {
    return NextResponse.json(
      { error: "Missing userId, type, or description." },
      { status: 400 },
    );
  }

  if (!hasCognee()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Cognee not configured. Feedback not stored.",
    });
  }

  // Build the memory text — include the type and details so the graph
  // has rich context to extract entities and relationships from.
  const detailsStr = body.details
    ? ` Details: ${JSON.stringify(body.details)}`
    : "";
  const memoryText = `[${body.type}] ${body.description}.${detailsStr}`;

  // Store the feedback signal, then improve the graph. Both are
  // fire-and-forget — the client doesn't wait on either.
  await remember(body.userId, memoryText);
  await improve(body.userId);

  return NextResponse.json({
    ok: true,
    configured: true,
    message: "Feedback stored and graph improved.",
  });
}
