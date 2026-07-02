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

## Folder structure

```
src/
  app/                # App Router routes + API handlers
    api/agent/match/  # server-only 0G Compute Router proxy (sync + SSE)
      counterfactual/ # re-score with a different weight balance
      perspectives/   # Restorative + Movement lens comparison
    api/attestations/ # server-only 0G Storage upload/retrieve
    match/            # reasoning-reveal + match card
    attest/           # wallet-gated attestation upload
  calibration/        # conversational intake + MediaPipe pose-check
  matching/           # match result types + reasoning UI
  attestation/        # attestation schema + wallet button
  agent/              # 0G Compute client + matching prompts (server-only)
  lib/                # env, session dispatcher + adapters, fingerprint, supabase, seed data
    session.ts          # async dispatcher (memory or supabase)
    session.memory.ts   # in-memory adapter (demo mode)
    session.supabase.ts # Supabase adapter (production)
    fingerprint.ts      # local cross-session memory (browser-only)
scripts/              # seed + supabase migration
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
  Magic social login (Google) → EOA created in TEE (no seed phrase)
    → Particle UA SDK: EIP-7702 upgrade on Arbitrum (one-time delegation)
    → createTransferTransaction: deposit in any token on any chain
      → UA routes cross-chain automatically, settles on Arbitrum
    → booking written as new "booking" attestation kind to 0G Storage

OPERATOR — "Attest your retreat"  (upgraded from MetaMask)
  Particle Auth social login → EOA
    → ZeroDev Kernel smart account (ERC-4337, separate from practitioner UA)
    → ZeroDev paymaster sponsors gas (operator never needs ETH)
    → ZeroDev session keys: batch attestation writes without re-signing each
    → attestations written to 0G Storage (existing flow, new signing path)

DROP-IN CLASS — "Pay per session"  (new, lighter than full retreat booking)
  Openfort embedded wallet (email / Google / guest)
    → x402: request class → HTTP 402 → sign USDC TransferWithAuthorization
    → facilitator settles on-chain → class access granted
    → access written as new "class-access" attestation kind to 0G Storage

0G STORAGE (untouched, extended)
  Existing: "retreat" attestations + matching via 0G Compute
  New: "booking" + "class-access" attestation kinds
  → 0G remains the single source of truth for metadata + bookings + access
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
| Arbitrum bounty | $2,000 | Deposit escrow contract deployed on Arbitrum; UA settles there |
| Magic Labs bounty | $500 | Social login (Google) creates practitioner's embedded wallet |
| ZeroDev subtrack | $500 | Operator gas sponsorship + session keys for batch attestations |
| Openfort subtrack | $100 | x402 micropayments for drop-in classes |
| General Track | $2,000 | Umbrella — the whole booking UX |

**Total eligible: ~$7,600 across 6 prizes.**

### Build phases (finale Jul 30)

| Phase | What | Prizes unlocked | Risk |
|-------|------|-----------------|------|
| 1 | Practitioner booking: Magic + Particle UA + EIP-7702 + Arbitrum deposit contract | $5,000 (UA + Magic + Arbitrum) | Medium — smart contract + SDK integration |
| 2 | 0G extension: "booking" attestation kind, booking API route | enables phase 1 | Low — extends existing patterns |
| 3 | Operator upgrade: Particle Auth + ZeroDev Kernel + session keys | $500 (ZeroDev) | Medium — new operator signing path |
| 4 | Drop-in classes: Openfort + x402 micropayments | $100 (Openfort) | Low — well-documented recipe |
| 5 | Polish: booking UX flow, match detail → "Book" CTA, confirmation | General Track judging | Low — UI work |

If only Phases 1–2 land, the project is already eligible for $5,000.

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
works and the demo repos use it. If V2 drops mid-hackathon, the migration
is scoped to the practitioner booking path only — operator and drop-in
flows are unaffected.
