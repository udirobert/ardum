import { NextResponse } from "next/server";
import { getProfile, saveProfile, newSessionId } from "@/lib/session";
import { rememberIntake } from "@/lib/cognee";
import type { PractitionerProfile } from "@/calibration/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { sessionId?: string; userId?: string; profile: PractitionerProfile };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.profile) {
    return NextResponse.json(
      { error: "Missing practitioner profile." },
      { status: 400 }
    );
  }
  const sessionId = body.sessionId ?? newSessionId();
  await saveProfile(sessionId, {
    ...body.profile,
    createdAt: body.profile.createdAt ?? new Date().toISOString(),
  });

  // Store the intake in Cognee so Mira remembers this practitioner next time.
  // Uses the persistent userId (not the ephemeral sessionId) so memory
  // survives across sessions. Fire-and-forget — graceful no-op when Cognee
  // is not configured.
  const cogneeUserId = body.userId ?? sessionId;
  void rememberIntake(cogneeUserId, {
    energy: body.profile.energy,
    budget: body.profile.budget,
    social: body.profile.social,
    notes: body.profile.notes,
    pose: body.profile.pose
      ? {
          shoulderMobility: body.profile.pose.shoulderMobility,
          hipMobility: body.profile.pose.hipMobility,
          breathPhase: body.profile.pose.breathPhase,
        }
      : undefined,
  }).catch(() => {});

  return NextResponse.json({
    sessionId,
    profile: await getProfile(sessionId),
  });
}
