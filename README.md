# Ardum — the shape of your practice

Agentic yoga retreat matching built on 0G (Storage + Compute). Verified
attestations, in-browser pose calibration, reasoning visible at every step.

## Design references

Repos that informed Ardum's agent-consumable retreat language and pose workflow:

- **[Xe/when-then-zen](https://github.com/Xe/when-then-zen)** — Meditation instructions
  formalized as Gherkin scenarios (`Given/When/Then`). Ardum's agent reasoning
  follows the same pattern: retreat offerings and practices are structured as
  spec-like facts that agents can consume, reason over, and surface to the user.
  The metta and noting features are the closest model for how we encode practice
  metadata in the matching pool.

- **[sepandhaghighi/nafas](https://github.com/sepandhaghighi/nafas)** — CLI breathwork
  app with programmable cycles (`inhale / retain / exhale / sustain` ratios +
  durations). Nafas's JSON config schema (`{ unit, pre, cycle, ratio }`) is the
  template for how breathwork activities get parameterized in Ardum's attestation
  layer — agents reason over structured breath ratios, not prose.

- **[alexcumplido/yoga-api](https://github.com/alexcumplido/yoga-api)** — REST API
  returning yoga poses with SVG/PNG images. SVG assets could serve the PoseCheck
  calibration UI. The API occasionally 503s; self-hosting from the SQLite source
  is the reliable path.

## Stack

- **Next.js 16.2** (App Router, Turbopack, React 19)
- **MediaPipe** (`@mediapipe/tasks-vision`) — in-browser pose/breath calibration
  (raw video stays in the browser tab; only derived joint-angle/breath baseline
  is sent upstream)
- **ethers v6** — wallet connection for attestation writes only (read/match
  flows stay walletless)
- **0G Storage SDK** (`@0gfoundation/0g-storage-ts-sdk`) — attestation layer
  (server-only via route handlers; sidesteps the Node-built-ins issue that
  breaks Vite/browser imports)
- **0G Compute Router** — agent orchestration & matching reasoning, called
  from server-side route handlers only. In demo mode a deterministic local
  matcher produces the same `MatchRun` shape the real call would return.
  When configured, the agent calls the OpenAI-compatible `/v1/chat/completions`
  endpoint and streams reasoning from a real LLM; if the call fails it falls
  back to the local scorer (the `agentTrace.provider` field records which
  path ran).
- **Reasoning transport** — Server-Sent Events stream reasoning steps in
  real time; the UI renders them as the agent produces them. Reasoning is
  structured as Gherkin (Given / When / Then) so the agent's logic is
  inspectable, not free-form.
- **Session store** — async dispatcher at `src/lib/session.ts`. The
  in-memory adapter (`session.memory.ts`) is the default; setting
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` switches the same API
  to the Supabase adapter (`session.supabase.ts`) which persists across
  serverless cold-starts. Apply `scripts/migrate-supabase.sql` once to
  create the `sessions` table.
- **Single source of truth for matching** — `src/agent/score.ts` exports
  an `AXES` registry. The local scorer walks it, the LLM prompt in
  `src/agent/prompts.ts` reads it. Adding or changing a rule happens in
  one place.
- **Counterfactual reasoning** — after a match, the agent can re-score
  the same attestation pool with a different composite weight balance
  and surface the alternate top match. Three presets
  (energy / social / budget heavy) live in
  `src/app/api/agent/match/counterfactual/route.ts`. The UI in
  `src/matching/Counterfactual.tsx` shows the shifted ranking with the
  same Given/When/Then reasoning under each lens.
- **Two perspectives on the match** — every match page also runs the
  Restorative and Movement lenses (see `LENSES` in `score.ts`) and
  shows them side-by-side. When they agree, the balanced top is robust;
  when they disagree, the user sees both camps and the gap between
  them. No extra LLM calls — both are computed deterministically
  from the same `AXES` registry.
- **Local cross-session memory** — a fingerprint in `localStorage`
  (energy, budget, social, optional pose baseline) lets the Intake
  greet a returning user. Gated to a 1-30 day window, opt-in (the
  user always confirms before the old answers are reused), and
  one-tap clearable from the match page footer. Nothing leaves the
  browser; the matching run is still session-scoped server-side.
- **Magic SDK** (`magic-sdk`) — social login (Google) creates an embedded
  wallet for practitioners. No MetaMask, no seed phrase. Also supports
  EIP-7702 authorization signing for Particle UA delegation.
- **Particle Universal Account SDK** (`@particle-network/universal-account-sdk`)
  — upgrades the Magic EOA via EIP-7702 on Arbitrum, enabling cross-chain
  deposits (any token, any chain → settles on Arbitrum).
- **Particle Auth** (`@particle-network/auth`) — social login for operators,
  separate from the practitioner flow.
- **ZeroDev SDK** (`@zerodev/sdk` + `@zerodev/ecdsa-validator`) — ERC-4337
  Kernel smart account for operators. Gas sponsorship via paymaster +
  session keys for batch attestation writes.
- **Openfort** (`@openfort/react`) — embedded wallet + x402 micropayments
  for drop-in class access. Settles on Base Sepolia (testnet).
- **Solidity** — `RetreatDepositEscrow.sol` deployed on Arbitrum Sepolia
  at `0xBEe032998c7A1d9268075Dfc2061514143d5B796`. Handles deposit,
  check-in, claim, refund, and cancel-expired flows.

## Folder structure

```
src/
  app/                # App Router routes + API handlers
    api/agent/match/  # server-only 0G Compute Router proxy (sync + SSE)
      counterfactual/ # re-score with a different weight balance
      perspectives/   # Restorative + Movement lens comparison
    api/attestations/ # server-only 0G Storage upload/retrieve
    api/bookings/     # booking attestation writer (verifies sig → 0G Storage)
    api/classes/access/ # x402 payment-gated class access (402 → verify → grant)
    api/magic/wallet/ # Magic TEE wallet creation (server-side, from JWT)
    api/openfort/account/ # Openfort account creation + sponsored tx
    match/            # reasoning-reveal + match card + booking CTA
    attest/           # wallet-gated attestation upload (gasless + classic)
  booking/            # UXmaxx hackathon booking layer
    MagicAuth.tsx       # Magic SDK social login provider (connectWithUI)
    UniversalAccount.tsx # Particle UA EIP-7702 + cross-chain deposit
    BookingFlow.tsx     # 4-step booking UI (sign in → delegate → deposit → attest)
    BookButton.tsx      # "Book this retreat" CTA on match detail
    ClassPayment.tsx    # x402 drop-in class payment flow
    ClassButton.tsx     # "Drop-in class ($N)" CTA on match detail
    OperatorAuth.tsx    # Particle Auth + ZeroDev session keys for operators
    OperatorWalletButton.tsx # "Sign in with Google (gasless)" on /attest
    OpenfortWallet.tsx  # Openfort embedded wallet provider
    types.ts            # booking + class-access attestation types
    constants.ts        # Arbitrum + Base Sepolia + USDC constants
    escrow-abi.ts       # RetreatDepositEscrow ABI
    canonical.ts        # booking attestation signing canonical
  calibration/        # conversational intake + MediaPipe pose-check
  matching/           # match result types + reasoning UI
  attestation/        # attestation schema + wallet button
  agent/              # 0G Compute client + matching prompts (server-only)
  lib/                # env, session dispatcher + adapters, fingerprint, supabase, seed data
    env.ts              # env access + hasMagic/hasParticleUA/hasZeroDev/hasOpenfort predicates
    session.ts          # async dispatcher (memory or supabase)
    session.memory.ts   # in-memory adapter (demo mode)
    session.supabase.ts # Supabase adapter (production)
    fingerprint.ts      # local cross-session memory (browser-only)
contracts/            # Solidity contracts
  RetreatDepositEscrow.sol # deposit escrow (Arbitrum Sepolia)
scripts/              # seed + supabase migration + escrow deployment
  deploy-escrow.ts     # compile + deploy escrow to Arbitrum Sepolia/mainnet
```

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run seed     # upload seed Bali-retreat attestations to 0G Storage
```

Ardum runs in **demo mode** without any environment variables set —
in-memory session store, ten seeded retreats across six locations, and a
deterministic local matcher that produces the real `MatchResult` shape.
This is enough for a judge-facing demo link.

## Wire up production

Copy `.env.example` to `.env.local` and fill in the variables for the
layers you want to enable. Each one is independent:

| Vars                                | What you get                                                  |
| ----------------------------------- | ------------------------------------------------------------- |
| `OG_RPC_URL` + `OG_STORAGE_INDEXER` + `OG_PRIVATE_KEY` | Real `POST /api/attestations` writes to 0G Storage; the seed script uploads the Bali retreats for real. |
| `OG_COMPUTE_ROUTER_URL` + `OG_COMPUTE_API_KEY` [+ `OG_COMPUTE_MODEL`] | The matching agent calls the 0G Compute Router (OpenAI-compatible `/v1/chat/completions`) with graceful fallback: if the LLM call fails, the deterministic local scorer runs instead and the `agentTrace.provider` field records `"0g-compute-fallback"`. |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`           | Sessions and match runs persist across restarts and across Vercel serverless cold-starts. Apply `scripts/migrate-supabase.sql` once to create the `sessions` table; nothing else to configure. |
| `NEXT_PUBLIC_MAGIC_API_KEY` [+ `MAGIC_SECRET_KEY`] | Practitioner social login (Google) via Magic `connectWithUI()`. Secret key enables server-side TEE wallet creation via `/api/magic/wallet`. |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` + `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` + `NEXT_PUBLIC_PARTICLE_APP_ID` [+ `PARTICLE_SERVER_KEY`] | Particle Universal Account (EIP-7702 cross-chain deposits) for practitioners + Particle Auth social login for operators. Server key enables Particle server API calls. |
| `NEXT_PUBLIC_ZERODEV_API_KEY` | ZeroDev gas sponsorship + session keys for operator attestations. RPC URL constructed automatically: `https://rpc.zerodev.app/api/v3/{key}/chain/{chainId}`. |
| `NEXT_PUBLIC_OPENFORT_PUBLIC_KEY` + `NEXT_PUBLIC_OPENFORT_POLICY_ID` [+ `OPENFORT_SECRET_KEY`] | Openfort embedded wallet + x402 micropayments for drop-in classes. Settles on Base Sepolia (testnet). Secret key enables server-side account creation + sponsored transactions. |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` | The deployed `RetreatDepositEscrow` address on Arbitrum Sepolia (`0xBEe032998c7A1d9268075Dfc2061514143d5B796`). Set `NEXT_PUBLIC_USE_TESTNET=true` to target Sepolia. |

The adapter at `src/lib/og-storage.ts` lazy-imports the SDK only when
needed, and the agent at `src/agent/client.ts` falls back gracefully
to the deterministic scorer when a configured layer fails — the
`agentTrace.provider` field records which path ran so you can
diagnose silently.

## Reliability

- **Bounded 0G Compute calls.** The SSE stream aborts the upstream
  fetch after 30 s (`COMPUTE_TIMEOUT_MS`) and on client disconnect
  (`req.signal`), then runs the local scorer so the user always gets a
  match.
- **Transparent fallback.** When the local scorer runs because the
  LLM was unavailable, the `MatchCard` footer shows
  `agent · local scorer (0G Compute unavailable) · prompt match.v0.2`.
- **Auditable reasoning.** Reasoning steps are emitted as Gherkin
  (Given / When / Then). The same `AXES` registry that powers the
  local scorer is fed into the LLM prompt, so the model's reasoning
  and the deterministic fallback describe the same rules.

## Deploy

Push to `main` → Vercel auto-deploys. The whole point of this stack is a
shareable judge link that opens fast.

## Privacy stance

Raw camera frames never leave the browser. Wallet is only required for
writing attestations, never for browsing or matching. The 0G Compute Router
is only ever called from server-side route handlers.

---

## UXmaxx Hackathon — transaction abstraction layer

Ardum is entering the [UXmaxx Hackathon](https://encode.club/) (Particle
Network + Arbitrum + Magic Labs + ZeroDev + Openfort, Jun 22 – Jul 30 2026).
The goal: reimagine the yoga retreat **booking** experience so it feels like
booking a hotel — no MetaMask, no gas, no chain selection, no seed phrase.

This is **additive** — 0G Storage and 0G Compute remain the attestation and
matching layer. The booking layer is new code that sits downstream of the
existing match flow. Nothing in `src/attestation/`, `src/agent/`, or
`src/lib/og-storage.ts` is removed.

### Architecture — each wallet/AA solution powers a distinct persona

```
PRACTITIONER — "Book this retreat"  (new, downstream of matching)
  Magic social login (Google) → EOA via connectWithUI()
    → Particle UA SDK: EIP-7702 upgrade on Arbitrum (one-time delegation)
    → createTransferTransaction: deposit in any token on any chain
      → UA routes cross-chain automatically, settles on Arbitrum Sepolia
      → escrow contract: 0xBEe032998c7A1d9268075Dfc2061514143d5B796
    → booking written as new "booking" attestation kind to 0G Storage

OPERATOR — "Attest your retreat"  (upgraded from MetaMask)
  Particle Auth social login → EOA
    → ZeroDev Kernel smart account (ERC-4337, separate from practitioner UA)
    → ZeroDev paymaster sponsors gas (operator never needs ETH)
    → ZeroDev session keys: batch attestation writes without re-signing each
    → attestations written to 0G Storage (existing flow, new signing path)

DROP-IN CLASS — "Pay per session"  (new, lighter than full retreat booking)
  Sign in (Magic) → x402 flow:
    → GET /api/classes/access → HTTP 402 + payment requirements
    → Sign payment authorization (personal_sign)
    → POST /api/classes/access → verify signature → settle on Base Sepolia
    → Openfort sponsors gas via policy pol_68129a95-...
    → access written as new "class-access" attestation kind to 0G Storage

0G STORAGE (untouched, extended)
  Existing: "retreat" attestations + matching via 0G Compute
  New: "booking" + "class-access" attestation kinds
  → 0G remains the single source of truth for metadata + bookings + access

CROSS-CHAIN ARCHITECTURE
  Booking deposits  → Arbitrum Sepolia (chain 421614) — Particle UA + escrow
  Class payments    → Base Sepolia (chain 84532) — Openfort + x402
  Operator gas      → sponsored by ZeroDev paymaster (no chain needed)
```

### Why the personas don't conflict

Particle UA (EIP-7702) and ZeroDev Kernel (ERC-4337) are competing account
abstraction implementations — they cannot run on the same EOA. The split
avoids this: the **practitioner** gets a Particle Universal Account
(EIP-7702, cross-chain deposits), the **operator** gets a ZeroDev Kernel
account (gas sponsorship + session keys for batch attestations). Different
users, different accounts, no overlap.

### Prize coverage

| Prize | Amount | Integration |
|-------|--------|-------------|
| Universal Accounts Track | $2,500 | Particle UA SDK in EIP-7702 mode + cross-chain deposit |
| Arbitrum bounty | $2,000 | Deposit escrow contract deployed on Arbitrum Sepolia; UA settles there |
| Magic Labs bounty | $500 | Social login (Google) creates practitioner's embedded wallet via `connectWithUI()` |
| ZeroDev subtrack | $500 | Operator gas sponsorship + session keys for batch attestations |
| Openfort subtrack | $1,000 | x402 micropayments for drop-in classes on Base Sepolia |
| x402 subtrack | $1,000 | HTTP 402 payment protocol — `GET` returns 402 + requirements, `POST` verifies + settles |
| General Track | $2,000 | Umbrella — the whole booking UX |

**Total eligible: ~$9,500 across 7 prizes.**

### Build phases — all complete

| Phase | What | Status |
|-------|------|--------|
| 1 | Practitioner booking: Magic + Particle UA + EIP-7702 + Arbitrum deposit contract | Done — committed `95c86aa` |
| 2 | Escrow deployment: `RetreatDepositEscrow` compiled + deployed to Arbitrum Sepolia | Done — `0xBEe032998c7A1d9268075Dfc2061514143d5B796` |
| 3 | Operator upgrade: Particle Auth + ZeroDev Kernel + session keys | Done — gasless attestation UI on `/attest` |
| 4 | Drop-in classes: Openfort + x402 micropayments on Base Sepolia | Done — `ClassButton` + `ClassPayment` + `/api/classes/access` |
| 5 | Polish: UXmaxx banner, footer tech stack, match detail CTAs | Done |

### Verified integration paths

- **Magic + Particle UA + EIP-7702**: officially documented by both Particle
  (`developers.particle.network/universal-accounts/cha/how-to/ua-magic`) and
  Magic (`docs.magic.link/recipes/server-wallets/particle-network-universal-accounts`).
  Demo repos: `Particle-Network/ua-7702-magic-demo` (delegates on Arbitrum,
  cross-chain conversion in a single tx) and
  `Particle-Network/universal-accounts-magic-wallet-api` (full Next.js app,
  Google OAuth → Magic → UA → cross-chain mint).
- **ZeroDev + Particle Auth**: documented at `docs.zerodev.app/onboarding/particle`.
  Particle Auth EOA → ZeroDev Kernel smart account → paymaster + session keys.
- **Openfort + x402**: recipe at `openfort.io/docs/recipes/x402` with full-stack
  demo (`openfort-xyz/recipes-hub` → `x402/`). React + Express, HTTP 402-gated
  content, USDC `TransferWithAuthorization`, gasless via Openfort paymaster.

### Risk: Particle UA V2 migration

Particle's docs carry a warning: *"Universal Accounts are upgrading to V2.
This will require a change in your app's account system."* The current SDK
works and the demo repos use it. If V2 drops, the migration is scoped to
the practitioner booking path only — operator and drop-in flows are
unaffected.
