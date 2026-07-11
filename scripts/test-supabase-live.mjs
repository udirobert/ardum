#!/usr/bin/env node
// Run the episode repository contract suite against a LIVE Supabase
// project. Closes the gap ADR 0003 calls out: the in-process mock covers
// PK uniqueness and FK cascade but does NOT cover SQL type coercion, RPC
// semantics, PostgREST content negotiation, or RLS policies. This runner
// points the same conformance suite at the real database.
//
// Usage:
//   PROD_URL=https://<ref>.supabase.co \
//     PROD_KEY=<service-role-jwt> \
//     node scripts/test-supabase-live.mjs
// Or as one-liner:
//   PROD_URL=... PROD_KEY=... node scripts/test-supabase-live.mjs
// Or via argv:
//   node scripts/test-supabase-live.mjs https://<ref>.supabase.co <key>
//
// What you get when it's green:
//   • All 11 conformance cases in runRepositoryContract pass against the
//     real database (SQL coercion, RPC, RLS write/read semantics).
//   • The id-prefixed probe namespace this run created is cleaned up by
//     the test file's afterAll hook. Unrelated rows in the project are
//     untouched — only rows with the per-run id prefix are deleted.
//
// Exit code 0 on full success; non-zero on any failed case or DB error.

import { spawnSync } from "node:child_process";

const URL = process.env.PROD_URL ?? process.argv[2] ?? "";
const KEY = process.env.PROD_KEY ?? process.argv[3] ?? "";

if (!URL || !KEY) {
  console.error(
    "PROD_URL and PROD_KEY are required.\n" +
      "Pass as env vars or as argv[2] and argv[3].\n\n" +
      "Example:\n" +
      "  PROD_URL=https://<ref>.supabase.co \\\n" +
      "    PROD_KEY=<service-role-jwt> \\\n" +
      "    node scripts/test-supabase-live.mjs",
  );
  process.exit(2);
}

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "--reporter=verbose",
    "src/episodes/repositories/supabase.contract.test.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PROD_URL: URL, PROD_KEY: KEY },
  },
);

process.exit(result.status ?? 1);
