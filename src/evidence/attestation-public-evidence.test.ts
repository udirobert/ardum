import { describe, expect, it } from "vitest";
import { SEED_ATTESTATIONS } from "@/lib/seed-attestations";
import {
  publicEvidenceFromAttestation,
  publicEvidenceFromAttestations,
} from "./attestation-public-evidence";

describe("publicEvidenceFromAttestation", () => {
  it("keys evidence by attestation root hash", () => {
    const attestation = SEED_ATTESTATIONS[0]!;
    const record = publicEvidenceFromAttestation(attestation, ["retreat-demo"]);
    expect(record.retreatKeys).toContain(attestation.rootHash);
    expect(record.retreatKeys).toContain("retreat-demo");
    expect(record.claims.length).toBeGreaterThan(0);
    expect(record.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

describe("publicEvidenceFromAttestations", () => {
  it("returns one record per retreat attestation", () => {
    const records = publicEvidenceFromAttestations(SEED_ATTESTATIONS);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.retreatKeys.length > 0)).toBe(true);
  });
});
