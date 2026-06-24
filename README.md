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
