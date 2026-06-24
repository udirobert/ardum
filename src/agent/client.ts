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

// Maximum time the 0G Compute Router is allowed to take end-to-end before
// we abort and fall back to the local scorer. Keeps the SSE stream bounded
// so a hung upstream can never freeze the user's match page.
const COMPUTE_TIMEOUT_MS = 30_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true }
    );
  });
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

async function callComputeRouter(
  req: AgentRequest,
  signal?: AbortSignal
): Promise<LLMResponse> {
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
    signal,
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
  req: AgentRequest,
  signal?: AbortSignal
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
    signal,
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

// Race an async iterable against an AbortSignal. Lets the outer timeout
// cancel mid-stream iterations cleanly instead of waiting for the LLM
// to finish on its own.
async function* withAbort<T>(
  source: AsyncIterable<T>,
  signal?: AbortSignal
): AsyncGenerator<T> {
  if (signal?.aborted) throw new Error("aborted");
  // Wrap each next() in a race so cancellation is responsive between
  // token yields. Async iterators don't compose with AbortSignal natively.
  const it = source[Symbol.asyncIterator]();
  const abort = new Promise<never>((_, reject) => {
    if (!signal) return;
    signal.addEventListener(
      "abort",
      () => reject(new Error("aborted")),
      { once: true }
    );
  });
  try {
    while (true) {
      const next = await Promise.race([it.next(), abort]);
      if (next.done) return;
      yield next.value;
    }
  } finally {
    if (it.return) await it.return(undefined);
  }
}

// ─── Deterministic fallback ──────────────────────────────────────────────

function deterministicRun(
  req: AgentRequest,
  practitionerId: string,
  provider: "local" | "0g-compute-fallback" = "local",
  model?: string
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
  practitionerId: string,
  signal?: AbortSignal
): Promise<AgentResponse> {
  if (!has0GCompute()) {
    return { run: deterministicRun(req, practitionerId) };
  }

  try {
    const llm = await callComputeRouter(req, signal);
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
    if ((err as Error)?.message === "aborted") throw err;
    console.error(
      "[ardum] 0G Compute Router failed, falling back to local scorer:",
      err
    );
    return {
      run: deterministicRun(req, practitionerId, "0g-compute-fallback"),
    };
  }
}

// Async generator that yields SSE events. The stub path adds pacing delays
// so the streaming UX feels like a real LLM token stream; the real 0G
// Compute path streams tokens from the router, then emits structured
// reasoning steps once the full JSON response is parsed.
//
// A bounded timeout + the caller's AbortSignal cancel the upstream fetch
// on disconnect or stall, after which we fall back to the local scorer so
// the user always gets a match.
export async function* streamMatchAgent(
  req: AgentRequest,
  practitionerId: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  // Compose the caller's signal with a timeout.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(),
    COMPUTE_TIMEOUT_MS
  );

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
      await sleep(450, controller.signal);

      const scored = scoreAll(req.practitioner, req.attestations);

      for (const { result } of scored) {
        yield {
          event: "reasoning",
          data: consideringStep(result.retreatTitle),
        };
        await sleep(220, controller.signal);
      }

      const top = scored[0];
      for (const step of top.steps) {
        yield { event: "reasoning", data: step };
        await sleep(550, controller.signal);
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
      for await (const delta of withAbort(
        streamComputeRouter(req, controller.signal),
        controller.signal
      )) {
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
        await sleep(150, controller.signal);
      }

      // Stream the detailed reasoning for the top match.
      const top = results[0];
      for (const step of top.reasoning) {
        yield { event: "reasoning", data: step };
        await sleep(300, controller.signal);
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
      if ((innerErr as Error)?.message === "aborted") {
        // Caller disconnected (or we hit the timeout). Fall through to
        // local scorer so the still-connected user has something to see.
        console.warn(
          "[ardum] 0G Compute Router aborted, falling back to local scorer."
        );
      } else {
        console.error(
          "[ardum] 0G Compute Router failed, falling back to local scorer:",
          innerErr
        );
      }
      const scored = scoreAll(req.practitioner, req.attestations);

      for (const { result } of scored) {
        yield {
          event: "reasoning",
          data: consideringStep(result.retreatTitle),
        };
        await sleep(150, controller.signal);
      }

      const top = scored[0];
      for (const step of top.steps) {
        yield { event: "reasoning", data: step };
        await sleep(300, controller.signal);
      }

      yield {
        event: "done",
        data: {
          run: deterministicRun(req, practitionerId, "0g-compute-fallback"),
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
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
