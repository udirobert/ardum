import { NextResponse } from "next/server";
import { resolveActor } from "@/identity/actor";
import {
  actorProfileRepository,
  normalizePreferredName,
  type ActorProfile,
} from "@/identity/actor-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const actorId = await resolveActor();
  if (!actorId) {
    return NextResponse.json({ profile: null });
  }
  const profile = await actorProfileRepository.get(actorId);
  return NextResponse.json({ profile });
}

type UpdateBody = {
  preferredName?: string | null;
  profile?: Record<string, unknown> | null;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UpdateBody;
    const actorId = await resolveActor({ create: true });
    if (!actorId) throw new Error("Could not establish ownership.");

    const patch: Partial<ActorProfile> = {};
    if (body.preferredName !== undefined) {
      patch.preferredName = normalizePreferredName(String(body.preferredName ?? ""));
    }
    if (body.profile !== undefined) {
      patch.profile = body.profile ?? {};
    }

    const profile = await actorProfileRepository.update(actorId, patch);
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
