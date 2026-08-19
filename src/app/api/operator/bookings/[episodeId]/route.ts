import { NextResponse } from "next/server";
import { getAttestation, listAttestations } from "@/lib/og-storage";
import { episodeRepository } from "@/episodes/repository";

export const dynamic = "force-dynamic";

// GET /api/operator/bookings/[episodeId]?attestor=0x...
//
// Returns the preparation context for a booked episode: the practitioner's
// coarse intention shape, Mira's preparation plan, and the booking details.
// The operator's wallet must match the retreat's attestor field — this is
// the authorization check. The episode must have a commitment with a
// bookingRootHash that references the operator's retreat.
//
// Privacy: the preparation plan is Mira's voice, not the practitioner's
// verbatim intention. The intention shape is coarse constraints only.
// The verbatim statement is never returned.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ episodeId: string }> },
) {
  const url = new URL(req.url);
  const attestor = url.searchParams.get("attestor");
  if (!attestor) {
    return NextResponse.json(
      { error: "Missing attestor address." },
      { status: 400 },
    );
  }

  const { episodeId } = await params;
  const episode = await episodeRepository.get(episodeId);
  if (!episode) {
    return NextResponse.json(
      { error: "Episode not found." },
      { status: 404 },
    );
  }

  if (!episode.commitment) {
    return NextResponse.json(
      { error: "This episode has no booking." },
      { status: 404 },
    );
  }

  // Resolve the retreat this booking is for
  const recommendation = episode.recommendation;
  if (!recommendation) {
    return NextResponse.json(
      { error: "Episode has no recommendation." },
      { status: 404 },
    );
  }

  const retreatRootHash = recommendation.result.retreatRootHash;
  const retreat = await getAttestation(retreatRootHash);
  if (!retreat) {
    return NextResponse.json(
      { error: "Retreat attestation not found." },
      { status: 404 },
    );
  }

  // Authorization: the operator's wallet must match the retreat's attestor
  if (retreat.attestor.toLowerCase() !== attestor.toLowerCase()) {
    return NextResponse.json(
      { error: "You are not the operator of this retreat." },
      { status: 403 },
    );
  }

  // Fetch the booking attestation for deposit/check-in details
  const bookingRootHash = episode.commitment.bookingRootHash;
  let bookingAttestation = null;
  try {
    const all = await listAttestations();
    bookingAttestation = all.find((a) => a.rootHash === bookingRootHash) ?? null;
  } catch {
    // Non-fatal — the booking attestation may not be in the local store
  }

  // Build the intention shape — coarse constraints only, never the statement
  const intention = episode.intentions.at(-1);
  const intentionShape = intention
    ? {
        energy: intention.constraints.energy,
        budget: intention.constraints.budget,
        social: intention.constraints.social,
        travelWindow: intention.constraints.travelWindow,
        partySize: intention.constraints.partySize,
      }
    : {};

  // Generate the preparation plan using Mira's voice
  const signals = {
    energy: intention?.constraints.energy,
    budget: intention?.constraints.budget,
    social: intention?.constraints.social,
  };
  const { preparationPlan } = await import("@/agent/mira-voice");
  const plan = preparationPlan(recommendation.result, signals);

  return NextResponse.json({
    episode: {
      id: episode.id,
      status: episode.status,
      bookedAt: episode.commitment.bookedAt,
      depositTxId: episode.commitment.depositTxId,
    },
    retreat: {
      rootHash: retreat.rootHash,
      title: retreat.title,
      location: retreat.claims.location,
      durationDays: retreat.claims.durationDays,
      priceUsd: retreat.claims.priceUsd,
      bookingUrl: retreat.claims.bookingUrl,
    },
    intentionShape,
    preparationPlan: plan,
    booking: bookingAttestation
      ? {
          rootHash: bookingAttestation.rootHash,
          depositUsd: retreat.claims.priceUsd,
          bookedAt: episode.commitment.bookedAt,
          checkInWindowHours: undefined, // from booking attestation if available
        }
      : null,
  });
}
