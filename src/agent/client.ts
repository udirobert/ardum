// 0G Compute Router client — SERVER ONLY. Never import from a client
// component; the API key must not leak.
//
// Two paths share the same Gherkin reasoning shape:
//   runMatchAgent       — synchronous, returns the full MatchRun
//   streamMatchAgent    — async generator that yields SSE events as the
//                         agent "thinks out loud" via the 0G Compute Router.
//
// There is no silent fallback. If OG_COMPUTE_ROUTER_URL +
// OG_COMPUTE_API_KEY are missing or the upstream call fails, both paths
// surface a clear error to the caller — Ardum either reasons on 0G
// Compute or refuses to recommend. The counterfactual and two-lens
// routes use a deterministic local scorer by design (same axes,
// re-weighted, no LLM call) and live in their own routes.

import "server-only";

import { PROMPT_VERSION, buildMatchPrompt } from "./prompts";
import type { AgentRequest, AgentResponse } from "./types";
import { has0GCompute, readServerEnv } from "@/lib/env";
import type { AttestationIndex } from "@/attestation/schema";
import type { MatchRun, MatchResult, ReasoningStep } from "@/matching/types";
import { consideringStep, contextStep } from "./score";

export type StreamEvent =
  | { event: "reasoning"; data: ReasoningStep }
  | { event: "compute-progress"; data: ComputeProgress }
  | { event: "done"; data: { run: MatchRun } }
  | { event: "error"; data: { message: string } };

// Lightweight 'is this still alive?' signal for the streaming UI. Token
// count + elapsed are felt as motion in the header chip while the LLM
// generates; they don't enter the reasoning list, so the auditable steps
// stay clean.
export type ComputeProgress = {
  tokens: number;
  elapsedMs: number;
  model: string;
};

// Maximum time the 0G Compute Router is allowed to take end-to-end before
// we abort the request. Sized to leave headroom under the platform's
// function ceiling — Vercel Hobby Edge caps stream functions at 25s,
// so we bail at 22s and emit a clean error event instead of getting
// killed mid-byte by the platform.
const COMPUTE_TIMEOUT_MS = 22_000;

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

// ─── Public API ──────────────────────────────────────────────────────────

// Common error type so the API routes can map it to a 503 with a clear
// reason rather than a generic 500.
export class ZeroGUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZeroGUnavailableError";
  }
}

export async function runMatchAgent(
  req: AgentRequest,
  practitionerId: string,
  signal?: AbortSignal
): Promise<AgentResponse> {
  if (!has0GCompute()) {
    throw new ZeroGUnavailableError(
      "0G Compute Router is not configured. Ardum reasons on 0G or not at all."
    );
  }

  try {
    const llm = await callComputeRouter(req, signal);
    const results = mapLLMResults(llm, req.attestations);
    if (results.length === 0) {
      throw new Error("0G Compute returned no usable results.");
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
    console.error("[ardum] 0G Compute Router failed:", err);
    throw new ZeroGUnavailableError(
      err instanceof Error
        ? `0G Compute Router failed: ${err.message}`
        : "0G Compute Router failed."
    );
  }
}

// Async generator that yields SSE events. The 0G Compute path streams
// tokens from the router, emits structured reasoning steps once the JSON
// is parsed, then yields a final 'done' event.
//
// A bounded timeout + the caller's AbortSignal cancel the upstream fetch
// on disconnect or stall. If 0G isn't configured or the call fails, we
// yield a single 'error' event — no silent fallback to a deterministic
// scorer. Ardum reasons on 0G or refuses to recommend.
export async function* streamMatchAgent(
  req: AgentRequest,
  practitionerId: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  if (!has0GCompute()) {
    yield {
      event: "error",
      data: {
        message:
          "0G Compute Router is not configured. Ardum reasons on 0G or not at all.",
      },
    };
    return;
  }

  // Compose the caller's signal with a timeout.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(),
    COMPUTE_TIMEOUT_MS
  );

  try {
    const env = readServerEnv();

    // Lead with the agent's context — the practitioner profile and the
    // size of the attestation pool the reasoning will draw from.
    yield {
      event: "reasoning",
      data: contextStep({
        practitioner: req.practitioner,
        attestationCount: req.attestations.length,
      }),
    };

    // Background-pump the LLM stream into a shared buffer. The outer
    // generator drives the user-facing pacing (pool scan + progress
    // events) while this pump fills `accumulated`.
    let accumulated = "";
    let tokenCount = 0;
    let llmDone = false;
    let llmError: unknown = null;
    const startMs = Date.now();
    const pump = (async () => {
      try {
        for await (const delta of withAbort(
          streamComputeRouter(req, controller.signal),
          controller.signal
        )) {
          accumulated += delta;
          tokenCount++;
        }
      } catch (err) {
        llmError = err;
      } finally {
        llmDone = true;
      }
    })();

    // Walk the attestation pool in pool order while the LLM generates,
    // so the user feels the agent considering each retreat instead of
    // staring at a generic loading state. Cadence is paced to roughly
    // fill the typical generation window; if the LLM finishes early,
    // remaining bullets stream out quickly afterwards.
    const considering = req.attestations;
    let consideringIdx = 0;
    let lastProgressTokens = -1;
    const POOL_TICK_MS = 350;
    const PROGRESS_TICK_MS = 180;
    let lastPoolTick = Date.now();
    let lastProgressTick = Date.now();

    while (!llmDone) {
      // Yield to the event loop in small slices so we can interleave
      // both pool ticks and progress ticks without big delays.
      await sleep(60, controller.signal);
      const now = Date.now();

      if (
        tokenCount !== lastProgressTokens &&
        now - lastProgressTick >= PROGRESS_TICK_MS
      ) {
        yield {
          event: "compute-progress",
          data: {
            tokens: tokenCount,
            elapsedMs: now - startMs,
            model: env.OG_COMPUTE_MODEL,
          },
        };
        lastProgressTokens = tokenCount;
        lastProgressTick = now;
      }

      if (
        consideringIdx < considering.length &&
        now - lastPoolTick >= POOL_TICK_MS
      ) {
        yield {
          event: "reasoning",
          data: consideringStep(considering[consideringIdx].title),
        };
        consideringIdx++;
        lastPoolTick = now;
      }
    }

    await pump;
    if (llmError) {
      throw llmError instanceof Error ? llmError : new Error(String(llmError));
    }

    // Emit a final progress beat so the chip lands on the true total.
    yield {
      event: "compute-progress",
      data: {
        tokens: tokenCount,
        elapsedMs: Date.now() - startMs,
        model: env.OG_COMPUTE_MODEL,
      },
    };

    // Flush any remaining considering bullets quickly (LLM finished
    // before we walked the whole pool).
    while (consideringIdx < considering.length) {
      yield {
        event: "reasoning",
        data: consideringStep(considering[consideringIdx].title),
      };
      consideringIdx++;
      await sleep(80, controller.signal);
    }

    const llm = extractJSON(accumulated);
    const results = mapLLMResults(llm, req.attestations);
    if (results.length === 0) {
      throw new Error("0G Compute returned no usable results.");
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
  } catch (err) {
    const aborted = (err as Error)?.message === "aborted";
    const message = aborted
      ? "0G Compute Router timed out or the request was cancelled."
      : err instanceof Error
        ? `0G Compute Router failed: ${err.message}`
        : "0G Compute Router failed.";
    console.error("[ardum] stream failed:", err);
    yield { event: "error", data: { message } };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
