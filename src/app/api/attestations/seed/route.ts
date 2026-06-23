import { NextResponse } from "next/server";
import { SEED_ATTESTATIONS } from "@/lib/seed-attestations";
import { uploadAttestation } from "@/lib/og-storage";

// One-shot: push the curated Bali seed into the attestation store (local or
// 0G, depending on env). Idempotent — re-running won't duplicate because
// rootHash is the key.
export const dynamic = "force-dynamic";

export async function POST() {
  const results = [];
  for (const a of SEED_ATTESTATIONS) {
    const r = await uploadAttestation(a);
    results.push({ ...r, title: a.title });
  }
  return NextResponse.json({ seeded: results });
}
