// Edge-safe attestation pool reader. The matching SSE stream route runs
// on the Edge runtime (to clear the 10s Hobby ceiling on Node functions);
// it can't pull in `ethers` or the 0G Storage SDK that the full
// og-storage.ts adapter relies on. This module exposes just enough of
// the same surface — a `listAttestations()` that returns the seed pool
// — without any Node-only dependencies.
//
// Trade-off: the Edge stream sees only the seed attestation pool, not
// anything written by /api/attestations (that route runs on Node and
// caches into a separate isolate's globalThis Map). For the demo this is
// fine; a long-term fix is to back the attestation pool with Supabase
// too, so both runtimes read from the same store.

import { SEED_ATTESTATIONS } from "./seed-attestations";
import type { AttestationIndex } from "@/attestation/schema";

export async function listAttestations(): Promise<AttestationIndex[]> {
  return SEED_ATTESTATIONS.map((a) => ({
    rootHash: a.rootHash,
    kind: a.kind,
    title: a.title,
    description: a.description,
    claims: a.claims,
    attestor: a.attestor,
    createdAt: a.createdAt,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
