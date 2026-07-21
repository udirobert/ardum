import { NextResponse } from "next/server";
import { resolveActor } from "@/identity/actor";
import { actorProfileRepository } from "@/identity/actor-profile";

// ADR 0011 §2: attach a provider subject (Magic wallet address) to the
// actor row. Called by the client after Magic login succeeds. The server
// resolves the actor from the signed cookie; the wallet address is the
// external_subject. Cross-device restore (§3) will verify ownership of
// the subject via signature before re-attaching a new cookie to the row.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subject?: string };
    const subject = body.subject?.trim();
    if (!subject) {
      return NextResponse.json(
        { error: "Missing subject." },
        { status: 400 },
      );
    }
    const actorId = await resolveActor({ create: true });
    if (!actorId) throw new Error("Could not establish ownership.");
    await actorProfileRepository.attachExternalSubject(actorId, subject);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
