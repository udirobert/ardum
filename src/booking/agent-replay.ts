import "server-only";

// Replay protection for agent API signatures. Each agent signature carries a
// nonce + timestamp; the timestamp must be within `MAX_SKEW_SECONDS` of the
// server clock, and each nonce may be used at most once within that window.
//
// Two backing stores:
//   - Supabase (shared, durable): when configured, the nonce is consumed via
//     an atomic INSERT that fails on PK conflict. This is correct for
//     multi-instance / serverless deployments where each function invocation
//     may be a separate process.
//   - In-memory (fallback): when Supabase is not configured (local dev,
//     demo), the original Map-based store is used. This is single-instance
//     only and is documented as such.
//
// Both stores honor the same contract: consumeNonce returns { ok: true } on
// the first use and { ok: false } on a replay. The caller does not know or
// care which store is active.

import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/observability";

const MAX_SKEW_SECONDS = 5 * 60; // 5 minutes
const GC_INTERVAL_MS = 60 * 1000;

// ── In-memory fallback (local dev / demo) ─────────────────────────────────

const usedNonces = new Map<string, number>(); // key → expiry epoch ms
let lastGc = 0;

function gc(now: number): void {
  if (now - lastGc < GC_INTERVAL_MS) return;
  lastGc = now;
  for (const [key, expiry] of usedNonces) {
    if (expiry <= now) usedNonces.delete(key);
  }
}

function consumeInMemory(
  agentAddress: string,
  nonce: string,
  nowMs: number,
): { ok: boolean; reason?: string } {
  gc(nowMs);
  if (!nonce || nonce.length < 8) {
    return { ok: false, reason: "Nonce missing or too short (min 8 chars)." };
  }
  const key = `${agentAddress.toLowerCase()}:${nonce}`;
  const expiry = nowMs + MAX_SKEW_SECONDS * 1000;
  if (usedNonces.has(key)) {
    return { ok: false, reason: "Nonce already used." };
  }
  usedNonces.set(key, expiry);
  return { ok: true };
}

// ── Supabase backing (multi-instance / serverless) ────────────────────────

async function consumeInSupabase(
  agentAddress: string,
  nonce: string,
  nowMs: number,
): Promise<{ ok: boolean; reason?: string }> {
  const sb = supabaseAdmin();
  if (!sb) return consumeInMemory(agentAddress, nonce, nowMs);

  if (!nonce || nonce.length < 8) {
    return { ok: false, reason: "Nonce missing or too short (min 8 chars)." };
  }

  const key = `${agentAddress.toLowerCase()}:${nonce}`;
  const expiresAt = new Date(nowMs + MAX_SKEW_SECONDS * 1000).toISOString();

  // Prune expired nonces opportunistically. Cheap on every call and keeps
  // the table from growing without a separate cron.
  try {
    await sb.from("agent_nonces").delete().lt("expires_at", new Date().toISOString());
  } catch {
    // Non-fatal: a failed prune doesn't weaken replay protection — it just
    // means the table grows until the next successful prune.
  }

  // Atomic consume: the INSERT fails on PK conflict if another instance
  // already consumed this nonce. This is the correctness guarantee that the
  // in-memory Map cannot provide across instances.
  const { error } = await sb
    .from("agent_nonces")
    .insert({
      nonce_key: key,
      agent_address: agentAddress.toLowerCase(),
      expires_at: expiresAt,
    });

  if (error) {
    // 23505 = unique_violation — the nonce was already consumed.
    if (error.code === "23505") {
      return { ok: false, reason: "Nonce already used." };
    }
    // Any other error (network, permissions, table missing) is a store
    // failure, not a replay. Fail open: log it and fall back to in-memory
    // so the request is not blocked by an infrastructure issue.
    log.warn("agent_replay.supabase_consume_failed", {
      reason: error.message,
      code: error.code,
    });
    return consumeInMemory(agentAddress, nonce, nowMs);
  }

  return { ok: true };
}

// ── Public API ────────────────────────────────────────────────────────────

export function verifyTimestamp(
  timestamp: number,
  nowMs: number = Date.now(),
): { ok: boolean; reason?: string } {
  const nowSec = Math.floor(nowMs / 1000);
  const skew = Math.abs(nowSec - timestamp);
  if (skew > MAX_SKEW_SECONDS) {
    return {
      ok: false,
      reason: `Timestamp skew ${skew}s exceeds ${MAX_SKEW_SECONDS}s window.`,
    };
  }
  return { ok: true };
}

// Sync variant — used when Supabase is not configured (local dev). The agent
// route handlers call the async variant.
export function consumeNonce(
  agentAddress: string,
  nonce: string,
  nowMs: number = Date.now(),
): { ok: boolean; reason?: string } {
  return consumeInMemory(agentAddress, nonce, nowMs);
}

// Async variant — used by route handlers. Routes to Supabase when configured,
// falls back to in-memory. This is the one callers should use in request
// contexts.
export async function consumeNonceAsync(
  agentAddress: string,
  nonce: string,
  nowMs: number = Date.now(),
): Promise<{ ok: boolean; reason?: string }> {
  return consumeInSupabase(agentAddress, nonce, nowMs);
}

// Test affordance — clears the in-memory nonce cache.
export function clearNonceCacheForTest(): void {
  usedNonces.clear();
}
