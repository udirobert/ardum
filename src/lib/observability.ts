// ── Structured observability ─────────────────────────────────────────
//
// Ardum has several async paths that can fail silently: the automation
// runner (monitoring ticks, hold expiry), the commitment provider
// (on-chain deposit verification, 0G attestation writes), the agent API
// booking flow, and fire-and-forget semantic memory (Cognee). The
// architecture doc covers failure *behavior* (episode stays usable,
// retries repeat only the failed idempotent operation) but runtime
// *visibility* into those failures was undocumented.
//
// This module provides a single structured-logging entrypoint that:
//   - emits JSON to stdout (parseable by any log aggregator);
//   - tags every event with a component, outcome, and correlation id;
//   - never throws (observability must not break the path it observes);
//   - strips sensitive fields (intention text, wallet addresses are
//     truncated to 10 chars, tokens are never logged).
//
// The design is deliberately framework-agnostic: no Pino, no Winston, no
// OpenTelemetry SDK dependency. If the project later adopts a hosted
// observability stack, the `sink` function can be swapped in one place.
// Until then, structured JSON to stdout is enough for local dev, Docker
// logs, and any platform that ingests stdout (Vercel, Fly, Railway).
//
// Usage:
//
//   import { log } from "@/lib/observability";
//
//   log.info("automation.tick", { checked: 3, failed: 0 });
//   log.warn("automation.tick_failed", { episodeId, error: "revision mismatch" });
//   log.error("agent.book.deposit_verify_failed", { episodeId, txHash, reason });
//
// The correlation id (`correlationId`) is threaded through API responses
// so a practitioner reporting "my booking failed" can give support a
// traceable id without exposing wallet or intention data.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  /** ISO timestamp. */
  ts: string;
  level: LogLevel;
  /** Dot-namespaced event name: component.action.outcome. */
  event: string;
  /** Structured payload. Sensitive fields are sanitized by sanitize(). */
  data?: Record<string, unknown>;
  /** Correlation id for tracing across services. */
  correlationId?: string;
};

// ─── Sink ────────────────────────────────────────────────────────────

type Sink = (event: LogEvent) => void;

const defaultSink: Sink = (event) => {
  // Use JSON.stringify for structured output. stderr for warn/error so
  // platform log filters can separate them; stdout for info/debug.
  const line = JSON.stringify(event);
  if (event.level === "error" || event.level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
};

// Allow tests to override the sink without polluting the module surface.
let activeSink: Sink = defaultSink;

export function setLogSink(sink: Sink): void {
  activeSink = sink;
}

export function resetLogSink(): void {
  activeSink = defaultSink;
}

// ─── Sanitization ───────────────────────────────────────────────────

// Fields that must never appear in logs. If present, they are dropped.
const BLOCKED_FIELDS = new Set([
  "statement",
  "intention",
  "intentionStatement",
  "desiredShift",
  "signature",
  "token",
  "shareToken",
  "inviteToken",
  "sessionKey",
  "privateKey",
  "mnemonic",
  "seedPhrase",
]);

// Fields that contain addresses or hashes — truncate to a prefix so the
// entry is correlatable but not fully exposed.
const TRUNCATED_FIELDS = new Set([
  "actorId",
  "agentAddress",
  "operatorAddress",
  "walletAddress",
  "address",
  "bookingRootHash",
  "retreatRootHash",
  "depositTxHash",
  "depositTxId",
  "bookingRootHash",
]);

function truncate(value: string): string {
  if (value.length <= 10) return value.slice(0, 4) + "…";
  return value.slice(0, 10) + "…";
}

function sanitize(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (BLOCKED_FIELDS.has(key)) continue;
    if (TRUNCATED_FIELDS.has(key) && typeof value === "string") {
      clean[key] = truncate(value);
      continue;
    }
    // Recursively sanitize nested objects (one level).
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      clean[key] = sanitize(value as Record<string, unknown>);
      continue;
    }
    if (Array.isArray(value)) {
      clean[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? sanitize(item as Record<string, unknown>)
          : item,
      );
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

// ─── Logger ──────────────────────────────────────────────────────────

function emit(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>,
  correlationId?: string,
): void {
  try {
    const logEvent: LogEvent = {
      ts: new Date().toISOString(),
      level,
      event,
      data: data ? sanitize(data) : undefined,
      correlationId,
    };
    activeSink(logEvent);
  } catch {
    // Observability must never break the path it observes.
    // If the sink throws (e.g. a full disk), swallow silently.
  }
}

export const log = {
  debug(event: string, data?: Record<string, unknown>, correlationId?: string): void {
    emit("debug", event, data, correlationId);
  },
  info(event: string, data?: Record<string, unknown>, correlationId?: string): void {
    emit("info", event, data, correlationId);
  },
  warn(event: string, data?: Record<string, unknown>, correlationId?: string): void {
    emit("warn", event, data, correlationId);
  },
  error(event: string, data?: Record<string, unknown>, correlationId?: string): void {
    emit("error", event, data, correlationId);
  },
};

// ─── Correlation id ──────────────────────────────────────────────────

// Generates a short, opaque correlation id for request tracing. Not
// cryptographically random — its job is uniqueness within a log stream,
// not security. Uses crypto.randomUUID when available, falls back to a
// timestamp + random number for environments without it.
export function generateCorrelationId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    // fall through
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
