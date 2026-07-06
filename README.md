# Ardum — the shape of your practice

*Ardum is mudra reversed. A mudra seals your practice. Ardum finds it.*

Agentic yoga retreat matching built on 0G (Storage + Compute). Verified
attestations, in-browser pose calibration, reasoning visible at every step.
The entire user journey — from intake to booking to post-booking preparation
— is guided by Mira, a persistent agent persona. The matching phase is an
aesthetic journey through generative imagery and ambient sound, not a
loading screen.

## The name

**Mudra** (Sanskrit: मुद्रा) means "seal" or "gesture" — a symbolic shape,
usually of the hands, that directs energy and intention during practice.
**Ardum** is mudra reversed. The seal opened, the search begun.

The Mira orb carries this concept visually: a thin ring inside the orb
represents the mudra seal. When Mira is calm, the ring is complete (the
seal — chin mudra, receptivity). When Mira is thinking, the ring opens —
a gap appears (the seal cracked open, inquiry — Ardum, the reversed mudra).
When Mira is speaking, the ring radiates outward (the offering — abhaya
mudra, fearlessness). The gap *is* the concept. A mudra seals. Ardum opens.

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
- **Cognee — Mira's memory layer** (`src/lib/cognee.ts`) — a persistent,
  hybrid graph-vector memory store that replaces the localStorage
  fingerprint for real cross-session recall. Mira remembers every
  practitioner's energy trajectory, past matches, bookings, and notes
  across infinite sessions. The four lifecycle verbs (`remember`,
  `recall`, `improve`, `forget`) map to the user journey: intake →
  match → feedback → right-to-be-forgotten. Self-hosted or Cognee Cloud,
  env-gated with graceful no-op fallback. See the
  [Cognee section](#cognee--miras-memory-layer) below.
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
- **Mira — agent persona** (`src/components/MiraOrb.tsx`,
  `src/agent/mira-voice.ts`) — a breathing orb (4s calm cycle matching
  relaxed breathing rhythm) that anchors every interaction. Mira's voice
  is warm, second-person, present tense. Present at every step: intake,
  match letter, booking conversation, post-booking preparation plan.
  Three orb states: calm (idle), thinking (reasoning), speaking (active
  dialogue).
- **Aesthetic journey** (`src/aesthetics/`) — the matching phase is an
  interactive visual + sound experience, not a loading spinner. While
  the agent reasons via SSE, the user journeys through curated imagery
  (12-image pool with 15-dimensional aesthetic vectors) and hears an
  ambient drone synthesized via Web Audio API. Their reactions (resonate
  / skip, weighted by dwell time) build a preference vector that:
  (1) drives bandit-style image selection, (2) shifts the drone in
  real-time, (3) gets woven into Mira's match letter, (4) informs the
  fal.ai prompt for the generated retreat vision. Token-efficient: ~8
  curated interactions at zero cost, 1 fal.ai call for the generated
  retreat vision (Tier 2), falls back to curated Unsplash if
  `FAL_KEY` is not set.
- **fal.ai** (`@fal-ai/client`) — generative imagery for the retreat
  vision (Tier 2) and post-booking preparation plan (Tier 3, future).
  Uses flux/schnell (4 inference steps). 1 call per match, not per
  interaction. Falls back to curated Unsplash images if
  `FAL_KEY` is not set.
- **Motion design** — Lenis smooth scroll (`@studio-freight/lenis`),
  GSAP-powered parallax hero, scroll-driven reveals, and a 3D retreat
  carousel. The motion layer is cinematic but restrained — depth and
  rhythm, not spectacle.

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
    api/generate-vision/ # fal.ai retreat vision generation (Tier 2)
    api/magic/wallet/ # Magic TEE wallet creation (server-side, from JWT)
    api/openfort/account/ # Openfort account creation + sponsored tx
    api/prep-checkin/  # MiraCheckIn daily prep (POST writes to Cognee, GET recalls)
    match/            # reasoning-reveal + match card + booking CTA
      [id]/           # match detail page — Mira's agent letter
    attest/           # wallet-gated attestation upload (gasless + classic)
  aesthetics/         # Aesthetic journey — imagery + sound during matching
    image-pool.ts      # 12 curated images with 15-dim aesthetic vectors
    AmbientDrone.ts    # Web Audio API drone synthesizer
    AestheticJourney.tsx # interactive image + sound experience
  agent/              # 0G Compute client + matching prompts + Mira voice
    mira-voice.ts      # Mira's dialogue generation (letter, booking, class, prep)
    score.ts           # AXES registry — single source of truth for matching
    prompts.ts         # LLM prompt construction
    client.ts          # 0G Compute Router client
  booking/            # transaction abstraction + conversational booking
    MagicAuth.tsx       # Magic SDK social login provider (connectWithUI)
    UniversalAccount.tsx # Particle UA EIP-7702 + cross-chain deposit
    ConversationalBooking.tsx # booking as dialogue with Mira (not wizard)
    ClassInvitation.tsx # drop-in class as agent invitation (not checkout)
    MiraCheckIn.tsx     # 5-day conversational prep; Mira asks "how do you feel today?" each day
    BookingFlow.tsx     # legacy 4-step booking UI (kept for reference)
    BookButton.tsx      # "Book this retreat" CTA on match detail
    ClassPayment.tsx    # legacy x402 drop-in class payment flow
    ClassButton.tsx     # legacy "Drop-in class ($N)" CTA
    OperatorAuth.tsx    # Particle Auth + ZeroDev session keys for operators
    OperatorWalletButton.tsx # "Sign in with Google (gasless)" on /attest
    OpenfortWallet.tsx  # Openfort embedded wallet provider
    types.ts            # booking + class-access attestation types
    constants.ts        # Arbitrum + Base Sepolia + USDC constants
    escrow-abi.ts       # RetreatDepositEscrow ABI
    canonical.ts        # booking attestation signing canonical
  calibration/        # conversational intake + MediaPipe pose-check
    Intake.tsx          # guided introspection with Mira present at each step
    intakeSteps.ts      # 3 questions with Mira's voice + why explanation
    PoseCheck.tsx       # in-browser pose calibration (MediaPipe)
  matching/           # match result types + reasoning UI + viral share
    StoryCard.tsx       # 1080×1920 SVG IG-Stories match card (system serif fallback)
  attestation/        # attestation schema + wallet button
  components/         # shared UI
    MiraOrb.tsx         # the breathing orb (calm/thinking/speaking states)
    AgentLetter.tsx     # Mira's match letter + inline booking
    ParallaxHero.tsx    # GSAP parallax hero section
    ScrollReveal.tsx    # scroll-driven reveal animations
    RetreatCarousel.tsx # 3D retreat carousel for /retreats
    SmoothScroll.tsx    # Lenis smooth scroll provider
    ProgressiveBlurImage.tsx # progressive image loading
    MaskReveal.tsx      # mask reveal animation for match results
  lib/                # env, session dispatcher + adapters, fingerprint, supabase, seed data
    env.ts              # env access + hasMagic/hasParticleUA/hasZeroDev/hasOpenfort predicates
    session.ts          # async dispatcher (memory or supabase)
    session.memory.ts   # in-memory adapter (demo mode)
    session.supabase.ts # Supabase adapter (production)
    fingerprint.ts      # local cross-session memory (browser-only)
    time.ts             # humanizeAgo(iso) — shared temporal anchor ("three days ago")
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
| `FAL_KEY` | fal.ai generative imagery for the retreat vision (Tier 2). If not set, falls back to curated Unsplash images matched to the user's dominant aesthetic quality. 1 call per match — token-efficient. |
| `COGNEE_BASE_URL` + `COGNEE_API_KEY` | Mira's persistent memory layer. Self-hosted (`http://localhost:8000`) for the Open Source track, or Cognee Cloud (`https://tenant-<uuid>.aws.cognee.ai` — the `<uuid>` is your Tenant ID from the dashboard; the shared `api.aws.cognee.ai` host returns 404) for the Cloud track. If not set, memory calls are no-ops and the app uses localStorage-only recall. |

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

## Cognee — Mira's memory layer

> **The Hangover Part AI: Where's My Context?** — WeMakeDevs hackathon,
> Jun 29 – Jul 5 2026. Build AI that doesn't forget with Cognee's
> self-hosted, hybrid graph-vector memory layer.

Mira was already a "persistent agent persona" — but her memory was fake.
A localStorage fingerprint with 3 fields and a 1-30 day window. No
cross-device recall. No knowledge graph. No way to learn over time.

Cognee replaces that with a real memory layer. Mira now genuinely
remembers every practitioner across infinite sessions — their energy
trajectory, past matches, bookings, and the things they've told her. The
more you use Ardum, the richer the graph becomes, and the more precisely
Mira can match you.

### The four memory verbs in Ardum

| Cognee verb | Where it fires | What gets stored/retrieved |
|---|---|---|
| **`remember()`** | After intake, after match, after booking, and after each MiraCheckIn daily-prep answer (Day 1 / 3 / 5) | "Practitioner arrived with energy=low, budget=1k-2k, notes='recovering from burnout'. Matched to Restorative Yin in Ubud, score 0.87." — or — "MiraCheckIn response on 2026-07-07T12:00:00Z. Retreat: Restorative Yin in Ubud. Day 3. Practitioner said: 'Sore but present.'" |
| **`recall()`** | Before match (SSE stream), before Mira's letter | "What do I know about this practitioner?" → past visits, energy trajectory, past matches, bookings, notes |
| **`improve()`** | User-triggered from `/memory` page | Enrich the graph, prune stale nodes, surface deeper relationships. Maps to Cognee's `POST /api/v1/cognify` (there is no `/improve` endpoint — cognify is the graph-building pipeline that does the enrichment/improvement) |
| **`forget()`** | User-triggered from `/memory` page | Surgical wipe of one practitioner's entire memory via `POST /api/v1/forget` (right to be forgotten) |

### REST API contract

The client in `src/lib/cognee.ts` targets Cognee's REST API directly (no SDK
dependency). Verified against the live OpenAPI spec at
`/openapi.json` on the tenant host:

| Verb | Endpoint | Notes |
|---|---|---|
| `remember` | `POST /api/v1/remember` | Multipart form: `data` (file blob), `datasetName`, optional `session_id`, `run_in_background` |
| `recall` | `POST /api/v1/recall` | JSON body: `query`, `datasets` (names), `searchType` (`GRAPH_COMPLETION` \| `CHUNKS` \| `RAG_COMPLETION` \| `SUMMARIES`), `topK` |
| `improve` | `POST /api/v1/cognify` | JSON body: `datasets` (names array, **not** `datasetName`), `runInBackground` |
| `forget` | `POST /api/v1/forget` | JSON body: `{ dataset }` (name) or `{ everything: true }` for a full wipe |
| `listDatasets` | `GET /api/v1/datasets/` | Trailing slash is required — without it the server 307-redirects to an insecure `http://` URL |
| `getDatasetGraph` | `GET /api/v1/datasets/{id}/graph` | `{id}` is the dataset UUID (looked up by name via `listDatasets`). Returns `{ nodes:[{id,label,type,properties}], edges:[{source,target,label}] }` |
| `forget` (single) | `DELETE /api/v1/datasets/{id}` | `{id}` is the dataset UUID |

Auth is a single `X-Api-Key` header (apiKey in the `ApiKeyAuth` security
scheme). The shared `api.aws.cognee.ai` host returns 404 for every
`/api/v1/*` route — only the tenant-scoped host
(`https://tenant-<uuid>.aws.cognee.ai`) serves the memory API.

### Architecture

```
PRACTITIONER VISITS
  │
  ├─ Intake → POST /api/profile
  │    └─ cognee.remember(userId, intake text)  → graph + vector store
  │
  ├─ Match stream → GET /api/agent/match/stream?session=...&user=...
  │    ├─ cognee.recall(userId, "what do I know?")  → MemoryContext
  │    ├─ SSE event: memory  → UI shows "Mira remembers you"
  │    ├─ Agent reasons with memory context fed into prompt
  │    └─ cognee.remember(userId, match result)  → graph + vector store
  │
  ├─ Match detail → /match/[id]?session=...&user=...
  │    ├─ cognee.recall(userId)  → MemoryContext
  │    └─ Mira's letter opens with recognition, not a cold start
  │
  └─ Memory page → /memory
       ├─ GET /api/memory?userId=...  → cognee.recall  → transparency
       ├─ POST { action: "improve" }  → cognee.improve  → enrich graph
       └─ POST { action: "forget" }   → cognee.forget   → wipe memory
```

### Same code, two prize tracks

The integration uses Cognee's REST API directly (no SDK dependency).
The base URL is env-gated — one codebase, two tracks:

| Track | Config | Prize |
|---|---|---|
| **Best Use of Open Source** | `COGNEE_BASE_URL=http://localhost:8000` (self-hosted Docker) | Apple MacBook per team member |
| **Best Use of Cognee Cloud** | `COGNEE_BASE_URL=https://tenant-<uuid>.aws.cognee.ai` + `COGNEE_API_KEY` (free Developer plan with code COGNEE-35). The `<uuid>` is your Tenant ID from the Cognee Cloud dashboard — the shared `api.aws.cognee.ai` host does **not** serve the memory API. | Apple iPhone 17 per team member |

When neither is set, every Cognee call is a graceful no-op — the app
runs in demo mode with localStorage-only memory, exactly as before.

> **Verified end-to-end** against a live Cognee Cloud tenant: a full
> `remember` → `cognify` → `recall` (both `CHUNKS` and `GRAPH_COMPLETION`)
> → `getDatasetGraph` → `forget` round-trip returns the expected results,
> and the graph endpoint returns `{nodes, edges}` in the shape the
> `MemoryGraph` visualization consumes directly.

### Persistent user identity

Cognee memory is keyed by a persistent user ID stored in localStorage
(`ardum:user-id`), not the ephemeral session ID. This means Mira's
memory survives across sessions, devices (if localStorage syncs), and
serverless cold-starts. The session ID is still used for the session
store (profile, match run) but Cognee operations use the stable user ID.

### Reliability — graceful fallback everywhere

Every Cognee call degrades silently. The match flow never breaks if
Cognee is unavailable:

| Failure mode | What happens |
|---|---|
| Env vars not set | `hasCognee()` returns false — every verb is a no-op, app runs in demo mode |
| Credits exhausted (HTTP 402) | `!res.ok` path logs the error, returns safe default (void / empty array) |
| Bad API key (401/403) | Same — logged, no-op |
| Cognee down / network error | try/catch logs the error, returns safe default |
| Malformed JSON response | Defensive try/catch in `recallContext()`, returns `EMPTY_MEMORY` |
| Client disconnects mid-stream | `req.signal` aborts the fetch, stream closes cleanly |

`recallContext()` — the only Cognee call on the critical match path —
is wrapped in a defensive try/catch that returns `EMPTY_MEMORY` on any
unexpected throw. The match agent gets no memory context, but it still
reasons and recommends. Mira just doesn't show the "welcome back" banner.

`remember()` calls are all fire-and-forget (`void ... .catch(() => {})`)
at every call site. If Cognee can't store, the match still happens —
the practitioner just won't be remembered next time.

The `/memory` transparency page checks `hasCognee()` and shows a clear
"Cognee not configured · demo mode" indicator when env vars are missing,
so judges can tell which track is active.

### Files

| File | Role |
|---|---|
| `src/lib/cognee.ts` | Server-only Cognee REST client — the four verbs + structured memory context builder. Extended with `PriorCheckIn` type + `parsePriorCheckIns()` so the match letter + MemoryBanner can surface a practitioner's most-recent `MiraCheckIn` answers, sorted by recency. |
| `src/app/api/memory/route.ts` | Frontend API — recall (GET), improve + forget (POST) |
| `src/app/memory/page.tsx` | "What Mira remembers" transparency page with controls |
| `src/agent/mira-voice.ts` | `matchLetter()` and `preparationPlan()` accept optional `MemoryContext`. `matchLetter()` pastes a recognition block right after the pastNotes paragraph: day-branched ("ready to let go of" / "your energy was" / "you said you felt") and temporally anchored ("three days ago") so returning users see what they told Mira, dated. |
| `src/lib/time.ts` | Shared temporal helper — `humanizeAgo(iso)` returns "yesterday", "three days ago", "a week ago". Imported by both `src/agent/mira-voice.ts` (server-side recognition block) and `src/app/match/page.tsx` (client MemoryBanner) so the temporal anchor reads identically on every Mira surface. |
| `src/lib/fingerprint.ts` | Added persistent `getOrCreateUserId()` / `clearUserId()` |
| `src/app/api/profile/route.ts` | Fires `cognee.remember()` after intake |
| `src/app/api/agent/match/route.ts` | Recalls before match, remembers after |
| `src/app/api/agent/match/stream/route.ts` | Emits `memory` SSE event (now includes `priorCheckIns` from `cognee.recall()`), remembers after done |
| `src/app/api/prep-checkin/route.ts` | MiraCheckIn daily-prep server (POST: each Day 1 / 3 / 5 answer → `cognee.remember()`; GET: prior responses for a `(userId, retreatRootHash)` pair). Graceful no-op when Cognee env isn't configured. |
| `src/app/match/page.tsx` | Handles `memory` SSE event + surfaces the compounding loop in the in-stream `MemoryBanner` before the match lands. Day-branched `checkInQuote()` helper keeps the verb register-matched: Day ≥ 4 ("ready to let go of"), Day 3 ("your energy was"), Day 1 ("you said you felt"). |
| `src/app/match/[id]/page.tsx` | Recalls memory (incl. `priorCheckIns`) for Mira's letter |
| `src/booking/MiraCheckIn.tsx` | Post-booking daily check-in (Day 1 / 3 / 5). `useState` lazy initializer reads `localStorage` synchronously so returning users don't see a Day-1 re-mount flicker. Persists per-booking, scoped by `retreatRootHash`. Each answer POSTs to `/api/prep-checkin` so Cognee retains the recognition source. |
| `src/booking/ConversationalBooking.tsx` | Threaded `retreatRootHash` + `priorCheckIns` + `answeredAt` through to the prep plan so post-booking Mira says "right, you told me three days ago." |
| `src/matching/StoryCard.tsx` | Viral SVG 1080×1920 IG-Stories match card. System serif fallback so it rasterises anywhere without waiting on webfonts. Mira's quote + retreat title wrap via native `<text>+<tspan>`; palette derived from the same `vectorToPalette` arithmetic that drives the MiraOrb marble veins. |
| `src/matching/ShareMatch.tsx` | Two affordances, side-by-side: "Share your match" (clipboard / native-share) and "Save to Camera Roll" (1080×1920 PNG). The download path runs `renderToStaticMarkup → data URI → Image → canvas → toBlob → <a download>`. A 1100ms `mira-glow` dwell makes the click feel like a small ceremony, not a generic export. URLs carry `?ref=share` for downstream attribution. |

### Why this scores well

- **Potential Impact**: Persistent memory for a wellness agent that guides
  people over months/years — not just one session
- **Creativity**: The "Mira remembers your practice journey" narrative;
  the graph captures how a practitioner's energy evolves over time
- **Technical Excellence**: Clean adapter pattern matching existing
  codebase, graceful fallback, all four Cognee verbs used meaningfully
- **Best Use of Cognee**: All four lifecycle operations with real purpose,
  graph traversals for "what retreats has this user shown interest in,"
  `improve()` for feedback-based enrichment
- **User Experience**: Transparency page showing what Mira remembers +
  one-tap forget
- **Presentation**: The "mudra reversed" concept extends — "A mudra seals.
  Ardum opens. Cognee remembers."

---

### Compounding loop — Mira remembers across bookings

The match doesn't start cold. Returning practitioners see **specific words they typed earlier, dated inline, before the match even lands**. Both surfaces are anchored on the same `(retreat, day, answer, answeredAt)` quad that `parsePriorCheckIns()` extracts from Cognee raw recall and sorts by recency:

- **In-stream `MemoryBanner`** (during SSE reasoning) — *"You were excitable when you last sat with me, three days ago, on Yin Ubud."*
- **Mira's match letter** (after SSE settles) — *"Last time you told me you were ready to let go of 'sore but present', let's see if that's shifted."*

The temporal anchor (`three days ago`) is produced by the shared `humanizeAgo(iso)` helper in `src/lib/time.ts`. It is imported by both the server-side `matchLetter()` (recognition block) and the client-side `MemoryBanner` (`checkInQuote()`), so the voice reads identically on both surfaces. Day-branching keeps the verb register-matched: Day ≥ 4 = `ready to let go of`, Day 3 = `your energy was`, Day 1 = `you said you felt`. The Day-3 case suppresses the legacy "your energy was X then" sentence so Mira never names the same signal twice in two consecutive clauses.

The loop is closed by the viral artifact: after a match lands, `ShareMatch.tsx` exports an SVG IG-Stories card via `renderToStaticMarkup → data URI → Image → 1080×1920 canvas → toBlob → <a download>`. The card embeds the same Mira quote that the letter is built from, so a practitioner who sees a friend's Story and clicks through lands in a letter that already speaks to them.

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

---

## Agent-driven UX — Mira + aesthetic journey

The booking experience was functional but indistinguishable from any other
booking site. The agent did the matching and then disappeared at the exact
moment it should have become more present. The entire user journey is now
reimagined around a persistent agent guide.

### Mira — the agent persona

A breathing orb (4s calm cycle, matching relaxed breathing rhythm) anchors
every interaction. Mira's voice is warm, second-person, present tense.
Never says "I am an AI." Talks like a guide who has been doing this for
years. Three orb states: calm (idle), thinking (reasoning), speaking
(active dialogue).

- `src/components/MiraOrb.tsx` — the orb visual
- `src/agent/mira-voice.ts` — dialogue generation for every touchpoint

### Touchpoint transformation

| Touchpoint | Before | After |
|---|---|---|
| Onboarding | 3-question form | Mira orb + voice guides each question as a conversation |
| Match detail | Product listing (photo, title, price, button) | Personal letter from Mira with reasoning woven in (and prior-check-in recognition if you're returning) |
| Booking | 4-step wizard with progress bar | Conversation — Mira narrates each step inline |
| Post-booking | Success screen with tx hash | 5-day personalized preparation plan based on match signals, with daily `MiraCheckIn` rounds ("how do you feel today?") that Mira remembers across sessions |
| Drop-in class | "Drop-in class ($25)" button | Spontaneous invitation from Mira, opened with empathy |
| Share match | Cold link | "Save to Camera Roll" — a 1080×1920 IG-Stories card drawn from the same palette as Mira's marble veins |

### Aesthetic journey — the matching phase as experience

The matching phase was dead time — a loading spinner. Now it is the
experience. While the agent reasons via SSE, the user journeys through
curated imagery with an ambient drone that shifts based on their reactions.

**Tier 1 (zero API cost):**
- 12-image curated pool with 15-dimensional aesthetic vectors
- Web Audio API ambient drone synthesizer — no files, no API, deterministic
- Bandit-style image selection (exploitation + exploration)
- Dwell-time-weighted preference vector updates

**Tier 2 (1 fal.ai call per match):**
- API route generates a custom retreat vision image from accumulated
  preferences + retreat location/practice style
- Falls back to curated Unsplash if `FAL_KEY` not set

**Tier 3 (future, lazy-loaded):**
- Each day of the 5-day prep plan gets a unique generative image
- Deeper personalization after commitment — loss aversion works in our favor

The user's aesthetic preferences are woven into Mira's match letter:
*"While I was thinking, you were drawn to ocean and warm tones. That tells
me something about where you'd thrive."*

### Token efficiency

| Phase | API calls | Cost |
|---|---|---|
| 8 curated interactions | 0 | $0 |
| Retreat vision (Tier 2) | 1 fal.ai | ~$0.003 |
| Prep plan images (Tier 3, future) | 5 fal.ai (lazy) | ~$0.015 |
| **Total per user** | **~6** | **~$0.018** |
