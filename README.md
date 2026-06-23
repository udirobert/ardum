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
  from server-side route handlers only
- **Supabase / Postgres + pgvector** — session cache and
  lineage-resonance embeddings (optional for v0 demo)

## Folder structure

```
src/
  app/                # App Router routes + API handlers
    api/agent/match/  # server-only 0G Compute Router proxy
    api/attestations/ # server-only 0G Storage upload/retrieve
    match/            # reasoning-reveal + match card
    attest/           # wallet-gated attestation upload
  calibration/        # conversational intake + MediaPipe pose-check
  matching/           # match result types + reasoning UI
  attestation/        # attestation schema + wallet button
  agent/              # 0G Compute client + matching prompts (server-only)
  lib/                # env, session, supabase, seed data
scripts/              # one-off seed scripts (Bali retreat attestations)
```

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run seed     # upload seed Bali-retreat attestations to 0G Storage
```

Ardum runs in **demo mode** without any environment variables set —
in-memory session store, the five seeded Bali retreats, and a
deterministic local matcher that produces the real `MatchResult` shape.
This is enough for a judge-facing demo link.

## Wire up production

Copy `.env.example` to `.env.local` and fill in the variables for the
layers you want to enable. Each one is independent:

| Vars                                | What you get                                                  |
| ----------------------------------- | ------------------------------------------------------------- |
| `OG_RPC_URL` + `OG_STORAGE_INDEXER` + `OG_PRIVATE_KEY` | Real `POST /api/attestations` writes to 0G Storage; the seed script uploads the Bali retreats for real. |
| `OG_COMPUTE_ROUTER_URL` + `OG_COMPUTE_API_KEY`         | The matching agent calls the real 0G Compute Router instead of the deterministic stub. The prompt + response shape are already wired. |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`           | Sessions and match runs persist across restarts and across Vercel serverless cold-starts. |

The adapter at `src/lib/og-storage.ts` lazy-imports the SDK only when
needed, and the agent at `src/agent/client.ts` throws loudly (not
silently) if a layer is configured but the call isn't implemented.

## Deploy

Push to `main` → Vercel auto-deploys. The whole point of this stack is a
shareable judge link that opens fast.

## Privacy stance

Raw camera frames never leave the browser. Wallet is only required for
writing attestations, never for browsing or matching. The 0G Compute Router
is only ever called from server-side route handlers.
