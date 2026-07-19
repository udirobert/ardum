# Ardum — Hackathon Submission Content

## Project Description

Ardum is an agentic yoga retreat booking platform that starts from
intention, not inventory. A person tells Mira (the AI guide) what they're
trying to make space for — rest, recovery, reconnection — and Mira
clarifies constraints, recommends one retreat that fits, places a
non-binding hold, and can execute the booking with on-chain escrow when
the person grants authority.

The booking infrastructure is real: USDC deposits to a deployed escrow
contract on Arbitrum Sepolia, attestations stored on 0G Storage, gasless
operator attestations via Particle Auth + ZeroDev Kernel. A real
agent-driven booking was executed and verified on-chain (1 USDC to
escrow, block 288972600).

### What we built

**Practitioner journey (human-driven):**
- Intention-first capture → clarification → one recommendation → hold →
  grant ceremony → on-chain deposit → preparation landing
- Chain abstraction via Magic (social login) → Particle Universal Account
  (EIP-7702) → cross-chain USDC deposit to escrow
- The user never sees a wallet address, chain name, or gas concept

**Operator flow (gasless attestations):**
- Particle Auth (Google social login) → ZeroDev Kernel (ERC-4337) →
  gasless attestation writes to 0G Storage
- De-jargoned UX: "Tell us about a retreat you run" → "Sign in with
  Google" → "Publish retreat"
- Agent-assisted intake: an agent can collect retreat details in natural
  language and pre-fill the form via `/api/agent/attest`

**Agent API (A2MCP — distribution engineered into the product):**
- Three agent-callable endpoints: `/api/agent/match`, `/api/agent/attest`,
  `/api/agent/book`
- Any AI agent with a funded wallet can book retreats on behalf of users
  without a browser, cookie, or human wallet interaction
- Signature-based identity (EIP-191 personal_sign)
- Verified end-to-end: agent captures intention → clarifies → recommends →
  holds → executes on-chain USDC deposit → signs attestation → episode
  booked

### Partner integrations (all real, all verified)

| Partner | Integration | Verification |
|---|---|---|
| **Arbitrum** | Escrow contract deployed on Arbitrum Sepolia; USDC deposits verified on-chain | Block 288972600, 1 USDC in escrow |
| **Particle** | Auth (operator Google login) + Universal Account (practitioner EIP-7702 cross-chain) | Gasless attestations via ZeroDev Kernel |
| **ZeroDev** | Kernel smart account + paymaster + session key for operator gasless writes | Session key enabled on first UserOp |
| **Magic** | Practitioner social login → EOA → Particle UA upgrade | Grant ceremony smoke test passes |
| **0G Storage** | Retreat attestations + booking attestations stored immutably | Seed attestations + real booking attestation |

### Process

1. Built the episode model (intention → clarification → recommendation →
   hold → commitment) as the authoritative state aggregate
2. Implemented deterministic recommendation policy with lens re-rankings
   as derived views
3. Shipped the grant ceremony UX (ready → identity if missing → confirm
   amount and bounds → ambient execution)
4. Integrated Magic + Particle UA for practitioner chain abstraction
5. Integrated Particle Auth + ZeroDev Kernel for operator gasless attestations
6. Built the agent API (three A2MCP endpoints) for agent-driven booking
7. Executed and verified a real agent-driven booking on Arbitrum Sepolia
8. De-jargoned the operator flow for non-crypto users

### Key achievements

- Real on-chain booking executed by an autonomous agent (not a mock)
- Gasless operator attestations via Google social login (no crypto
  knowledge needed)
- Agent API that makes Ardum listable as an Agent Service Provider on
  OKX.AI and other agent marketplaces
- 184 tests passing, including repository contract suite, ranking policy
  property tests, and recommendation conformance tests

## Link to Code

https://github.com/udirobert/ardum

## Link to Presentation

(To be provided by team)

## Link to Demo Video

The final video is at `videos/ardum-demo/renders/ardum-demo-final.mp4` (6.9 MB, 75 seconds).

Upload to YouTube and paste the link here:
- https://www.youtube.com/watch?v=YOUR_VIDEO_ID

## Live Demo Link

https://ardum.vercel.app

### Key pages

- `/` — the practitioner journey (intention → recommendation → hold → book)
- `/proof` — partner integrations, verified on-chain evidence, agent booking
- `/attest` — operator retreat listing (Google sign-in, gasless)
- `/api/agent/match` — agent-callable retreat matching (A2MCP)
- `/api/agent/attest` — agent-callable retreat intake (A2MCP)
- `/api/agent/book` — agent-callable booking execution (A2MCP)

### Verified on-chain

- Agent booking tx: https://sepolia.arbiscan.io/tx/0x7a69ebc21d80ed8b0f6071a0bbd923f99bfa5edc977ab958692eeb27e2734151
- Escrow contract: https://sepolia.arbiscan.io/address/0xBEe032998c7A1d9268075Dfc2061514143d5B796
- Agent wallet: https://sepolia.arbiscan.io/address/0x4Ffc3d69acc65AC350f8e453972E3142379fBC11
