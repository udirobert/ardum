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

// Mark this route as dynamic so it runs at request time.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; profile: PractitionerProfile };
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

  const attestations = await listAttestations();
  const practitioner = (await getProfile(sessionId))!;
  const agentReq: AgentRequest = {
    practitioner,
    attestations,
  };

  const { run } = await runMatchAgent(agentReq, sessionId);
  await saveMatchRun(sessionId, run);

  return NextResponse.json({ sessionId, run });
}
