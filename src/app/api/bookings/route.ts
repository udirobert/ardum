import { NextResponse } from "next/server";
import { verifyMessage } from "ethers";
import { uploadAttestation } from "@/lib/og-storage";
import { canonicalBookingMessage } from "@/booking/canonical";
import type { BookingAttestation } from "@/booking/types";

export const dynamic = "force-dynamic";

// GET — list booking attestations (filters by kind in the storage layer)
export async function GET() {
  // For now, bookings are stored as attestations with kind "booking".
  // The existing listAttestations() returns all kinds; the client filters.
  // A dedicated booking list endpoint can be added when the storage layer
  // supports kind-based queries.
  return NextResponse.json({
    message: "Use /api/attestations to list all attestations, filter by kind.",
  });
}

// POST — write a booking attestation to 0G Storage after a successful deposit.
// Requires a wallet signature over the canonical booking payload — the
// recovered address must equal the booking's practitioner address.
export async function POST(req: Request) {
  let body: { booking: BookingAttestation; signature: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { booking, signature } = body;
  if (!booking?.rootHash || !booking?.claims?.practitionerAddress) {
    return NextResponse.json(
      { error: "Booking missing rootHash or practitionerAddress." },
      { status: 400 },
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature — bookings must be signed by the practitioner." },
      { status: 400 },
    );
  }

  // Verify the signature recovers to the practitioner
  const message = canonicalBookingMessage(booking);
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 },
    );
  }
  if (recovered.toLowerCase() !== booking.claims.practitionerAddress.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Signature does not match practitioner.",
        recovered,
        expected: booking.claims.practitionerAddress,
      },
      { status: 403 },
    );
  }

  // Write to 0G Storage (or local store in demo mode) as a generic attestation
  // with kind "booking". The uploadAttestation function accepts any Attestation
  // shape — we cast since the schema is extended, not replaced.
  const result = await uploadAttestation(booking as unknown as Parameters<typeof uploadAttestation>[0]);
  return NextResponse.json({
    ...result,
    signature,
    practitioner: recovered,
  });
}
