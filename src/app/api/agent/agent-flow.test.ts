// Agent-path integration test — the full /api/agent/match → /api/agent/book
// flow with real EIP-191 signatures (ethers Wallet) and mocked seams:
// episode service, episode repository, 0G Storage, and on-chain deposit
// verification (no RPC, no network).
//
// What this pins down:
//   1. match: signature → actorId binding, nonce single-use (replay 400),
//      recommendation surfaced, episodeId handed to the book step.
//   2. book: ownership enforced (actorId === signing address), canonical
//      v2 message binding (operator, deposit tx, amount all signed),
//      on-chain verification gate, commitment recorded with an
//      idempotency key derived from the deposit tx.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Wallet } from "ethers";

// Wallets are module-scope, NOT vi.hoisted: vi.hoisted factories are lifted
// above all imports, so referencing `Wallet` there throws
// "Cannot access 'import_0' before initialization". The wallets are only used
// at request time (signing/verifying), by which point imports are initialized.
const AGENT_WALLET = new Wallet("0x" + "a1".repeat(32));
const STRANGER_WALLET = new Wallet("0x" + "b2".repeat(32));

const {
  createdEpisodes,
  serviceCommands,
  setDepositResult,
  clearDepositResult,
} = vi.hoisted(() => {
  const createdEpisodes: unknown[] = [];
  const serviceCommands: Array<{ type: string; [key: string]: unknown }> = [];
  const setDepositResult = (v: unknown) => {
    (globalThis as Record<string, unknown>).__testDepositResult = v;
  };
  const clearDepositResult = () => {
    delete (globalThis as Record<string, unknown>).__testDepositResult;
  };
  return { createdEpisodes, serviceCommands, setDepositResult, clearDepositResult };
});

vi.mock("@/episodes/service", () => ({
  createEpisode: vi.fn(async (actorId: string) => {
    const episode = {
      schemaVersion: 1,
      id: "episode-agent-test",
      actorId,
      revision: 1,
      status: "recommended" as const,
      intentions: [
        {
          version: 1,
          statement: "I want a quiet week to make room for rest.",
          constraints: {},
          changeReason: "Initial intention",
          createdAt: "2026-08-24T00:00:00.000Z",
        },
      ],
      events: [],
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    createdEpisodes.push(episode);
    return episode;
  }),
  applyEpisodeCommand: vi.fn(async (_actorId, _episodeId, command) => {
    serviceCommands.push(command);
    if (command && (command as { type?: string }).type === "recommend") {
      return {
        episode: {
          revision: 2,
          recommendation: {
            result: {
              retreatTitle: "Sidemen Restoration Week",
              retreatRootHash: "bali-sidemen-restoration-week",
              attestor: "0x" + "c3".repeat(20),
              priceUsd: 1200,
              retreatLocation: "Bali, Indonesia",
              score: 0.9,
              headline: "A quiet valley that carries your pace.",
            },
          },
        },
      };
    }
    return { episode: { revision: 3, status: "booked" } };
  }),
}));

vi.mock("@/episodes/repository", () => ({
  episodeRepository: {
    get: vi.fn(async (id: string) =>
      id === "episode-agent-test" && createdEpisodes.length > 0
        ? createdEpisodes[createdEpisodes.length - 1]
        : null,
    ),
  },
}));

vi.mock("@/lib/og-storage", () => ({
  uploadAttestation: vi.fn(async (attestation: { rootHash: string }) => ({
    rootHash: attestation.rootHash,
  })),
  listAttestations: vi.fn(async () => [
    {
      kind: "retreat",
      rootHash: "bali-sidemen-restoration-week",
      title: "Sidemen Restoration Week",
      attestor: "0x" + "c3".repeat(20),
      claims: { priceUsd: 1200, location: "Bali, Indonesia" },
    },
  ]),
}));

vi.mock("@/booking/deposit-verify", () => ({
  verifyDepositTx: vi.fn(async () =>
    (globalThis as Record<string, unknown>).__testDepositResult ?? {
      verified: "sender" as const,
    },
  ),
}));

import { POST as matchPost } from "./match/route";
import { POST as bookPost } from "./book/route";
import {
  canonicalAgentMatchMessage,
  canonicalAgentBookingMessage,
} from "@/booking/canonical";
import { clearNonceCacheForTest } from "@/booking/agent-replay";

const OPERATOR = "0x" + "c3".repeat(20);
const RETREAT_ROOT = "bali-sidemen-restoration-week";
const DEPOSIT_TX = "0x" + "d4".repeat(32);

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function makeNonce(tag: string) {
  return `${tag}-${Math.random().toString(36).slice(2, 10)}`;
}

async function signedMatch(nonce: string, wallet = AGENT_WALLET) {
  const timestamp = nowSeconds();
  const intention = "I want a quiet week to make room for rest.";
  const signature = await wallet.signMessage(
    canonicalAgentMatchMessage({
      intention,
      agentAddress: wallet.address,
      nonce,
      timestamp,
    }),
  );
  return matchPost(
    new Request("http://localhost/api/agent/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intention,
        agentAddress: wallet.address,
        nonce,
        timestamp,
        signature,
      }),
    }),
  );
}

async function signedBook(
  nonce: string,
  signer = AGENT_WALLET,
  overrides: Record<string, unknown> = {},
) {
  const timestamp = nowSeconds();
  const payload = {
    episodeId: "episode-agent-test",
    retreatRootHash: RETREAT_ROOT,
    operatorAddress: OPERATOR,
    depositTxHash: DEPOSIT_TX,
    depositUsd: 1,
    agentAddress: signer.address,
    nonce,
    timestamp,
    ...overrides,
  };
  const { episodeId, retreatRootHash, operatorAddress, depositTxHash, depositUsd, agentAddress, ...rest } =
    payload;
  const signature = await signer.signMessage(
    canonicalAgentBookingMessage({
      episodeId,
      retreatRootHash,
      operatorAddress,
      depositTxHash,
      depositUsd,
      agentAddress,
      nonce: rest.nonce as string,
      timestamp: rest.timestamp as number,
    }),
  );
  return bookPost(
    new Request("http://localhost/api/agent/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, signature }),
    }),
  );
}

describe("agent flow: match → book", () => {
  beforeEach(async () => {
    clearNonceCacheForTest();
    createdEpisodes.length = 0;
    serviceCommands.length = 0;
    clearDepositResult();
    vi.clearAllMocks();
  });

  it("completes the full flow: signed match episodes, signed book books", async () => {
    const matchRes = await signedMatch(makeNonce("m1"));
    expect(matchRes.status).toBe(200);
    const matchBody = (await matchRes.json()) as {
      episodeId: string;
      topMatch: { retreatRootHash: string };
    };
    expect(matchBody.episodeId).toBe("episode-agent-test");
    expect(matchBody.topMatch.retreatRootHash).toBe(RETREAT_ROOT);

    // The match created an episode owned by the signing agent.
    const created = createdEpisodes[createdEpisodes.length - 1] as {
      actorId: string;
      intentions: Array<{ statement: string }>;
    };
    expect(created.actorId).toBe(AGENT_WALLET.address);
    expect(created.intentions[0].statement).toContain("quiet week");

    const bookRes = await signedBook(makeNonce("b1"));
    expect(bookRes.status).toBe(200);
    const bookBody = (await bookRes.json()) as {
      episodeStatus: string;
      depositVerification: string;
      bookingRootHash: string;
    };
    expect(bookBody.episodeStatus).toBe("booked");
    expect(bookBody.depositVerification).toBe("sender");
    expect(bookBody.bookingRootHash).toContain(RETREAT_ROOT.slice(0, 16));

    // The recommend command ran at match time and a commitment was recorded
    // at book time with an idempotency key derived from the deposit tx.
    const types = serviceCommands.map((c) => (c as { type: string }).type);
    expect(types).toContain("recommend");
    const commitment = serviceCommands.find(
      (c) => (c as { type: string }).type === "record-commitment",
    ) as unknown as { idempotencyKey: string; depositTxId: string };
    expect(commitment.idempotencyKey).toBe(`booking:${DEPOSIT_TX}`);
    expect(commitment.depositTxId).toBe(DEPOSIT_TX);
  }, 30_000);

  it("rejects a replayed match nonce (single-use)", async () => {
    const nonce = makeNonce("m2");
    expect((await signedMatch(nonce)).status).toBe(200);
    const replay = await matchPost(
      new Request("http://localhost/api/agent/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intention: "I want a quiet week to make room for rest.",
          agentAddress: AGENT_WALLET.address,
          nonce,
          timestamp: nowSeconds(),
          signature: "0x" + "00".repeat(65),
        }),
      }),
    );
    // The nonce is rejected regardless of signature validity.
    expect(replay.status).toBe(400);
    expect(((await replay.json()) as { error: string }).error).toContain(
      "Nonce already used",
    );
  }, 30_000);

  it("rejects a booking from an agent that does not own the episode", async () => {
    // Match (creates the episode owned by the agent's address).
    expect((await signedMatch(makeNonce("m3"))).status).toBe(200);

    // A stranger attempts the booking for the same episode. The signature is
    // valid for the stranger, but actorId !== stranger → 403.
    const res = await signedBook(makeNonce("b3"), STRANGER_WALLET);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("does not own this episode");
  }, 30_000);

  it("rejects the booking when on-chain deposit verification fails", async () => {
    expect((await signedMatch(makeNonce("m4"))).status).toBe(200);

    setDepositResult({
      verified: "failed",
      reason: "Transaction not found on settle chain (all endpoints consulted).",
    });
    const res = await signedBook(makeNonce("b4"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Deposit verification failed");

    // No commitment may have been recorded on a failed verification.
    expect(
      serviceCommands.some(
        (c) => (c as { type: string }).type === "record-commitment",
      ),
    ).toBe(false);
  }, 30_000);
});
