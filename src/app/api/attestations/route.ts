import { NextResponse } from "next/server";
import { listAttestations, getAttestation, uploadAttestation } from "@/lib/og-storage";
import type { Attestation } from "@/attestation/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rootHash = url.searchParams.get("rootHash");
  if (rootHash) {
    const a = await getAttestation(rootHash);
    if (!a) {
      return NextResponse.json(
        { error: "Attestation not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ attestation: a });
  }
  const attestations = await listAttestations();
  return NextResponse.json({ attestations });
}

// Write an attestation. In demo mode this stores locally; in 0G mode the
// write is gated by a wallet signature verification step (TODO once the
// wallet flow is wired on the client).
export async function POST(req: Request) {
  let body: { attestation: Attestation };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.attestation?.rootHash) {
    return NextResponse.json(
      { error: "Attestation missing rootHash." },
      { status: 400 }
    );
  }
  const result = await uploadAttestation(body.attestation);
  return NextResponse.json(result);
}
