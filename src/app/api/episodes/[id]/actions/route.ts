import { NextResponse } from "next/server";
import { parseEpisodeCommand } from "@/episodes/contracts";
import { nextDecision } from "@/episodes/model";
import { applyEpisodeCommand } from "@/episodes/service";
import { resolveActor } from "@/identity/actor";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actorId = await resolveActor();
    if (!actorId) {
      return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const command = parseEpisodeCommand(body);
    const key = (body as Record<string, unknown>).idempotencyKey;
    if (key !== undefined) {
      if (typeof key !== "string" || key.length < 8 || key.length > 120) {
        throw new Error("Invalid idempotency key.");
      }
      command.idempotencyKey = key;
    }
    const result = await applyEpisodeCommand(actorId, id, command);
    return NextResponse.json({
      ...result,
      nextDecision: nextDecision(result.episode),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The action could not be completed.";
    const conflict = /changed|revision/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 400 },
    );
  }
}
