// 0G Compute Router client — SERVER ONLY. Never import from a client
// component; the API key must not leak.
//
// Two paths share the same scoring logic in ./score.ts:
//   runMatchAgent       — synchronous, returns the full MatchRun
//   streamMatchAgent    — async generator that yields SSE events as the
//                         agent "thinks out loud".
//
// In demo mode (no OG_COMPUTE_* env vars) the deterministic local matcher
// runs. When OG_COMPUTE_ROUTER_URL + OG_COMPUTE_API_KEY are set, the agent
// calls the 0G Compute Router (OpenAI-compatible /v1/chat/completions)
// and maps the LLM's structured response to the same MatchRun shape.
// If the LLM call fails, we fall back to the deterministic scorer so the
// user always gets a match — the agentTrace.provider field records which
// path ran.

import "server-only";

import { PROMPT_VERSION, buildMatchPrompt } from "./prompts";
import type { AgentRequest, AgentResponse } from "./types";
import { has0GCompute, readServerEnv } from "@/lib/env";
import type { AttestationIndex } from "@/attestation/schema";
import type { MatchRun, MatchResult, ReasoningStep } from "@/matching/types";
import { scoreAll, consideringStep, contextStep } from "./score";

export type StreamEvent =
  | { event: "reasoning"; data: ReasoningStep }
  | { event: "done"; data: { run: MatchRun } }
  | { event: "error"; data: { message: string } };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── LLM response types ──────────────────────────────────────────────────

type LLMResult = {
  retreatRootHash: string;
  score: number;
  headline: string;
  reasoning: ReasoningStep[];
};

type LLMResponse = {
  results: LLMResult[];
};

// ─── LLM → MatchResult mapping ───────────────────────────────────────────

function mapLLMResults(
  llm: LLMResponse,
  attestations: AttestationIndex[]
): MatchResult[] {
  const byRootHash = new Map(attestations.map((a) => [a.rootHash, a]));
  return (llm.results ?? [])
    .map((r): MatchResult | null => {
      const att = byRootHash.get(r.retreatRootHash);
      if (!att) return null; // LLM invented a retreat — skip it
      return {
        id: att.rootHash,
        retreatRootHash: att.rootHash,
        retreatTitle: att.title,
        retreatDescription: att.description,
        retreatLocation: att.claims.location,
        durationDays: att.claims.durationDays,
        priceUsd: att.claims.priceUsd,
        capacity: att.claims.capacity,
        practiceStyle: att.claims.practiceStyle,
        score: Math.max(0, Math.min(1, r.score)),
        headline: r.headline,
        reasoning: r.reasoning,
        attestationCount: 1,
        attestor: att.attestor,
        attestedAt: att.createdAt,
      };
    })
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score);
}

// ─── JSON extraction ─────────────────────────────────────────────────────

function extractJSON(text: string): LLMResponse {
  // Try direct parse first.
  try {
    return JSON.parse(text) as LLMResponse;
  } catch {
    // Try extracting from a markdown fence.
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      return JSON.parse(fence[1]) as LLMResponse;
    }
    // Try slicing from the first { to the last }.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1)) as LLMResponse;
    }
    throw new Error("LLM response was not valid JSON.");
  }
}

// ─── 0G Compute Router: non-streaming call ───────────────────────────────

async function callComputeRouter(req: AgentRequest): Promise<LLMResponse> {
  const env = readServerEnv();
  const prompt = buildMatchPrompt(req);
  const url = `${env.OG_COMPUTE_ROUTER_URL.replace(/\/$/, "")}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OG_COMPUTE_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OG_COMPUTE_MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `0G Compute Router returned ${res.status}: ${body.slice(0, 300)}`
    );
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("0G Compute Router returned an empty response.");
  }
  return extractJSON(content);
}

// ─── 0G Compute Router: streaming call ───────────────────────────────────

async function* streamComputeRouter(
  req: AgentRequest
): AsyncGenerator<string> {
  const env = readServerEnv();
  const prompt = buildMatchPrompt(req);
  const url = `${env.OG_COMPUTE_ROUTER_URL.replace(/\/$/, "")}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OG_COMPUTE_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OG_COMPUTE_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `0G Compute Router returned ${res.status}: ${body.slice(0, 300)}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Skip malformed chunks — the stream may include keep-alive lines.
      }
    }
  }
}

// ─── Deterministic fallback ──────────────────────────────────────────────

function deterministicRun(
  req: AgentRequest,
  practitionerId: string,
  provider = "stub",
  model = "deterministic-local"
): MatchRun {
  const ranked = scoreAll(req.practitioner, req.attestations);
  return {
    practitionerId,
    generatedAt: new Date().toISOString(),
    agentTrace: {
      provider,
      model,
      promptVersion: PROMPT_VERSION,
      attestationsConsidered: req.attestations.length,
    },
    results: ranked.map((s) => s.result),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function runMatchAgent(
  req: AgentRequest,
  practitionerId: string
): Promise<AgentResponse> {
  if (!has0GCompute()) {
    return { run: deterministicRun(req, practitionerId) };
  }

  try {
    const llm = await callComputeRouter(req);
    const results = mapLLMResults(llm, req.attestations);
    if (results.length === 0) {
      throw new Error("LLM returned no valid results.");
    }
    const env = readServerEnv();
    const run: MatchRun = {
      practitionerId,
      generatedAt: new Date().toISOString(),
      agentTrace: {
        provider: "0g-compute",
        model: env.OG_COMPUTE_MODEL,
        promptVersion: PROMPT_VERSION,
        attestationsConsidered: req.attestations.length,
      },
      results,
    };
    return { run };
  } catch (err) {
    console.error(
      "[ardum] 0G Compute Router failed, falling back to local scorer:",
      err
    );
    return {
      run: deterministicRun(
        req,
        practitionerId,
        "0g-compute-fallback",
        "deterministic-local"
      ),
    };
  }
}

// Async generator that yields SSE events. The stub path adds pacing delays
// so the streaming UX feels like a real LLM token stream; the real 0G
// Compute path streams tokens from the router, then emits structured
// reasoning steps once the full JSON response is parsed.
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

      for (const { result } of scored) {
        yield {
          event: "reasoning",
          data: consideringStep(result.retreatTitle),
        };
        await sleep(220);
      }

      const top = scored[0];
      for (const step of top.steps) {
        yield { event: "reasoning", data: step };
        await sleep(550);
      }

      yield {
        event: "done",
        data: { run: deterministicRun(req, practitionerId) },
      };
      return;
    }

    // Real 0G Compute Router path.
    yield {
      event: "reasoning",
      data: contextStep({
        practitioner: req.practitioner,
        attestationCount: req.attestations.length,
      }),
    };

    try {
      // Stream the LLM response, accumulating tokens while yielding
      // periodic progress steps so the client sees activity during the
      // LLM's generation.
      const env = readServerEnv();
      let accumulated = "";
      let tokenCount = 0;
      for await (const delta of streamComputeRouter(req)) {
        accumulated += delta;
        tokenCount++;
        if (tokenCount % 25 === 0) {
          yield {
            event: "reasoning",
            data: {
              axis: "generating",
              given: `streaming from ${env.OG_COMPUTE_MODEL}`,
              when: `${tokenCount} tokens received`,
              then: "assembling response…",
              weight: 0,
            },
          };
        }
      }

      const llm = extractJSON(accumulated);
      const results = mapLLMResults(llm, req.attestations);
      if (results.length === 0) {
        throw new Error("LLM returned no valid results.");
      }

      // Emit "considering" headers for each retreat, ordered by rank.
      for (const result of results) {
        yield {
          event: "reasoning",
          data: consideringStep(result.retreatTitle),
        };
        await sleep(150);
      }

      // Stream the detailed reasoning for the top match.
      const top = results[0];
      for (const step of top.reasoning) {
        yield { event: "reasoning", data: step };
        await sleep(300);
      }

      const run: MatchRun = {
        practitionerId,
        generatedAt: new Date().toISOString(),
        agentTrace: {
          provider: "0g-compute",
          model: env.OG_COMPUTE_MODEL,
          promptVersion: PROMPT_VERSION,
          attestationsConsidered: req.attestations.length,
        },
        results,
      };
      yield { event: "done", data: { run } };
    } catch (innerErr) {
      // Fall back to deterministic scorer so the user still gets a match.
      console.error(
        "[ardum] 0G Compute Router failed, falling back to local scorer:",
        innerErr
      );
      const scored = scoreAll(req.practitioner, req.attestations);

      for (const { result } of scored) {
        yield {
          event: "reasoning",
          data: consideringStep(result.retreatTitle),
        };
        await sleep(150);
      }

      const top = scored[0];
      for (const step of top.steps) {
        yield { event: "reasoning", data: step };
        await sleep(300);
      }

      yield {
        event: "done",
        data: {
          run: deterministicRun(
            req,
            practitionerId,
            "0g-compute-fallback",
            "deterministic-local"
          ),
        },
      };
    }
  } catch (err) {
    yield {
      event: "error",
      data: {
        message: err instanceof Error ? err.message : "Stream failed.",
      },
    };
  }
}
