import { NextResponse } from "next/server";
import { parseInviteResponse } from "@/episodes/contracts";
import { episodeRepository } from "@/episodes/repository";
import { hashInviteToken } from "@/episodes/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invite = await episodeRepository.getInvite(hashInviteToken(token));
  if (!invite || new Date(invite.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Invitation expired or not found." }, { status: 404 });
  }
  // Public invitation payload is deliberately narrow. It excludes the
  // intention statement, private constraints, actor identity, and history.
  return NextResponse.json({
    invitation: {
      participantName: invite.participantName,
      expiresAt: invite.expiresAt,
      responded: Boolean(invite.respondedAt),
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const parsed = parseInviteResponse(await request.json());
    const now = new Date();
    const episode = await episodeRepository.respondToInvite(
      hashInviteToken(token),
      {
        participantId: crypto.randomUUID(),
        decision: parsed.decision,
        note: parsed.note,
        respondedAt: now.toISOString(),
      },
    );
    return NextResponse.json({ ok: true, status: episode.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not respond." },
      { status: 400 },
    );
  }
}
