#!/usr/bin/env node
// Grant ceremony UI smoke — return-booker identity compounding (ADR 0008 §6).
//
//   npm run smoke:grant                           # localhost:3000
//   npm run smoke:grant -- https://ardum.vercel.app
//
// Requires agent-browser on PATH or at ~/.hermes/node/bin/agent-browser.
// Uses a dev-only ?smokeRestore=1 hook (MagicAuth) to simulate a restored
// Magic session when providers are unconfigured — never authorization.

import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const baseUrl = (
  argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000"
).replace(/\/$/, "");

const AB =
  process.env.AGENT_BROWSER ??
  `${process.env.HOME}/.hermes/node/bin/agent-browser`;

const HINT_ADDRESS = "0xsmoke0000000000000000000000000000000001";

// --- cookie jar (mirrors smoke-journey.mjs) -----------------------------

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

async function jsonRequest(method, path, body) {
  const init = { method, headers: {} };
  const cookie = cookieHeader();
  if (cookie) init.headers.Cookie = cookie;
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
    /* ignore */
  }
  return { status: res.status, body: parsed };
}

// --- harness ------------------------------------------------------------

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function ab(session, cmd) {
  return execSync(`${AB} --session ${session} ${cmd}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${baseUrl} did not respond within 30s.`);
}

async function seedHeldEpisode() {
  let episodeId = null;
  let revision = 1;
  let depositUsd = 0;

  const created = await jsonRequest("POST", "/api/episodes", {
    statement: "Grant smoke: solo hold for return-booker ceremony.",
    persistenceConsent: true,
  });
  assert(created.status === 201, `create: ${created.status}`);
  episodeId = created.body.episode.id;
  revision = created.body.episode.revision;

  const send = async (command) =>
    jsonRequest("POST", `/api/episodes/${episodeId}/actions`, {
      ...command,
      expectedRevision: revision,
    });

  for (const constraints of [
    { energy: "settled" },
    { budget: "1k-2k" },
    { social: "solo" },
  ]) {
    const r = await send({
      type: "revise-intention",
      constraints,
      reason: "smoke-grant clarify",
    });
    assert(r.status === 200, `clarify: ${r.status}`);
    revision = r.body.episode.revision;
  }

  const rec = await send({ type: "recommend" });
  assert(rec.status === 200, `recommend: ${rec.status}`);
  depositUsd = rec.body.episode.recommendation.result.priceUsd;
  revision = rec.body.episode.revision;

  const hold = await send({ type: "create-hold" });
  assert(hold.status === 200, `hold: ${hold.status}`);
  assert(
    hold.body?.nextDecision?.kind === "ready-to-book",
    `expected ready-to-book, got ${hold.body?.nextDecision?.kind}`,
  );

  return { episodeId, depositUsd };
}

function actorCookie() {
  const value = cookieJar.get("ardum-actor");
  assert(value, "expected ardum-actor cookie after API seed");
  return value;
}

function openGrant(session, episodeId, { smokeRestore = false } = {}) {
  const qs = smokeRestore ? "?smokeRestore=1" : "";
  const url = `${baseUrl}/episode/${episodeId}${qs}`;
  ab(session, "close --all");
  ab(
    session,
    `cookies set ardum-actor ${JSON.stringify(actorCookie())} --url ${JSON.stringify(baseUrl)} --path /`,
  );
  ab(session, `open ${JSON.stringify(baseUrl)}`);
  ab(
    session,
    `eval ${JSON.stringify(
      `localStorage.setItem('ardum:payment-identity', '${HINT_ADDRESS}');`,
    )}`,
  );
  ab(session, `open ${JSON.stringify(url)}`);
  // Mira field + dynamic CommitmentPanel chunk.
  ab(session, "wait 6000");
}

function clickSecureMyPlace(session) {
  ab(
    session,
    `eval ${JSON.stringify(
      "[...document.querySelectorAll('button')].find(b => b.textContent.includes('Secure my place'))?.click()",
    )}`,
  );
  ab(session, "wait 8000");
}

function pageHtml(session) {
  return ab(session, `eval ${JSON.stringify("document.body.innerText")}`);
}

function hasTestId(session, id) {
  return (
    ab(
      session,
      `eval ${JSON.stringify(
        `Boolean(document.querySelector('[data-testid="${id}"]'))`,
      )}`,
    ).trim() === "true"
  );
}

function bodyIncludes(session, text) {
  return (
    ab(
      session,
      `eval ${JSON.stringify(`document.body.innerText.includes(${JSON.stringify(text)})`)}`,
    ).trim() === "true"
  );
}

// --- main ---------------------------------------------------------------

async function main() {
  console.log(`\nArdum grant smoke — ${baseUrl}\n`);
  await waitForServer();

  let episodeId = null;

  try {
    await step("seed held episode via API", async () => {
      const seeded = await seedHeldEpisode();
      episodeId = seeded.episodeId;
    });

    await step(
      "cold Magic session: hint alone still asks for identity",
      async () => {
        const session = `ardum-grant-cold-${Date.now()}`;
        openGrant(session, episodeId, { smokeRestore: false });
        clickSecureMyPlace(session);
        assert(
          hasTestId(session, "grant-ceremony"),
          "expected grant ceremony panel after Secure my place",
        );
        assert(
          hasTestId(session, "grant-continue-identity"),
          "expected grant-continue-identity when session is cold",
        );
        assert(
          !hasTestId(session, "grant-confirm-deposit"),
          "must not show Confirm deposit without a restored session",
        );
        assert(
          bodyIncludes(session, "Continue with Google"),
          "expected human identity CTA copy",
        );
        ab(session, "close --all");
      },
    );

    await step(
      "restored session: Welcome back → Confirm deposit (no identity theater)",
      async () => {
        const session = `ardum-grant-warm-${Date.now()}`;
        openGrant(session, episodeId, { smokeRestore: true });
        clickSecureMyPlace(session);
        assert(
          hasTestId(session, "grant-ceremony"),
          "expected grant ceremony panel after Secure my place",
        );
        assert(
          hasTestId(session, "grant-copy-returning"),
          "expected returning grant copy block",
        );
        assert(
          bodyIncludes(session, "Welcome back"),
          "expected Welcome back copy for returning payer",
        );
        assert(
          hasTestId(session, "grant-confirm-deposit"),
          "expected grant-confirm-deposit when session is restored",
        );
        assert(
          !hasTestId(session, "grant-continue-identity"),
          "must not show identity CTA when session is restored",
        );
        assert(
          ab(
            session,
            `eval ${JSON.stringify(
              "document.querySelector('[data-testid=\"grant-confirm-deposit\"]')?.textContent.includes('Confirm deposit of')",
            )}`,
          ).trim() === "true",
          "expected Confirm deposit button with amount",
        );
        ab(session, "close --all");
      },
    );

    await step("episode page loads without error boundary (headless WebGL)", async () => {
      const session = `ardum-grant-webgl-${Date.now()}`;
      openGrant(session, episodeId, { smokeRestore: true });
      const text = pageHtml(session);
      assert(
        !text.includes("This page couldn"),
        "episode page must not hit the root error boundary",
      );
      assert(
        text.includes("Grant smoke:"),
        "expected episode intention heading on page",
      );
      ab(session, "close --all");
    });
  } finally {
    try {
      ab(`ardum-grant-cleanup-${Date.now()}`, "close --all");
    } catch {
      /* browser may already be closed */
    }
    if (episodeId) {
      await jsonRequest("DELETE", `/api/episodes/${episodeId}`).catch(() => {});
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
