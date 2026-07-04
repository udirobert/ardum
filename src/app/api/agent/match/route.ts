import { NextResponse, type NextRequest } from "next/server";

import type { PractitionerProfile } from "@/calibration/schema";
import type { AgentRequest } from "@/agent/types";
import { runMatchAgent } from "@/agent/client";
import { listAttestations } from "@/lib/og-storage";
import {
  getProfile,
  newSessionId,
  saveMatchRun,
  saveProfile,
} from "@/lib/session";
import { recallContext, rememberMatch } from "@/lib/cognee";

// Mark this route as dynamic so it runs at request time.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; userId?: string; profile: PractitionerProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  if (!body.profile) {
    return NextResponse.json(
      { error: "Missing practitioner profile." },
      { status: 400 }
    );
  }

  const sessionId = body.sessionId ?? newSessionId();
  // Persist the profile before running the match — the match page will need
  // it to render the header.
  await saveProfile(sessionId, {
    ...body.profile,
    createdAt: body.profile.createdAt ?? new Date().toISOString(),
  });

  // Recall Mira's memory for this practitioner before matching. Uses the
  // persistent userId (not the ephemeral sessionId) so memory survives
  // across sessions. Graceful no-op when Cognee is not configured.
  const cogneeUserId = body.userId ?? sessionId;
  const memory = await recallContext(cogneeUserId);

  const attestations = await listAttestations();
  const practitioner = (await getProfile(sessionId))!;
  const agentReq: AgentRequest = {
    practitioner,
    attestations,
    // Pass the recalled memory into the agent prompt so the LLM can
    // reason about the practitioner's history. This is what makes
    // Cognee memory actually change the recommendation.
    memory,
  };

  const { run } = await runMatchAgent(agentReq, sessionId);
  await saveMatchRun(sessionId, run);

  // Store the top match in Cognee so future sessions can recall "what
  // has Mira recommended before?" Fire-and-forget, graceful no-op.
  const top = run.results[0];
  if (top) {
    void rememberMatch(cogneeUserId, {
      retreatTitle: top.retreatTitle,
      retreatLocation: top.retreatLocation,
      score: top.score,
      practiceStyle: top.practiceStyle,
    }).catch(() => {});
  }

  return NextResponse.json({ sessionId, run, memory });
}
