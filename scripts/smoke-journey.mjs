// End-to-end smoke journey for the Ardum intention surface.
//
//   npm run smoke:journey                           # solo + invite paths
//   npm run smoke:journey -- --solo-only            # solo hold → book only
//   npm run smoke:journey -- --invite-only          # invite branch only
//   npm run smoke:journey -- https://ardum.vercel.app
//
// Walks two regression paths against a running server:
//
//   Solo (ADR 0008): capture → clarify → recommend → hold → book → delete
//
//   Invite branch: capture → clarify → recommend → reject → re-clarify →
//   recommend → monitor → hold → invite → response → book → returning memory
//   → delete
//
// Plus defensive checks on the invite path:
//   - the same command with the same idempotency key produces no new revision
//   - a command with an expected revision that has moved is rejected as 409
//
// Each step prints a ✓ / ✗ so a failed journey is obvious in CI output.

const argv = process.argv.slice(2);
const inviteOnly = argv.includes("--invite-only");
const soloOnly = argv.includes("--solo-only");
const baseUrl = (
  argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000"
).replace(/\/$/, "");

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

/** Compact walk: capture → clarify → recommend → hold. Returns { episodeId, revision, send }. */
async function walkToSoloHold(prefix) {
  let episodeId = null;
  let revision = 1;

  await step(`${prefix}POST /api/episodes captures an intention`, async () => {
    const res = await jsonRequest("POST", "/api/episodes", {
      statement: "Make space to recover from an intense quarter.",
      desiredShift: "Come back to my edges with a little softness.",
      persistenceConsent: true,
    });
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.id, `no episode id returned: ${JSON.stringify(res.body)}`);
    episodeId = res.body.episode.id;
    revision = res.body.episode.revision;
  });

  const send = async (command) =>
    jsonRequest("POST", `/api/episodes/${episodeId}/actions`, command);

  for (const [label, constraints, reason] of [
    ["clarify energy → status:clarifying", { energy: "settled" }, "Resolve energy first."],
    ["clarify budget → status:clarifying", { budget: "1k-2k" }, "Add a responsible limit."],
    ["clarify social → status:ready", { social: "solo" }, "Solo path — no invite required."],
  ]) {
    await step(`${prefix}${label}`, async () => {
      const res = await send({
        type: "revise-intention",
        expectedRevision: revision,
        constraints,
        reason,
      });
      assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
      revision = res.body.episode.revision;
    });
  }

  await step(`${prefix}recommend → status:recommendation-ready`, async () => {
    const res = await send({ type: "recommend", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(
      res.body?.episode?.status === "recommendation-ready",
      `expected status=recommendation-ready, got ${res.body.episode.status}`,
    );
    revision = res.body.episode.revision;
  });

  await step(`${prefix}create-hold → status:held, solo ready-to-book`, async () => {
    const res = await send({ type: "create-hold", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(
      res.body?.episode?.status === "held",
      `expected status=held (dual-key presence), got ${res.body.episode.status}`,
    );
    assert(
      res.body?.episode?.hold?.status === "active",
      `hold should be active: ${JSON.stringify(res.body.episode.hold)}`,
    );
    assert(
      res.body?.nextDecision?.kind === "ready-to-book",
      `expected nextDecision=ready-to-book after solo hold, got ${JSON.stringify(res.body?.nextDecision)}`,
    );
    revision = res.body.episode.revision;
  });

  return { episodeId, revision, send };
}

async function runSoloCommitPath() {
  console.log("  Solo commit path (hold → book, no invite)\n");

  const { episodeId, revision, send } = await walkToSoloHold("solo: ");

  await step("solo: record-commitment without invite → status:booked", async () => {
    const res = await send({
      type: "record-commitment",
      expectedRevision: revision,
      bookingRootHash: `0g-solo-smoke-${Date.now().toString(36)}`,
      depositTxId: `0xsolo-smoke-${Date.now().toString(36)}`,
      bookedAt: new Date().toISOString(),
    });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(
      res.body?.episode?.status === "booked",
      `expected status=booked, got ${res.body.episode.status}`,
    );
    assert(
      !res.body?.episode?.coordination?.inviteExpiresAt,
      "solo path must not require an invite branch",
    );
  });

  await step("solo: DELETE /api/episodes/[id] removes the episode", async () => {
    const res = await jsonRequest("DELETE", `/api/episodes/${episodeId}`);
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
  });
}

async function runInviteJourney() {
  console.log("  Invite branch journey\n");

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
  let currentRecommendationHash = "";
  await step("recommend again → status:recommendation-ready", async () => {
    const res = await send({ type: "recommend", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "recommendation-ready",
      `expected status=recommendation-ready, got ${res.body.episode.status}`);
    currentRecommendationHash = res.body?.episode?.recommendation?.result?.retreatRootHash ?? "";
    revision = res.body.episode.revision;
  });

  // 7b. "Not this one" — reject the top pick, get a different one.
  await step("reject-recommendation → new top pick, rejected tracked", async () => {
    const res = await send({
      type: "reject-recommendation",
      expectedRevision: revision,
      retreatRootHash: currentRecommendationHash,
    });
    // If no alternatives were available, the server may 400 — that's fine.
    if (res.status === 200) {
      assert(res.body?.episode?.status === "recommendation-ready" || res.body?.episode?.status === "clarifying",
        `expected status=recommendation-ready or clarifying, got ${res.body.episode.status}`);
      assert(Array.isArray(res.body?.episode?.rejectedRetreats),
        `rejectedRetreats should be an array, got: ${JSON.stringify(res.body?.episode?.rejectedRetreats)}`);
      revision = res.body.episode.revision;
    } else {
      assert(res.status === 400, `expected 200 or 400, got ${res.status}`);
    }
  });

  await step("start-monitoring → status:monitoring", async () => {
    const res = await send({ type: "start-monitoring", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "monitoring",
      `expected status=monitoring, got ${res.body.episode.status}`);
    revision = res.body.episode.revision;
  });

  await step("create-hold → status:held, solo ready-to-book", async () => {
    const res = await send({ type: "create-hold", expectedRevision: revision });
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body?.episode?.status === "held",
      `expected status=held, got ${res.body.episode.status}`);
    assert(res.body?.episode?.hold?.status === "active",
      `hold should be active: ${JSON.stringify(res.body.episode.hold)}`);
    // Solo path: hold unlocks commitment without forcing an invite branch
    // (docs/decisions/0008-agentic-commitment.md).
    assert(res.body?.nextDecision?.kind === "ready-to-book",
      `expected nextDecision=ready-to-book after solo hold, got ${JSON.stringify(res.body?.nextDecision)}`);
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

  // 11b. Returning-practitioner scenario.
  // Open a SECOND episode with the same cookie (the smoke journey uses
  // a single HttpOnly actor cookie throughout, so this is genuinely
  // the same practitioner returning). The detail route's GET must
  // project memory from the actor's siblings EXCLUDING the current
  // episode, so pastBookings[0] here points at the FIRST episode's
  // booked retreat and pastMatches[0] points at the same episode's
  // recommendation — confirming the operational recognition line
  // fires correctly on the second visit.
  //
  // The whole body is wrapped in try/finally so any throw on the
  // walk-to-recommend path (create #2, clarify, recommend, GET)
  // MUST still wipe #2 from the repo. Without the finally, a 500 on
  // any of those calls would leave #2 stranded in the dev server's
  // in-memory repo until restart.
  let ep2Id = null;
  try {
    await step("recognize a returning practitioner — memory.isReturning fires on episode #2", async () => {
      // Capture #1's final recommendation title from a fresh read so
      // we have a stable string to match against (record-commitment
      // clears the hold but keeps recommendation).
      const firstRead = await jsonRequest("GET", `/api/episodes/${episodeId}`);
      const firstTitle =
        firstRead.body?.episode?.recommendation?.result?.retreatTitle;
      assert(
        typeof firstTitle === "string" && firstTitle.length > 0,
        `first episode should still carry its recommendation title, got ${JSON.stringify(
          firstRead.body?.episode?.recommendation,
        )}`,
      );

      // Walk #2 with the same actor cookie. Capture, then three
      // clarifying revisions, then recommend.
      const second = await jsonRequest("POST", "/api/episodes", {
        statement: "A second intention for the smoke journey.",
        persistenceConsent: true,
      });
      assert(second.status === 201, `expected 201, got ${second.status}: ${JSON.stringify(second.body)}`);
      ep2Id = second.body.episode.id;
      let ep2Rev = second.body.episode.revision;

      for (const clarifier of [
        { energy: "low" },
        { budget: "1k-2k" },
        { social: "solo" },
      ]) {
        const r = await jsonRequest("POST", `/api/episodes/${ep2Id}/actions`, {
          type: "revise-intention",
          expectedRevision: ep2Rev,
          constraints: clarifier,
          reason: `smoke: clarify ${Object.keys(clarifier)[0]} on #2`,
        });
        assert(r.status === 200, `clarify #2: ${r.status} ${JSON.stringify(r.body)}`);
        ep2Rev = r.body.episode.revision;
      }
      const rec2 = await jsonRequest("POST", `/api/episodes/${ep2Id}/actions`, {
        type: "recommend",
        expectedRevision: ep2Rev,
      });
      assert(rec2.status === 200, `recommend #2: ${rec2.status} ${JSON.stringify(rec2.body)}`);

      // The detail route projects memory from siblings excluding this
      // episode. #1 is the only sibling; because #1.status === "booked"
      // AND #1.commitment.status === "booked", the projector puts #1
      // into BOTH pastMatches[0] and pastBookings[0]. Capture what we
      // need into locals FIRST so the cleanup is unconditional.
      const detail = await jsonRequest("GET", `/api/episodes/${ep2Id}`);
      const memory = detail.body?.memory ?? null;
      const pastBookingTitle = memory?.pastBookings?.[0]?.title;

      // Inner cleanup. Idempotent against the outer finally — the
      // second DELETE on Supabase is a fast 200 (the WHERE on
      // revision matches no rows); the local adapter no-ops.
      await jsonRequest("DELETE", `/api/episodes/${ep2Id}`);

      const pastMatchTitle = memory?.pastMatches?.[0]?.title;
      assert(
        detail.status === 200,
        `expected 200, got ${detail.status}: ${JSON.stringify(detail.body)}`,
      );
      assert(
        memory && memory.isReturning === true,
        `memory.isReturning should be true on the second visit, got ${JSON.stringify(memory)}`,
      );
      assert(
        pastBookingTitle === firstTitle,
        `memory.pastBookings[0].title should equal #1's recommendation, got "${pastBookingTitle}", want "${firstTitle}"`,
      );
      assert(
        pastMatchTitle === firstTitle,
        `memory.pastMatches[0].title should equal #1's recommendation, got "${pastMatchTitle}", want "${firstTitle}"`,
      );
    });
  } finally {
    // Belt: even if the step() throws before its inner DELETE ran
    // (clarify failed, recommend failed, GET failed, etc.), wipe #2.
    // The inner DELETE is still the happy-path cleanup; this finally
    // is the rollback the happy path doesn't need.
    if (ep2Id) {
      await jsonRequest("DELETE", `/api/episodes/${ep2Id}`).catch(() => {});
    }
  }

  // 12. Delete and confirm empty.
  await step("DELETE /api/episodes/[id] removes the episode", async () => {
    const res = await jsonRequest("DELETE", `/api/episodes/${episodeId}`);
    assert(res.status === 200, `got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await step("GET /api/episodes confirms deletion", async () => {
    const res = await jsonRequest("GET", `/api/episodes/${episodeId}`);
    assert(res.status === 404, `expected 404 after delete, got ${res.status}`);
  });
}

// --- actor profile path (ADR 0011) --------------------------------------
//
// Exercises the three /api/actor/* routes against a running server using
// the cookie jar from the journeys above. In local (demo) mode:
//   - GET /api/actor/profile returns an empty profile
//   - PATCH /api/actor/profile sets a preferred name
//   - POST /api/actor/attach is a no-op (local mode has no external_subject)
//   - POST /api/actor/restore returns 404 (no existing identity in local mode)
//
// In Supabase mode these would exercise the full write-back and restore
// flow, but the smoke journey runs against the local demo server.

async function runActorProfilePath() {
  console.log("\n  — actor profile path —");

  // Probe: if the server is running against Supabase but migration 005
  // (preferred_name column) hasn't been applied, the profile GET will
  // return 500. In that case, skip the profile read/write steps but
  // still run the defensive checks that don't touch the database.
  const probe = await jsonRequest("GET", "/api/actor/profile");
  const migrationApplied = probe.status === 200;

  if (!migrationApplied) {
    console.log(
      `  \x1b[33m⚠\x1b[0m /api/actor/profile returned ${probe.status} — migration 005 may not be applied; skipping profile read/write steps`,
    );
  }

  if (migrationApplied) {
    await step("GET /api/actor/profile returns a profile shape", async () => {
      assert(
        probe.body?.profile,
        `no profile in response: ${JSON.stringify(probe.body)}`,
      );
      assert(
        "preferredName" in probe.body.profile,
        `profile missing preferredName: ${JSON.stringify(probe.body.profile)}`,
      );
    });

    await step("PATCH /api/actor/profile sets a preferred name", async () => {
      const res = await jsonRequest("PATCH", "/api/actor/profile", {
        preferredName: "Smoke",
      });
      assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(
        res.body?.profile?.preferredName === "Smoke",
        `preferredName not echoed back: ${JSON.stringify(res.body)}`,
      );
    });

    await step("GET /api/actor/profile reflects the saved name", async () => {
      const res = await jsonRequest("GET", "/api/actor/profile");
      assert(res.status === 200, `expected 200, got ${res.status}`);
      assert(
        res.body?.profile?.preferredName === "Smoke",
        `preferredName not persisted: ${JSON.stringify(res.body?.profile)}`,
      );
    });

    await step("PATCH /api/actor/profile clears the name with null", async () => {
      const res = await jsonRequest("PATCH", "/api/actor/profile", {
        preferredName: null,
      });
      assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(
        res.body?.profile?.preferredName === null,
        `preferredName should be null after clear: ${JSON.stringify(res.body?.profile)}`,
      );
    });
  }

  await step("PATCH /api/actor/profile rejects empty body", async () => {
    const res = await jsonRequest("PATCH", "/api/actor/profile", {});
    assert(res.status === 400, `expected 400 for empty patch, got ${res.status}`);
  });

  await step("POST /api/actor/attach accepts a subject", async () => {
    // Use a random address to avoid colliding with the unique constraint
    // on external_subject from previous smoke runs.
    const randomAddr =
      "0x" +
      Array.from({ length: 40 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("");
    const res = await jsonRequest("POST", "/api/actor/attach", {
      subject: randomAddr,
    });
    // In local mode this is a no-op; in Supabase mode it writes
    // external_subject. Either way, 200 is the success path.
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await step("POST /api/actor/attach rejects missing subject", async () => {
    const res = await jsonRequest("POST", "/api/actor/attach", {});
    assert(res.status === 400, `expected 400 for missing subject, got ${res.status}`);
  });

  await step("POST /api/actor/restore rejects missing fields", async () => {
    const res = await jsonRequest("POST", "/api/actor/restore", {});
    assert(res.status === 400, `expected 400 for missing fields, got ${res.status}`);
  });

  await step("POST /api/actor/restore rejects bad signature", async () => {
    const res = await jsonRequest("POST", "/api/actor/restore", {
      address: "0x0000000000000000000000000000000000000001",
      signature: "0xbad",
      timestamp: Math.floor(Date.now() / 1000),
    });
    // 401 (signature mismatch) or 400 (invalid signature format) are
    // both acceptable — the point is that it doesn't succeed.
    assert(res.status >= 400, `expected >=400 for bad signature, got ${res.status}`);
  });
}

async function main() {
  console.log(`\nArdum journey smoke — ${baseUrl}\n`);
  await waitForServer();

  if (!inviteOnly) {
    await runSoloCommitPath();
  }
  if (!soloOnly) {
    await runInviteJourney();
  }
  await runActorProfilePath();

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
