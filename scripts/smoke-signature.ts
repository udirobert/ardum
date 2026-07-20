// End-to-end smoke test for the attestation signature verification.
//
//   npm run smoke                              # against localhost:3000
//   npm run smoke -- https://ardum.famile.xyz  # against a deployed URL
//
// Spawns its own ephemeral attestation, signs it with a fresh keypair, and
// exercises the full POST /api/attestations path:
//   1. No signature        -> 400
//   2. Wrong-wallet sig    -> 403
//   3. Correct-wallet sig   -> 200, recovered address matches attestor
//
// Each step prints a ✓ / ✗ so a failed smoke run is obvious in CI output.

import { Wallet, verifyMessage } from "ethers";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// --- shared attestation builder -----------------------------------------

import type { Attestation } from "../src/attestation/schema";
import { canonicalAttestationMessage } from "../src/attestation/sign";

function makeAttestation(attestor: string): Attestation {
  return {
    rootHash: `0g-smoke-${Date.now().toString(36)}`,
    kind: "retreat",
    title: "Smoke-test Retreat",
    description: "An ephemeral attestation created by scripts/smoke-signature.ts.",
    claims: {
      location: "Nowhere",
      durationDays: 7,
      priceUsd: 1000,
      capacity: 10,
      practiceStyle: ["vinyasa", "meditation"],
      energyFit: ["settled", "low"],
      socialFit: ["solo", "small-circle"],
      breathPhase: ["even"],
    },
    attestor,
    createdAt: new Date().toISOString(),
  };
}

// --- tiny test harness ---------------------------------------------------

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];

async function step(name: string, fn: () => Promise<void>) {
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertionError(msg);
}

async function postAttestation(
  body: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}/api/attestations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* non-JSON body, that's fine */
  }
  return { status: res.status, body: parsed };
}

// --- the actual checks ---------------------------------------------------

async function waitForServer(): Promise<void> {
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
  console.log(`\nArdum signature smoke — ${baseUrl}\n`);
  await waitForServer();

  const attestor = Wallet.createRandom();
  const impostor = Wallet.createRandom();
  const attestation = makeAttestation(attestor.address);
  const message = canonicalAttestationMessage(attestation);
  const goodSig = await attestor.signMessage(message);
  const badSig = await impostor.signMessage(message);

  // Sanity: client and server agree on the canonical format.
  await step("client signature recovers to attestor", async () => {
    const recovered = verifyMessage(message, goodSig);
    assert(
      recovered.toLowerCase() === attestor.address.toLowerCase(),
      `expected ${attestor.address}, got ${recovered}`
    );
  });

  // 1. No signature -> 400
  let res400: { status: number; body: unknown } = { status: 0, body: null };
  await step("missing signature -> 400", async () => {
    res400 = await postAttestation({ attestation });
    assert(res400.status === 400, `got ${res400.status}: ${JSON.stringify(res400.body)}`);
  });

  // 2. Wrong wallet signs -> 403
  let res403: { status: number; body: unknown } = { status: 0, body: null };
  await step("wrong-wallet signature -> 403", async () => {
    res403 = await postAttestation({ attestation, signature: badSig });
    assert(res403.status === 403, `got ${res403.status}: ${JSON.stringify(res403.body)}`);
    const body = res403.body as { recovered?: string; expected?: string };
    assert(
      body?.recovered?.toLowerCase() === impostor.address.toLowerCase(),
      `expected recovered=${impostor.address}, got ${body?.recovered}`
    );
    assert(
      body?.expected?.toLowerCase() === attestor.address.toLowerCase(),
      `expected expected=${attestor.address}, got ${body?.expected}`
    );
  });

  // 3. Correct wallet signs -> 200
  let res200: { status: number; body: unknown } = { status: 0, body: null };
  await step("correct signature -> 200", async () => {
    res200 = await postAttestation({ attestation, signature: goodSig });
    assert(res200.status === 200, `got ${res200.status}: ${JSON.stringify(res200.body)}`);
    const body = res200.body as { attestor?: string; rootHash?: string; storedOn?: string };
    assert(
      body?.attestor?.toLowerCase() === attestor.address.toLowerCase(),
      `attestor in response (${body?.attestor}) != signed wallet (${attestor.address})`
    );
    assert(
      body?.rootHash === attestation.rootHash,
      `rootHash in response (${body?.rootHash}) != submitted (${attestation.rootHash})`
    );
    assert(
      body?.storedOn === "local" || body?.storedOn === "0g",
      `unexpected storedOn: ${body?.storedOn}`
    );
  });

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  console.log(`\n  ${passed} passed, ${failed} failed\n`);

  // Silence unused-var warnings; res400/res200 are inspected by the assertions.
  void res400;
  void res200;

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
