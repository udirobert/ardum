import { NextResponse, type NextRequest } from "next/server";
import { getProfile, saveMatchRun } from "@/lib/session";
import { listAttestations } from "@/lib/og-storage";
import { streamMatchAgent } from "@/agent/client";

// SSE stream of the matching agent's reasoning. Each event has the shape:
//   event: reasoning
//   data:  { axis, given, when, then, weight }
//   event: done
//   data:  { run: MatchRun }
//   event: error
//   data:  { message }
//
// Client opens this with EventSource after Intake POSTs to /api/profile.
// The agent "thinks out loud" — each reasoning step arrives as the agent
// produces it.

export const dynamic = "force-dynamic";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  const practitioner = getProfile(sessionId);
  if (!practitioner) {
    return NextResponse.json(
      { error: "Profile not found — complete calibration first." },
      { status: 404 }
    );
  }

  const attestations = await listAttestations();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let runSaved = false;
      try {
        for await (const ev of streamMatchAgent(
          { practitioner, attestations },
          sessionId
        )) {
          controller.enqueue(encoder.encode(sseEncode(ev.event, ev.data)));
          if (ev.event === "done") {
            try { saveMatchRun(sessionId, ev.data.run); } catch {}
            runSaved = true;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed.";
        controller.enqueue(
          encoder.encode(sseEncode("error", { message }))
        );
      } finally {
        // Tell the client to reconnect=false if the stream ended without
        // a 'done' event (something went wrong mid-stream).
        if (!runSaved) {
          controller.enqueue(
            encoder.encode(`event: end\ndata: {"ok":false}\n\n`)
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // Disable proxy buffering so events arrive in real time.
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
