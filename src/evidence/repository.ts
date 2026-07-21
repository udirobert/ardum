import "server-only";

import { SEED_ATTESTATIONS } from "@/lib/seed-attestations";
import { MOCK_CATALOG } from "@/inventory/catalog";
import { publicEvidenceFromAttestations } from "./attestation-public-evidence";
import type { PublicEvidenceRecord } from "./wider-aperture";

export interface EvidenceRepository {
  listPublicEvidence(): Promise<PublicEvidenceRecord[]>;
  getPublicEvidence(retreatKey: string): Promise<PublicEvidenceRecord | null>;
}

function catalogKeysByAttestation(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const retreat of MOCK_CATALOG) {
    if (!retreat.attestationId) continue;
    const keys = map[retreat.attestationId] ?? [];
    keys.push(retreat.id);
    map[retreat.attestationId] = keys;
  }
  for (const attestation of SEED_ATTESTATIONS) {
    map[attestation.rootHash] = [
      ...(map[attestation.rootHash] ?? []),
      attestation.rootHash,
    ];
  }
  return map;
}

class LocalEvidenceRepository implements EvidenceRepository {
  private cache: PublicEvidenceRecord[] | null = null;

  private records(): PublicEvidenceRecord[] {
    if (this.cache) return this.cache;
    this.cache = publicEvidenceFromAttestations(
      SEED_ATTESTATIONS,
      catalogKeysByAttestation(),
    );
    return this.cache;
  }

  async listPublicEvidence(): Promise<PublicEvidenceRecord[]> {
    return this.records();
  }

  async getPublicEvidence(retreatKey: string): Promise<PublicEvidenceRecord | null> {
    const match = this.records().find((record) =>
      record.retreatKeys.includes(retreatKey),
    );
    return match ?? null;
  }
}

export const evidenceRepository: EvidenceRepository =
  new LocalEvidenceRepository();
