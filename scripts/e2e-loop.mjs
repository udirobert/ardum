#!/usr/bin/env node
// scripts/e2e-loop.mjs
//
// End-to-end live loop: re-seed the Bali retreat attestations to 0G
// Storage using the real Indexer (when OG_* vars are configured) and
// deploy RetreatDepositEscrow to Arbitrum Sepolia (when the deployer
// key is configured). Skip-with-exit-0 if either is unset so the
// script is safe to invoke from CI / smoke runs in demo mode.
//
// Usage:
//   node scripts/e2e-loop.mjs
//   node scripts/e2e-loop.mjs --no-escrow     # skip the contract step
//   node scripts/e2e-loop.mjs --no-seed       # skip the attestations step
//
// Prereqs in .env.local:
//   OG_RPC_URL, OG_STORAGE_INDEXER, OG_PRIVATE_KEY
//   ESCROW_DEPLOYER_PRIVATE_KEY (funded on Arbitrum Sepolia)
//
// See docs/OPERATIONS.md for the full operator guide.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

// Bash-free .env.local reader (mirrors scripts/deploy-escrow.ts)
try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // .env.local may not exist; rely on ambient env.
}

const baseUrl = (process.env.ARDUM_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const skipSeed = process.argv.includes("--no-seed");
const skipEscrow = process.argv.includes("--no-escrow");

const ogReady = Boolean(
  process.env.OG_RPC_URL &&
    process.env.OG_STORAGE_INDEXER &&
    process.env.OG_PRIVATE_KEY,
);
const escrowReady = Boolean(process.env.ESCROW_DEPLOYER_PRIVATE_KEY);

if (!ogReady && !escrowReady && !skipSeed && !skipEscrow) {
  console.log(
    "e2e-loop: no OG_* or escrow vars in .env.local — skipping live loop.",
  );
  console.log(
    "Configure at least one of {OG_RPC_URL, OG_STORAGE_INDEXER, OG_PRIVATE_KEY} or {ESCROW_DEPLOYER_PRIVATE_KEY} to run for real.",
  );
  process.exit(0);
}

const startedAt = Date.now();

// ── 1. Re-seed attestations to 0G Storage via the running app ───────
if (!skipSeed) {
  if (!ogReady) {
    console.log(
      "e2e-loop: OG_* not configured — attestation re-seed SKIPPED (demo seed already in the in-memory store).",
    );
  } else {
    const url = `${baseUrl}/api/attestations/seed`;
    console.log(`e2e-loop: POST ${url}`);
    const res = await fetch(url, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(
        `e2e-loop: seed failed (${res.status}): ${JSON.stringify(body)}`,
      );
      process.exit(1);
    }
    const seeded = body.seeded ?? [];
    console.log(`e2e-loop: seeded ${seeded.length} attestations:`);
    const sample = seeded.slice(0, 3);
    for (const s of sample) {
      const tx = s.txHash ? `  tx=${s.txHash}` : "";
      console.log(`  ${s.rootHash} → ${s.storedOn}${tx}`);
    }
    if (seeded.length > sample.length) {
      console.log(`  ... and ${seeded.length - sample.length} more`);
    }
  }
}

// ── 2. Deploy escrow on Arbitrum Sepolia ────────────────────────────
if (!skipEscrow) {
  if (!escrowReady) {
    console.log(
      "e2e-loop: ESCROW_DEPLOYER_PRIVATE_KEY not configured — escrow deploy SKIPPED.",
    );
  } else {
    console.log(
      "e2e-loop: deploying RetreatDepositEscrow via scripts/deploy-escrow.ts ...",
    );
    await new Promise((resolve, reject) => {
      const child = spawn(
        "npx",
        ["tsx", "scripts/deploy-escrow.ts"],
        {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env,
        },
      );
      child.on("exit", (code) =>
        code === 0
          ? resolve(undefined)
          : reject(new Error(`deploy-escrow exited ${code}`)),
      );
      child.on("error", reject);
    });
  }
}

const durationMs = Date.now() - startedAt;
console.log(`\ne2e-loop: complete in ${durationMs}ms.`);
