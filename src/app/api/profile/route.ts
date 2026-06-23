import { NextResponse } from "next/server";
import { getProfile, saveProfile, newSessionId } from "@/lib/session";
import type { PractitionerProfile } from "@/calibration/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { sessionId?: string; profile: PractitionerProfile };
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
  saveProfile(sessionId, {
    ...body.profile,
    createdAt: body.profile.createdAt ?? new Date().toISOString(),
  });
  return NextResponse.json({
    sessionId,
    profile: getProfile(sessionId),
  });
}
