# 0009 — Agent API (A2MCP) and agent-driven booking

- Status: Accepted
- Date: 2026-07-22

## Context

Ardum's practitioner journey is human-driven: a person converses with Mira,
clarifies their intention, receives a recommendation, places a hold, and
grants commitment. The commitment execution layer (Magic → Particle UA →
EIP-7702 → cross-chain deposit → escrow → attestation) is already real and
verified on Arbitrum Sepolia.

But the booking infrastructure — the API, the escrow, the attestation layer
— is useful beyond the human-driven flow. Any AI agent with a funded wallet
can book retreats on behalf of its users. This is distribution engineered
into the product: the agent API is the channel, not SEO or paid acquisition.

The OKX.AI Genesis Hackathon requires ASPs (Agent Service Providers) to
expose A2MCP-compatible endpoints — HTTPS URLs that return results (free)
or 402 payment challenges (paid via x402). This is simpler than a full
Anthropic MCP server: "MCP" in A2MCP means "agents calling APIs," not the
MCP protocol.

Separately, the operator attestation flow (Particle Auth + ZeroDev Kernel)
was full of crypto jargon. A non-crypto yoga teacher needs to list a retreat
without learning what a wallet, gas, or attestation is. The /attest page
was de-jargoned, and an agent-callable intake endpoint was added so an
agent can structure a natural-language retreat description and pre-fill the
form.

## Decision

### 1. Three agent-callable A2MCP endpoints

All three are free endpoints (HTTP 200 with results). The "payment" for
bookings is the on-chain escrow deposit, not an x402 call.

| Endpoint | Purpose |
|---|---|
| `POST /api/agent/match` | Takes intention + constraints, creates an episode, runs the real recommendation pipeline, returns matched retreat(s) + episodeId |
| `POST /api/agent/attest` | Validates + structures retreat details from natural language (agent conversation), returns a pre-fill URL for the operator to sign and publish |
| `POST /api/agent/book` | Takes episodeId + depositTxHash + agent signature, verifies the signature, records the booking attestation to 0G, marks episode as booked |

Each endpoint also has a `GET` service-discovery response documenting its
schema, so agents (and marketplace reviewers) can introspect before calling.

### 2. Signature-based identity for agent calls

Agent API calls don't use cookies. The booking endpoint verifies identity
via EIP-191 `personal_sign`: the agent signs a canonical message containing
`episodeId`, `retreatRootHash`, `depositTxHash`, `depositUsd`, and
`agentAddress`. The server verifies the signature recovers to the claimed
agent address.

### 3. Repository `get` without ownership filter

The episode repository gained a `get(episodeId)` method that looks up an
episode without filtering by actor. This is used only by the agent booking
endpoint, where identity is proven by signature, not cookie. The existing
`getOwned(actorId, episodeId)` remains the default for all cookie-based
flows.

`applyEpisodeCommand` gained a `skipOwnershipCheck` flag for the same
purpose. When true, it uses `get` instead of `getOwned` and passes the
episode's actual `actorId` to `save`.

### 4. Operator flow: de-jargoned + agent-assisted

The /attest page speaks the operator's language, not the engineer's:

- "Tell us about a retreat you run."
- "Sign in with Google. No crypto wallet, no ETH, no technical setup."
- "Publish retreat →"

The OperatorWalletButton hides all crypto details (smart account address,
session key status, gasless tx test). The operator sees "Sign in with
Google" → "signed in" → done.

The agent intake endpoint (`POST /api/agent/attest`) lets an agent collect
retreat details in natural language, validate them, and generate a pre-fill
URL. The operator's experience: chat with agent → click link → form is
pre-filled → sign in with Google → publish.

### 5. Agent booking script

`scripts/agent-book.ts` demonstrates the full agent-driven flow:
capture → clarify → recommend → hold → on-chain deposit → signed
attestation → episode booked. A real booking was executed and verified
on Arbitrum Sepolia (1 USDC to escrow, block 288972600).

The script handles two rails:
- **Mainnet** (Arbitrum One): Particle UA + EIP-7702 cross-chain deposit
- **Testnet** (Sepolia): direct ERC-20 transfer (UA supports mainnet only)

### 6. Operator identity: Particle Auth + ZeroDev Kernel

The operator flow uses a separate account abstraction system from the
practitioner flow:

- **Practitioner**: Magic EOA → Particle UA (EIP-7702) → cross-chain deposit
- **Operator**: Particle Auth EOA → ZeroDev Kernel (ERC-4337) → gasless attestations

The two systems cannot run on the same EOA, so they're split by persona.
The operator's Particle Auth social login (Google) provides the EOA;
ZeroDev Kernel sponsors gas; a session key enables batch attestation
writes without re-signing each one.

## Consequences

- The agent API is the distribution channel. Listing on OKX.AI (or any
  agent marketplace) makes Ardum discoverable by any AI agent that needs
  travel booking infrastructure.
- The `get` method and `skipOwnershipCheck` flag are narrow additions
  scoped to the agent API path. Cookie-based flows are unchanged.
- The operator flow is now usable by non-crypto users. The crypto
  infrastructure (Particle Auth, ZeroDev, 0G, Arbitrum) is real but
  invisible behind "Sign in with Google."
- The agent booking script is a demo, not the product. The product is the
  UX paradigm + the agent API + the operator relationships. The script
  proves the infrastructure works.
- The proof page links to a real on-chain transaction, not a mock.

## Alternatives considered

- **Full Anthropic MCP server.** Rejected for now: OKX.AI's A2MCP is
  simpler (HTTPS endpoint, not MCP protocol), and the existing Next.js
  API routes already serve the purpose. An MCP server can be added later
  for Anthropic-specific agent integrations.
- **x402 paid endpoints.** Rejected: the matching and intake endpoints are
  free (discovery should be frictionless). The booking "payment" is the
  escrow deposit, which goes through Ardum's own escrow, not OKX's x402.
  Charging per-call for matching would reduce agent adoption.
- **Cookie-based identity for agent calls.** Rejected: agents don't have
  cookies. Signature-based identity is the right model for agent API calls.
- **Keep crypto jargon on /attest.** Rejected: the operator is a non-crypto
  user (yoga teacher). The form must speak their language. The crypto
  infrastructure is real but hidden.

## Related

- [product-vision.md](../product-vision.md) — agent-as-distribution
- [architecture.md](../architecture.md) — agent API boundary
- [0008-agentic-commitment.md](0008-agentic-commitment.md) — grant model
- [OPERATIONS.md](../OPERATIONS.md) — agent-book.ts, agent API endpoints
