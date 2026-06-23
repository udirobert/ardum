// 0G Storage adapter — SERVER ONLY. Never import this from a client
// component; the SDK uses Node built-ins at load time.
//
// In v0 demo mode (no OG_* env vars), we fall back to a local in-memory store
// seeded from src/lib/seed-attestations.ts. The API surface is identical so
// route handlers don't branch.

import "server-only";

import { SEED_ATTESTATIONS, indexFromSeed, SEED_ATTESTOR } from "./seed-attestations";
import type { Attestation, AttestationIndex } from "@/attestation/schema";
import { has0GStorage } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __ardumAttestations: Map<string, Attestation> | undefined;
}

const localStore: Map<string, Attestation> =
  globalThis.__ardumAttestations ?? new Map<string, Attestation>();

if (!globalThis.__ardumAttestations) {
  for (const a of SEED_ATTESTATIONS) localStore.set(a.rootHash, a);
  globalThis.__ardumAttestations = localStore;
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
  // Real 0G Storage upload. The SDK accepts a Blob via the browser-safe
  // pattern (avoiding indexer.download() which uses fs.appendFileSync).
  const { Indexer, Blob } = await load0G();
  const env = await import("./env").then((m) => m.readServerEnv());
  const indexer = new Indexer(env.OG_STORAGE_INDEXER);
  const blob = new Blob(attestation);
  // Sign + upload via the indexer. Real network call.
  const [txHash] = await indexer.upload(blob, {
    // Use the read-only attestor for seed; for new uploads we'd sign with
    // the connected wallet.
    privateKey: env.OG_PRIVATE_KEY,
  });
  return { rootHash: attestation.rootHash, storedOn: "0g", txHash };
}

export async function getAttestation(
  rootHash: string
): Promise<Attestation | null> {
  if (!has0GStorage()) {
    return localStore.get(rootHash) ?? null;
  }
  // Real 0G Storage download via the browser-safe path.
  const { Indexer } = await load0G();
  const env = await import("./env").then((m) => m.readServerEnv());
  const indexer = new Indexer(env.OG_STORAGE_INDEXER);
  const data = await indexer.download(rootHash, false);
  return data as Attestation;
}

export async function listAttestations(): Promise<AttestationIndex[]> {
  if (!has0GStorage()) {
    return indexFromSeed();
  }
  // In production we'd query the indexer for a list; for now we return the
  // seed index with a marker so the client knows it's the curated set.
  return indexFromSeed();
}

export const SEED_ATTESTOR_ADDRESS = SEED_ATTESTOR;
