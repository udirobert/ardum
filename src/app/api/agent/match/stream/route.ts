import { NextResponse, type NextRequest } from "next/server";
import { getProfile, saveMatchRun } from "@/lib/session.edge";
import { listAttestations } from "@/lib/attestations.edge";
import { streamMatchAgent } from "@/agent/client";
import { recallContext, rememberMatch } from "@/lib/cognee";

// SSE stream of the matching agent's reasoning. Events:
//   event: memory            — Mira's recalled memory context (emitted first)
//   event: reasoning         — Gherkin step (Given/When/Then) for the audit list
//   event: compute-progress  — live { tokens, elapsedMs, model } for the header chip
//   event: done              — final MatchRun
//   event: error             — terminal failure with a human-readable message
//
// Client opens this with EventSource. Intake navigates here optimistically
// (sessionId is generated client-side); we wait briefly for the profile to
// land before erroring, so the POST /api/profile call can race the GET.

// Edge runtime — gives us 25s on Vercel Hobby instead of the 10s ceiling
// on Node serverless. The stream needs the time: 0G Compute responses
// commonly run 5–30s, and we want the full LLM trace to land. The route
// only depends on Edge-safe APIs (fetch, ReadableStream, async iterators)
// and uses the in-memory attestation cache rather than the Node-only 0G
// Storage SDK, which stays in /api/attestations.
export const runtime = "edge";
export const dynamic = "force-dynamic";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Wait briefly for a profile to land in the session store. The Intake
// page navigates here optimistically while the POST /api/profile is
// still in flight, so we race the GET against the write.
async function waitForProfile(sessionId: string, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const profile = await getProfile(sessionId);
    if (profile) return profile;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  const userId = req.nextUrl.searchParams.get("user");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  const practitioner = await waitForProfile(sessionId);
  if (!practitioner) {
    return NextResponse.json(
      { error: "Profile not found — complete calibration first." },
      { status: 404 }
    );
  }

  const attestations = await listAttestations();
  const encoder = new TextEncoder();

  // Recall Mira's memory for this practitioner before the stream starts.
  // Uses the persistent userId (not the ephemeral sessionId) so memory
  // survives across sessions. The memory context is emitted as the first
  // SSE event so the UI can show "Mira remembers you..." while the agent
  // reasons. Graceful no-op when Cognee is not configured.
  const cogneeUserId = userId ?? sessionId;
  const memory = await recallContext(cogneeUserId);

  const stream = new ReadableStream({
    async start(controller) {
      let runSaved = false;
      try {
        // Emit the memory event first — the frontend uses this to render
        // the welcome-back banner and weave memory into Mira's letter.
        controller.enqueue(
          encoder.encode(
            sseEncode("memory", {
              isReturning: memory.isReturning,
              energyHistory: memory.energyHistory,
              pastMatches: memory.pastMatches,
              pastBookings: memory.pastBookings,
              pastNotes: memory.pastNotes,
              provider: memory.provider,
            })
          )
        );

        for await (const ev of streamMatchAgent(
          { practitioner, attestations },
          sessionId,
          // Abort the upstream 0G Compute fetch when the client disconnects,
          // so we don't keep paying for tokens nobody's reading.
          req.signal
        )) {
          controller.enqueue(encoder.encode(sseEncode(ev.event, ev.data)));
          if (ev.event === "done") {
            try { await saveMatchRun(sessionId, ev.data.run); } catch {}
            runSaved = true;
            // Store the top match in Cognee memory. Fire-and-forget,
            // graceful no-op when Cognee is not configured.
            const top = ev.data.run.results[0];
            if (top) {
              void rememberMatch(cogneeUserId, {
                retreatTitle: top.retreatTitle,
                retreatLocation: top.retreatLocation,
                score: top.score,
                practiceStyle: top.practiceStyle,
              }).catch(() => {});
            }
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
