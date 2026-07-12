# OPERATIONS

The two operator surfaces that touch real infrastructure are:

- `scripts/e2e-loop.mjs` — re-seed attestations on 0G Storage and deploy
  the retail escrow contract on Arbitrum Sepolia.
- `scripts/verify-automation.mjs` — probe `/api/internal/automation` to
  confirm the scheduler is alive and authorized.

Both are skip-with-exit-0 by default: in demo mode (no secrets
configured) they print what is missing and exit cleanly, so a CI run
or the smoke journey can call them without breaking.

## End-to-end live loop

```bash
node scripts/e2e-loop.mjs
node scripts/e2e-loop.mjs --no-escrow     # attestation re-seed only
node scripts/e2e-loop.mjs --no-seed       # deploy escrow only
```

What it does, in order:

1. Reads `.env.local` (Next.js convention). Uses ambient env vars if
   `.env.local` is absent.
2. **Seed attestations** — POSTs `/api/attestations/seed` against the
   running app. When `OG_RPC_URL`, `OG_STORAGE_INDEXER`, and
   `OG_PRIVATE_KEY` are set, the route uploads the Bali seed (10
   retreats) to 0G Storage via the real Indexer. When those vars are
   absent, the route falls back to the in-memory local store and the
   script logs `SKIPPED` — the demo still works locally.
3. **Deploy escrow** — shells out to `scripts/deploy-escrow.ts`. Compiles
   `contracts/RetreatDepositEscrow.sol` with `solc-js`, deploys to
   Arbitrum Sepolia by default (`NEXT_PUBLIC_USE_TESTNET=false` flips
   to mainnet), writes the deployed ABI to
   `src/booking/escrow-deployed-abi.json`, and prints
   `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=...` — copy that value back into
   `.env.local` before the next deploy.

### Prerequisites

`.env.local` must contain at least one of the two configuration blocks
below for the loop to do anything.

**0G Storage (testnet)**
- `OG_RPC_URL` — JSON-RPC endpoint for 0G (defaults to the public testnet)
- `OG_STORAGE_INDEXER` — Indexer service URL
- `OG_PRIVATE_KEY` — funded wallet; pays for the Upload tx

**Arbitrum Sepolia escrow**
- `ESCROW_DEPLOYER_PRIVATE_KEY` — wallet with >0.001 ETH on Sepolia
  (faucets at https://faucet.quicknode.com/arbitrum/sepolia and
  https://www.alchemy.com/faucets/arbitrum-sepolia)

### What "good" looks like

```
e2e-loop: POST http://localhost:3000/api/attestations/seed
e2e-loop: seeded 10 attestations:
  bali-ubud-stillness-0001 → 0g  tx=0xa3f1…ce24
  bali-canggu-movement-0002 → 0g  tx=0xb19c…7d12
  bali-sidemen-restoration-0003 → 0g  tx=0xc7ef…42ac
  ... and 7 more
e2e-loop: deploying RetreatDepositEscrow via scripts/deploy-escrow.ts ...
Deploying RetreatDepositEscrow to Arbitrum Sepolia...
✓ Deployed at: 0x1234…abcd
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x1234…abcd

e2e-loop: complete in 4123ms.
```

Each line should be self-describing so a reviewer can read a log
without needing to chase the script.

## Verify the scheduler

```bash
AUTOMATION_URL=https://ardum.app \
AUTOMATION_SECRET=... \
  node scripts/verify-automation.mjs

# JSON mode for nicer dashboards:
AUTOMATION_URL=https://ardum.app \
AUTOMATION_SECRET=... \
  node scripts/verify-automation.mjs --json | jq .
```

- Exit `0` — the deployed app responded 200 with
  `{"checked":..,"failed":..,"considered":..,"startedAt":..,"finishedAt":..,"durationMs":..}`.
- Exit `1` — unreachable or non-200; the body is included in non-JSON
  output.
- Exit `2` — 401 (secret mismatch) or
  `AUTOMATION_URL`/`AUTOMATION_SECRET` not set in the calling shell.

Wire this into an external health monitor (Upptime, cron-job.org health
probes, Better Stack) for a redundant check on top of GitHub Actions'
own run history. The GitHub Actions workflow already exits non-zero on
a tick failure — this script is for monitors that run OUTSIDE GitHub.

## Automation runner contract

**What the runner does**

`/api/internal/automation` calls
`runDueAutomation()` (in `src/automation/runner.ts`) which lists
episodes whose `monitor.nextCheckAt` has elapsed and applies the
`check-monitor` command to each one. Both Supabase and the local
adapter honour this — the contract suite in
`src/episodes/repositories/contract.suite.ts` pins it.

**What the runner does NOT do**

- It does not expire holds automatically. `withExpiredHold()` in
  `src/episodes/service.ts` folds hold expiry into the NEXT service
  call, so any action on the episode naturally rolls the hold forward.
- It does not call external pricing/availability APIs in demo mode —
  `localMonitoringProvider.observe` in `src/automation/local.ts`
  always returns "available at listed price".
- It does not retry failed ticks. If `check-monitor` throws, the
  episode is counted in `failed` and the workflow exits non-zero. The
  next tick picks up where this one left off (because `nextCheckAt`
  isn't advanced on failure).

## Security boundaries

- `scripts/e2e-loop.mjs` reads **signing keys** (OG_PRIVATE_KEY,
  ESCROW_DEPLOYER_PRIVATE_KEY). Treat `.env.local` as the most
  sensitive file in the repo — never commit it, never paste it into a
  chat, never store the deployer key in a long-lived CI secret unless
  you intend for the workflow to deploy too.
- `scripts/verify-automation.mjs` reads only the **shared secret**
  used by the GitHub Actions tick. That secret is not a signing key —
  it gates an HTTP call, nothing more — and is safe to put behind an
  external monitor.
- `/api/internal/automation` does not expose episode contents; it
  exposes only aggregate counts. Keep it that way: freely available
  detail here would leak practitioner activity to anyone who can
  reach the deploy.
