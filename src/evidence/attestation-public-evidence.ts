import type { Attestation } from "@/attestation/schema";
import type { InspectedClaim, PublicEvidenceRecord } from "./wider-aperture";

function attestationConfidence(attestation: Attestation): number {
  const hasNotes = Boolean(attestation.claims.notes?.trim());
  const hasAttestor =
    attestation.attestor !== "0x0000000000000000000000000000000000000000";
  return hasAttestor ? (hasNotes ? 0.9 : 0.85) : hasNotes ? 0.75 : 0.7;
}

function buildSummary(attestation: Attestation): string {
  const notes = attestation.claims.notes?.trim();
  const styles = attestation.claims.practiceStyle.slice(0, 2).join(" and ");
  if (notes) {
    return `Verified attestation describes ${attestation.title.toLowerCase()} in ${attestation.claims.location}. ${notes}`;
  }
  return `Verified attestation for ${attestation.title} in ${attestation.claims.location} — ${styles}, ${attestation.claims.durationDays} days, cohort up to ${attestation.claims.capacity}.`;
}

export function publicEvidenceFromAttestation(
  attestation: Attestation,
  extraRetreatKeys: string[] = [],
): PublicEvidenceRecord {
  const fetchedAt = attestation.createdAt;
  const claims: InspectedClaim[] = [
    {
      text: `${attestation.claims.durationDays}-day container, up to ${attestation.claims.capacity} people`,
      sourceLabel: "attestation record",
      fetchedAt,
      provenance: "reported" as const,
    },
    {
      text: `Practice focus: ${attestation.claims.practiceStyle.join(", ")}`,
      sourceLabel: "attestation record",
      fetchedAt,
      provenance: "explicit" as const,
    },
  ];
  if (attestation.claims.notes?.trim()) {
    claims.push({
      text: attestation.claims.notes.trim(),
      sourceLabel: "attestation record",
      fetchedAt,
      provenance: "inferred" as const,
    });
  }

  const retreatKeys = [
    attestation.rootHash,
    ...extraRetreatKeys.filter((key) => key !== attestation.rootHash),
  ];

  return {
    retreatKeys,
    summary: buildSummary(attestation),
    claims,
    refreshedAt: fetchedAt,
    confidence: attestationConfidence(attestation),
  };
}

export function publicEvidenceFromAttestations(
  attestations: Attestation[],
  catalogKeysByAttestation: Record<string, string[]> = {},
): PublicEvidenceRecord[] {
  return attestations
    .filter((item) => item.kind === "retreat")
    .map((attestation) =>
      publicEvidenceFromAttestation(
        attestation,
        catalogKeysByAttestation[attestation.rootHash] ?? [],
      ),
    );
}
