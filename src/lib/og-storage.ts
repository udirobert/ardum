// 0G Storage adapter — SERVER ONLY. Never import this from a client
// component; the SDK uses Node built-ins at load time.
//
// In v0 demo mode (no OG_* env vars), we fall back to a local in-memory store
// seeded from src/lib/seed-attestations.ts. The API surface is identical so
// route handlers don't branch.
//
// When OG_* vars are configured, we use:
//   upload    → Indexer.upload(MemData, rpc, signer)  — in-memory, Node-safe
//   download  → Indexer.downloadToBlob(rootHash)       — browser-safe pattern
// We deliberately avoid Indexer.download() which writes to fs.appendFileSync.

import "server-only";

import { ethers } from "ethers";
import { SEED_ATTESTATIONS, SEED_ATTESTOR } from "./seed-attestations";
import type { Attestation, AttestationIndex } from "@/attestation/schema";
import { has0GStorage } from "./env";

declare global {
   
  var __ardumAttestations: Map<string, Attestation> | undefined;
}

const localStore: Map<string, Attestation> =
  globalThis.__ardumAttestations ?? new Map<string, Attestation>();

if (!globalThis.__ardumAttestations) {
  for (const a of SEED_ATTESTATIONS) localStore.set(a.rootHash, a);
  globalThis.__ardumAttestations = localStore;
}

// Convert a full Attestation to the lightweight index shape used by the
// matching agent and the /retreats browser.
function toIndex(a: Attestation): AttestationIndex {
  return {
    rootHash: a.rootHash,
    kind: a.kind,
    title: a.title,
    description: a.description,
    claims: a.claims,
    attestor: a.attestor,
    createdAt: a.createdAt,
  };
}

// Lazily loaded only when 0G is configured. Keeps the SDK out of the bundle
// when we're running in demo mode.
async function load0G() {
  const sdk = await import("@0gfoundation/0g-storage-ts-sdk");
  return sdk;
}

export type UploadResult = {
  rootHash: string;
  storedOn: "0g" | "local";
  txHash?: string;
};

export async function uploadAttestation(
  attestation: Attestation
): Promise<UploadResult> {
  if (!has0GStorage()) {
    localStore.set(attestation.rootHash, attestation);
    return { rootHash: attestation.rootHash, storedOn: "local" };
  }

  const { Indexer, MemData } = await load0G();
  const env = await import("./env").then((m) => m.readServerEnv());

  const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL);
  const signer = new ethers.Wallet(env.OG_PRIVATE_KEY, provider);
  const indexer = new Indexer(env.OG_STORAGE_INDEXER);

  const bytes = new TextEncoder().encode(JSON.stringify(attestation));
  const file = new MemData(bytes);

  const [tx, err] = await indexer.upload(file, env.OG_RPC_URL, signer);
  if (err) throw err;

  // The upload result can be either a single {txHash, rootHash, txSeq} or a
  // batched {txHashes, rootHashes, txSeqs}. Normalise.
  const rootHash =
    "rootHash" in tx
      ? tx.rootHash
      : tx.rootHashes?.[0] ?? attestation.rootHash;
  const txHash =
    "txHash" in tx ? tx.txHash : tx.txHashes?.[0];

  // Cache locally so listAttestations() can include recently uploaded
  // attestations without needing a full indexer listing.
  localStore.set(rootHash, attestation);

  return { rootHash, storedOn: "0g", txHash };
}

export async function getAttestation(
  rootHash: string
): Promise<Attestation | null> {
  if (!has0GStorage()) {
    return localStore.get(rootHash) ?? null;
  }

  const { Indexer } = await load0G();
  const env = await import("./env").then((m) => m.readServerEnv());
  const indexer = new Indexer(env.OG_STORAGE_INDEXER);

  const [blob, err] = await indexer.downloadToBlob(rootHash);
  if (err || !blob) return null;
  const text = await blob.text();
  return JSON.parse(text) as Attestation;
}

export async function listAttestations(): Promise<AttestationIndex[]> {
  // Return every attestation in the local store — seeds plus any
  // user-written attestations. In demo mode the store is the only
  // persistence layer; in production mode it acts as a write-through
  // cache (uploadAttestation sets it on every 0G upload).
  return Array.from(localStore.values())
    .map(toIndex)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Count how many distinct attestations exist for a given rootHash. In demo
// mode this is always 1 (one entry in the local store). In production this
// would query the 0G indexer for all matching root hashes — multiple
// attestors writing to the same rootHash is the way trust accumulates over
// time.
export async function countAttestations(rootHash: string): Promise<number> {
  if (!has0GStorage()) {
    return localStore.has(rootHash) ? 1 : 0;
  }
  // Real path: indexer.query({ rootHash }) — not yet implemented, return 1
  // to keep the UI honest (the entry exists, attestor count is what we
  // don't know yet).
  return localStore.has(rootHash) ? 1 : 0;
}

export const SEED_ATTESTOR_ADDRESS = SEED_ATTESTOR;
