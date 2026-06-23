import { NextResponse } from "next/server";
import { verifyMessage } from "ethers";
import { listAttestations, getAttestation, uploadAttestation } from "@/lib/og-storage";
import type { Attestation } from "@/attestation/schema";
import { canonicalAttestationMessage } from "@/attestation/sign";

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

// Write an attestation. Requires a wallet signature over the canonical
// payload — the recovered address must equal attestation.attestor. Without
// this proof the upload is rejected, even in demo mode.
export async function POST(req: Request) {
  let body: { attestation: Attestation; signature: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { attestation, signature } = body;
  if (!attestation?.rootHash || !attestation?.attestor) {
    return NextResponse.json(
      { error: "Attestation missing rootHash or attestor." },
      { status: 400 }
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature — attestations must be signed by the wallet." },
      { status: 400 }
    );
  }

  // Verify the signature recovers to the claimed attestor.
  const message = canonicalAttestationMessage(attestation);
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 }
    );
  }
  if (recovered.toLowerCase() !== attestation.attestor.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Signature does not match attestor.",
        recovered,
        expected: attestation.attestor,
      },
      { status: 403 }
    );
  }

  const result = await uploadAttestation(attestation);
  return NextResponse.json({ ...result, signature, attestor: recovered });
}
