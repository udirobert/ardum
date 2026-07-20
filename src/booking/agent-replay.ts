import "server-only";

// Replay protection for agent API signatures. Each agent signature carries a
// nonce + timestamp; the timestamp must be within `MAX_SKEW_SECONDS` of the
// server clock, and each nonce may be used at most once within that window.
//
// In-memory: sufficient for a single-instance deployment and for raising the
// bar on replay. For multi-instance production, back this with a shared
// store (Supabase/Redis) — the nonce key is `agentAddress:nonce`.

const MAX_SKEW_SECONDS = 5 * 60; // 5 minutes
const GC_INTERVAL_MS = 60 * 1000;

const usedNonces = new Map<string, number>(); // key → expiry epoch ms
let lastGc = 0;

function gc(now: number): void {
  if (now - lastGc < GC_INTERVAL_MS) return;
  lastGc = now;
  for (const [key, expiry] of usedNonces) {
    if (expiry <= now) usedNonces.delete(key);
  }
}

export function verifyTimestamp(timestamp: number, nowMs: number = Date.now()): {
  ok: boolean;
  reason?: string;
} {
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

export function consumeNonce(
  agentAddress: string,
  nonce: string,
  nowMs: number = Date.now(),
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

// Test affordance — clears the nonce cache. Only call from test setup.
export function clearNonceCacheForTest(): void {
  usedNonces.clear();
}
