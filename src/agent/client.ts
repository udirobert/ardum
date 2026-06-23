// 0G Compute Router client — SERVER ONLY. Never import from a client
// component; the API key must not leak.
//
// Two paths share the same scoring logic in ./score.ts:
//   runMatchAgent       — synchronous, returns the full MatchRun
//   streamMatchAgent    — async generator that yields SSE events as the
//                         agent "thinks out loud". Adds small delays
//                         between reasoning steps so the stub feels
//                         paced like a real LLM stream.
//
// In demo mode (no OG_COMPUTE_* env vars) the deterministic local matcher
// runs; the prompt is built but the real 0G Compute call is gated and
// throws loudly when configured-but-unimplemented.

import "server-only";

import { PROMPT_VERSION, buildMatchPrompt } from "./prompts";
import type { AgentRequest, AgentResponse } from "./types";
import { has0GCompute } from "@/lib/env";
import type { MatchRun, ReasoningStep } from "@/matching/types";
import { scoreAll, consideringStep, contextStep } from "./score";

export type StreamEvent =
  | { event: "reasoning"; data: ReasoningStep }
  | { event: "done"; data: { run: MatchRun } }
  | { event: "error"; data: { message: string } };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runMatchAgent(
  req: AgentRequest,
  practitionerId: string
): Promise<AgentResponse> {
  if (!has0GCompute()) {
    const ranked = scoreAll(req.practitioner, req.attestations);
    const run: MatchRun = {
      practitionerId,
      generatedAt: new Date().toISOString(),
      agentTrace: {
        provider: "stub",
        model: "deterministic-local",
        promptVersion: PROMPT_VERSION,
        attestationsConsidered: req.attestations.length,
      },
      results: ranked.map((s) => s.result),
    };
    return { run };
  }

  // Real 0G Compute Router call — wired but disabled. The prompt is ready.
  const prompt = buildMatchPrompt(req);
  void prompt;
  throw new Error(
    "0G Compute Router integration is wired but disabled. Set OG_COMPUTE_ROUTER_URL " +
      "and OG_COMPUTE_API_KEY, then implement the streaming call in src/agent/client.ts " +
      "(see streamMatchAgent below — that's the shape the real LLM call should produce)."
  );
}

// Async generator that yields SSE events. The stub path adds pacing delays
// so the streaming UX feels like a real LLM token stream; the real path
// should yield events as tokens arrive from the upstream.
export async function* streamMatchAgent(
  req: AgentRequest,
  practitionerId: string
): AsyncGenerator<StreamEvent> {
  try {
    if (!has0GCompute()) {
      // Demo path — paced stub.
      yield {
        event: "reasoning",
        data: contextStep({
          practitioner: req.practitioner,
          attestationCount: req.attestations.length,
        }),
      };
      await sleep(450);

      const scored = scoreAll(req.practitioner, req.attestations);

      // Emit a "considering X" header for each retreat, ordered by rank.
      // This gives the user a sense of the agent actually looking at every
      // option, not just snapping to the winner.
      for (const { result } of scored) {
        yield {
          event: "reasoning",
          data: consideringStep(result.retreatTitle),
        };
        await sleep(220);
      }

      // Now stream the detailed reasoning for the top match.
      const top = scored[0];
      for (const step of top.steps) {
        yield { event: "reasoning", data: step };
        await sleep(550);
      }

      const run: MatchRun = {
        practitionerId,
        generatedAt: new Date().toISOString(),
        agentTrace: {
          provider: "stub",
          model: "deterministic-local",
          promptVersion: PROMPT_VERSION,
          attestationsConsidered: req.attestations.length,
        },
        results: scored.map((s) => s.result),
      };
      yield { event: "done", data: { run } };
      return;
    }

    // Real 0G Compute Router streaming path — emit tokens as they arrive.
    // Uncomment + implement when keys are available. The shape MUST match
    // StreamEvent above; the route handler treats 'reasoning' as a step and
    // 'done' as the final payload.
    const prompt = buildMatchPrompt(req);
    void prompt;
    throw new Error(
      "0G Compute Router streaming integration is wired but disabled. " +
        "Implement the fetch against OG_COMPUTE_ROUTER_URL here."
    );
  } catch (err) {
    yield {
      event: "error",
      data: {
        message: err instanceof Error ? err.message : "Stream failed.",
      },
    };
  }
}
