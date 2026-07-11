// End-to-end smoke journey for the Ardum intention surface.
//
//   npm run smoke:journey                           # against localhost:3000
//   npm run smoke:journey -- https://ardum.vercel.app
//
// Walks the canonical episode journey against a running server:
//   capture → clarify energy/budget/social → recommend → reject →
//   re-clarify → recommend → monitor → hold → invite → response →
//   book → resume (GET) → delete
//
// Plus two defensive checks:
//   - the same command with the same idempotency key produces no new revision
//   - a command with an expected revision that has moved is rejected as 409
//
// Each step prints a ✓ / ✗ so a failed journey is obvious in CI output.

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// --- cookie jar ----------------------------------------------------------

const cookieJar = new Map();
function captureCookies(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const eq = sc.indexOf("=");
    if (eq < 0) continue;
    const name = sc.slice(0, eq);
    const value = sc.slice(eq + 1).split(";")[0];
    if (name) cookieJar.set(name, value);
  }
}
function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// --- test harness --------------------------------------------------------

const steps = [];

async function step(name, fn) {
  try {
    await fn();
    steps.push({ name, ok: true });
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    steps.push({ name, ok: false, detail });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${detail}`);
  }
}

class AssertionError extends Error {}

function assert(cond, msg) {
  if (!cond) throw new AssertionError(msg);
}

async function jsonRequest(method, path, body) {
  const init = { method, headers: {} };
  const cookie = cookieHeader();
  if (cookie) init.headers["Cookie"] = cookie;
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, init);
  captureCookies(res);
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* leave parsed as null */
  }
  return { status: res.status, body: parsed };
}

// --- the actual journey --------------------------------------------------

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${baseUrl} did not respond within 30s.`);
}

async function main() {
  console.log(`\nArdum journey smoke — ${baseUrl}\n`);
  await waitForServer();

  // 1. Capture an intention.
  let episodeId = null;
  let revision = 1;
  await step("POST /api/episodes captures an intention", async () => {
    const res = await jsonRequest("POST", "/api/episodes", {
      statement: "Make space to recover from an intense quarter.",
      desiredShift: "Come back to my edges with a little softness.",
      persistenceConsent: true,
    });
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    const body = res.body;
    assert(body?.episode?.id, `no episode id returned: ${JSON.stringify(body)}`);
    assert(body.episode.status === "capturing", `expected status=capturing, got ${body.episode.status}`);
    episodeId = body.episode.id;
    revision = body.episode.revision;
  });

  const send = async (command) =>
    jsonRequest("POST", `/api/episodes/${episodeId}/actions`, command);

  // 2. Clarify energy / budget / social.
  await step("clarify energy → status:clarifying", async () => {
    const res = await send({
      type: "revise-intention",
      expectedRevision: revision,
      constraints: { energy: "settled" },
      reason: "Resolve the highest-value question first.",
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "clarifying",
      `expected status=clarifying, got ${res.body.episode.status}`);
    revision = res.body.episode.revision;
  });

  await step("clarify budget → status:clarifying", async () => {
    const res = await send({
      type: "revise-intention",
      expectedRevision: revision,
      constraints: { budget: "1k-2k" },
      reason: "Add a responsible limit.",
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "clarifying",
      `expected status=clarifying, got ${res.body.episode.status}`);
    revision = res.body.episode.revision;
  });

  await step("clarify social → status:ready", async () => {
    const res = await send({
      type: "revise-intention",
      expectedRevision: revision,
      constraints: { social: "small-circle" },
      reason: "Set the kind of company.",
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "ready",
      `expected status=ready, got ${res.body.episode.status}`);
    revision = res.body.episode.revision;
  });

  // 3. Recommend — pins the MatchResult shape that downstream UI consumes.
  await step("recommend → status:recommendation-ready, result shape pinned", async () => {
    const res = await send({
      type: "recommend",
      expectedRevision: revision,
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "recommendation-ready",
      `expected status=recommendation-ready, got ${res.body.episode.status}`);
    const result = res.body?.episode?.recommendation?.result;
    assert(result, `no recommendation attached: ${JSON.stringify(res.body)}`);
    assert(typeof result.retreatRootHash === "string" && result.retreatRootHash.length > 0,
      `expected result.retreatRootHash, got: ${JSON.stringify(result)}`);
    assert(typeof result.priceUsd === "number" && Number.isFinite(result.priceUsd),
      `expected result.priceUsd, got: ${JSON.stringify(result)}`);
    revision = res.body.episode.revision;
  });

  // 4. Reject the recommendation — feedback clears it.
  await step("feedback → status:clarifying, recommendation cleared", async () => {
    const res = await send({
      type: "feedback",
      expectedRevision: revision,
      reason: "place",
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "clarifying",
      `expected status=clarifying, got ${res.body.episode.status}`);
    assert(res.body?.episode?.recommendation === undefined,
      `recommendation should be cleared, got: ${JSON.stringify(res.body.episode.recommendation)}`);
    revision = res.body.episode.revision;
  });

  // 5. Idempotency — retrying the same command with the same key changes nothing.
  await step("idempotent revise → revision unchanged on retry", async () => {
    const key = `smoke-${Date.now()}`;
    const first = await send({
      type: "revise-intention",
      expectedRevision: revision,
      constraints: { energy: "low" },
      reason: "Reframe for the smoke.",
      idempotencyKey: key,
    });
    assert(first.status === 200, `first: ${first.status}`);
    const firstRevision = first.body.episode.revision;
    const second = await send({
      type: "revise-intention",
      expectedRevision: revision, // stale: server should ignore and return current
      constraints: { energy: "low" },
      reason: "Reframe for the smoke.",
      idempotencyKey: key,
    });
    assert(second.status === 200, `second: ${second.status}: ${JSON.stringify(second.body)}`);
    assert(second.body.episode.revision === firstRevision,
      `revision must not advance on idempotent retry (got ${second.body.episode.revision}, want ${firstRevision})`);
    revision = second.body.episode.revision;
  });

  // 6. Stale revision guard.
  await step("stale expectedRevision → 409 conflict", async () => {
    const res = await send({ type: "recommend", expectedRevision: 99_999 });
    assert(res.status === 409, `expected 409, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  // 7. Re-recommend and continue.
  await step("recommend again → status:recommendation-ready", async () => {
    const res = await send({ type: "recommend", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "recommendation-ready",
      `expected status=recommendation-ready, got ${res.body.episode.status}`);
    revision = res.body.episode.revision;
  });

  await step("start-monitoring → status:monitoring", async () => {
    const res = await send({ type: "start-monitoring", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "monitoring",
      `expected status=monitoring, got ${res.body.episode.status}`);
    revision = res.body.episode.revision;
  });

  await step("create-hold → status:held", async () => {
    const res = await send({ type: "create-hold", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "held",
      `expected status=held, got ${res.body.episode.status}`);
    assert(res.body?.episode?.hold?.status === "active",
      `hold should be active: ${JSON.stringify(res.body.episode.hold)}`);
    revision = res.body.episode.revision;
  });

  // 8. Invite a participant.
  let shareToken = null;
  await step("create-invite → status:coordinating, share-token issued", async () => {
    const res = await send({
      type: "create-invite",
      expectedRevision: revision,
      participantName: "Sam",
      sharingConsent: true,
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "coordinating",
      `expected status=coordinating, got ${res.body.episode.status}`);
    assert(typeof res.body?.shareToken === "string" && res.body.shareToken.length > 8,
      `expected shareToken, got ${JSON.stringify(res.body)}`);
    shareToken = res.body.shareToken;
    revision = res.body.episode.revision;
  });

  // 9. Participant responds.
  await step("invite response (yes) → status:ready-to-book", async () => {
    const res = await jsonRequest("POST", `/api/invites/${shareToken}`, {
      decision: "yes",
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.status === "ready-to-book",
      `expected status=ready-to-book, got ${res.body?.status}`);
  });

  // 10. Resume after reload.
  await step("GET /api/episodes resumes the journey", async () => {
    const res = await jsonRequest("GET", `/api/episodes/${episodeId}`);
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    const status = res.body?.episode?.status;
    assert(
      ["ready-to-book", "coordinating", "held"].includes(status),
      `expected resume to land in a coherent state, got ${status}`,
    );
  });

  // 11. Book.
  await step("record-commitment → status:booked", async () => {
    const current = await jsonRequest("GET", `/api/episodes/${episodeId}`);
    const currentRevision = current.body.episode.revision;
    const res = await send({
      type: "record-commitment",
      expectedRevision: currentRevision,
      bookingRootHash: `0g-smoke-${Date.now().toString(36)}`,
      depositTxId: `0xsmoke-${Date.now().toString(36)}`,
      bookedAt: new Date().toISOString(),
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "booked",
      `expected status=booked, got ${res.body.episode.status}`);
  });

  // 12. Delete and confirm empty.
  await step("DELETE /api/episodes/[id] removes the episode", async () => {
    const res = await jsonRequest("DELETE", `/api/episodes/${episodeId}`);
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await step("GET /api/episodes confirms deletion", async () => {
    const res = await jsonRequest("GET", `/api/episodes/${episodeId}`);
    assert(res.status === 404, `expected 404 after delete, got ${res.status}`);
  });

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
