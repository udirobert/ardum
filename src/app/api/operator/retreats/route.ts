import { NextResponse } from "next/server";
import { listAttestations } from "@/lib/og-storage";

export const dynamic = "force-dynamic";

// GET /api/operator/retreats?attestor=0x...
// Returns attestations where the attestor wallet matches. The operator
// identity is the wallet address from the Particle Auth session — there
// is no server-side operator session, so the client passes the address
// as a query param. Attestations are public data; this query just
// filters by attestor.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const attestor = url.searchParams.get("attestor");
  if (!attestor) {
    return NextResponse.json(
      { error: "Missing attestor address." },
      { status: 400 },
    );
  }

  const all = await listAttestations();
  const retreats = all.filter(
    (a) => a.attestor.toLowerCase() === attestor.toLowerCase(),
  );

  return NextResponse.json({ retreats });
}
