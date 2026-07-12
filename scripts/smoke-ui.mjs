#!/usr/bin/env node
// scripts/smoke-ui.mjs
//
// UI smoke for the home-page returning-practitioner greeting.
//
//   npm run smoke:ui                                  # localhost:3000
//   npm run smoke:ui -- https://ardum.vercel.app      # deployed
//
// Hits the live server's HTML surface, not the JSON API, so the
// greeting's data-testid="returning-greeting" presence/absence is
// the visible surface we exercise. Two scenarios:
//   1. fresh visitor  → no greeting (clean baseline)
//   2. after surfacing a recommendation → greeting rendered
// Plus a cleanup pass — once the episode is gone, the greeting
// vanishes. If it doesn't, the projection is leaking cached state
// and a tester would see a misleading home page.

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// --- cookie jar (mirrors scripts/smoke-journey.mjs) -------------------

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

// --- test harness ------------------------------------------------------

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

// Same shape as jsonRequest, but returns the raw HTML body — that's
// what we grep for the data-testid. Server-rendered pages in Next 16
// include the client-component HTML on first paint, so the testid
// substring will be present in the response body exactly when the
// server computed a non-null greeting.
async function fetchHtml(path) {
  const init = { method: "GET", headers: {} };
  const cookie = cookieHeader();
  if (cookie) init.headers["Cookie"] = cookie;
  const res = await fetch(`${baseUrl}${path}`, init);
  captureCookies(res);
  const text = await res.text();
  return { status: res.status, body: text };
}

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
  console.log(`\nArdum UI smoke — ${baseUrl}\n`);
  await waitForServer();

  // Fresh visitor: no cookie, projection is over an empty episode
  // list, server derives greeting=null, no testid rendered.
  await step("GET / with no cookie renders no returning-greeting", async () => {
    const html = await fetchHtml("/");
    assert(html.status === 200, `expected 200, got ${html.status}`);
    assert(
      !html.body.includes('data-testid="returning-greeting"'),
      `expected no returning-greeting on a fresh home page, found it in HTML:\n${html.body.slice(0, 600)}`,
    );
  });

  // Returning visitor: create an episode with one cookie, walk it to
  // a recommendation, then GET / with that cookie. The server-side
  // projection now has pastMatches populated, so greeting is non-null
  // and the testid appears in HTML.
  let epId = null;
  // Initialize to "" so a downstream assert throws AssertionError
  // (recognizable failure) if the walking step fails BEFORE capturing
  // the title. A null/undefined here would TypeError on
  // html.body.includes(undefined), which is harder to diagnose.
  let epRecTitle = "";
  try {
    await step("seeding cookie: POST /api/episodes captures an intention", async () => {
      const res = await jsonRequest("POST", "/api/episodes", {
        statement: "smoke-ui: a flowing intention",
        persistenceConsent: true,
      });
      assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      epId = res.body.episode.id;
    });

    let rev = 1;
    await step("walking to a recommendation so pastMatches is non-empty", async () => {
      // Fetch current revision (server bumps it on creation).
      const cur = await jsonRequest("GET", `/api/episodes/${epId}`);
      rev = cur.body.episode.revision;
      for (const clarifier of [
        { energy: "low" },
        { budget: "1k-2k" },
        { social: "solo" },
      ]) {
        const r = await jsonRequest("POST", `/api/episodes/${epId}/actions`, {
          type: "revise-intention",
          expectedRevision: rev,
          constraints: clarifier,
          reason: `smoke-ui: clarify ${Object.keys(clarifier)[0]}`,
        });
        assert(r.status === 200, `clarify: ${r.status} ${JSON.stringify(r.body)}`);
        rev = r.body.episode.revision;
      }
      const rec = await jsonRequest("POST", `/api/episodes/${epId}/actions`, {
        type: "recommend",
        expectedRevision: rev,
      });
      assert(rec.status === 200, `recommend: ${rec.status} ${JSON.stringify(rec.body)}`);
      // Capture the surfaced retreat title so the /memory assertions
      // can pin that the summary card names the actual pastMatch
      // (not just a generic "your last retreat" line). Local model
      // score is deterministic so a fixed title is fine.
      epRecTitle = rec.body.episode.recommendation.result.retreatTitle;
    });

    await step("GET / with practiced cookie renders returning-greeting", async () => {
      const html = await fetchHtml("/");
      assert(html.status === 200, `expected 200, got ${html.status}`);
      assert(
        html.body.includes('data-testid="returning-greeting"'),
        `expected returning-greeting in HTML after surfacing a recommendation, did not find it.\nFirst 800 chars of HTML:\n${html.body.slice(0, 800)}`,
      );
    });

    await step("the greeting body actually mentions the previous match", async () => {
      // The greeting copy places "Welcome back" + "Last time you were
      // considering" + the recommendation title in the HTML body.
      // Pinning the title here also catches a regression where the
      // projection is bypassing pastMatches[0].
      const html = await fetchHtml("/");
      assert(
        /Welcome back/i.test(html.body),
        `expected greeting to open with "Welcome back", got:\n${html.body.slice(0, 1200)}`,
      );
      assert(
        /considering/i.test(html.body),
        `expected greeting to mention "considering", got:\n${html.body.slice(0, 1200)}`,
      );
    });

    await step("GET /memory with practiced cookie renders the summary card", async () => {
      const html = await fetchHtml("/memory");
      assert(html.status === 200, `expected 200, got ${html.status}`);
      assert(
        html.body.includes('data-testid="memory-summary"'),
        `expected memory-summary in HTML after surfacing a recommendation, did not find it.\nFirst 800 chars of HTML:\n${html.body.slice(0, 800)}`,
      );
    });

    await step("the summary card body identifies the most recent match", async () => {
      // Pinned by past_matches[0], not by pastBookings[0] — a fresh
      // recommendation that hasn't been booked should still surface.
      const html = await fetchHtml("/memory");
      assert(
        html.body.includes("what our previous visits looked like"),
        `expected the summary card's eyebrow copy, got:\n${html.body.slice(0, 1200)}`,
      );
      assert(
        /You have surfaced/i.test(html.body),
        `expected "You have surfaced" line in summary card, got:\n${html.body.slice(0, 1200)}`,
      );
      assert(
        epRecTitle !== "" && html.body.includes(epRecTitle),
        `expected recommendation title (${epRecTitle}) in summary card. The summary card must surface pastMatches[0].title for the practitioner to scan what they considered.`,
      );
    });

    await step("DELETE /api/episodes/[id] returns the projector to empty", async () => {
      const res = await jsonRequest("DELETE", `/api/episodes/${epId}`);
      assert(res.status === 200, `expected 200, got ${res.status}`);
      epId = null;
    });

    await step("GET / after delete renders no returning-greeting", async () => {
      const html = await fetchHtml("/");
      assert(html.status === 200, `expected 200, got ${html.status}`);
      assert(
        !html.body.includes('data-testid="returning-greeting"'),
        `expected no returning-greeting after delete (projection threw away pastMatches), found it in HTML:\n${html.body.slice(0, 600)}`,
      );
    });

    await step("GET /memory after delete renders no summary card", async () => {
      const html = await fetchHtml("/memory");
      assert(html.status === 200, `expected 200, got ${html.status}`);
      assert(
        !html.body.includes('data-testid="memory-summary"'),
        `expected no memory-summary after delete (projector threw away pastMatches and isReturning fell to false), found it in HTML:\n${html.body.slice(0, 600)}`,
      );
    });
  } finally {
    // Belt: wipe any episode still hanging around mid-failure so re-runs
    // don't accumulate. The DELETE on a deleted id is a 404; that's fine.
    if (epId) {
      await jsonRequest("DELETE", `/api/episodes/${epId}`).catch(() => {});
    }
  }

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
