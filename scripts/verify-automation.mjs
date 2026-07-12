#!/usr/bin/env node
// scripts/verify-automation.mjs
//
// Probe a deployed automation endpoint to confirm the scheduler
// (typically .github/workflows/automation-tick.yml) can reach it.
// Designed for cron-job.org health probes, status pages, and ad-hoc
// "is the cron alive" debugging.
//
// Exit codes:
//   0 — reachable, returned 200
//   1 — unreachable or non-200 HTTP error
//   2 — 401 unauthorized (secret mismatch) or missing env vars
//
// Usage:
//   AUTOMATION_URL=https://ardum.app \
//   AUTOMATION_SECRET=... \
//     node scripts/verify-automation.mjs
//
//   # JSON mode for programmatic consumers:
//     node scripts/verify-automation.mjs --json

const url = (process.env.AUTOMATION_URL ?? "").replace(/\/$/, "");
const secret = process.env.AUTOMATION_SECRET ?? "";
const asJson = process.argv.includes("--json");

function emit(payload, code) {
  if (asJson) {
    console.log(JSON.stringify(payload));
  } else if (payload.ok) {
    const summary =
      `automation: reachable, ` +
      `${payload.checked ?? 0} checked / ${payload.failed ?? 0} failed ` +
      `over ${payload.durationMs}ms`;
    console.log(summary);
    if (Number.isFinite(payload.considered)) {
      console.log(`  considered=${payload.considered}`);
    }
    if (payload.startedAt && payload.finishedAt) {
      console.log(`  tick window: ${payload.startedAt} → ${payload.finishedAt}`);
    }
  } else {
    console.error(`verify-automation: ${payload.reason}`);
    if (payload.body) console.error(`  ${payload.body}`);
    if (payload.error) console.error(`  ${payload.error}`);
  }
  process.exit(code);
}

if (!url || !secret) {
  emit({ ok: false, reason: "missing_env (set AUTOMATION_URL and AUTOMATION_SECRET)" }, 2);
}

const startedAt = Date.now();
let response;
try {
  response = await fetch(`${url}/api/internal/automation`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
  });
} catch (err) {
  emit(
    { ok: false, reason: "unreachable", error: String(err?.message ?? err) },
    1,
  );
}

const durationMs = Date.now() - startedAt;
const text = await response.text();

if (response.status === 401) {
  emit({ ok: false, reason: "unauthorized (secret mismatch)" }, 2);
}

if (!response.ok) {
  emit(
    { ok: false, reason: `http_${response.status}`, body: text },
    1,
  );
}

let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text };
}

emit({ ok: true, durationMs, ...body }, 0);
