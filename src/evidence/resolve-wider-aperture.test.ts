import { describe, expect, it } from "vitest";
import {
  composeBeat2Letter,
  letterEvidenceClause,
} from "./wider-aperture";
import { resolveWiderApertureEvidence } from "./resolve-wider-aperture";
import { SEED_WIDER_APERTURE_STORES } from "./seed-wider-aperture";

describe("resolveWiderApertureEvidence", () => {
  it("returns null cohort and public when stores are empty", () => {
    const result = resolveWiderApertureEvidence({
      constraints: { energy: "low", social: "solo" },
      retreatKey: "retreat-001",
    });
    expect(result.cohort).toBeNull();
    expect(result.public).toBeNull();
  });

  it("returns cohort only when n ≥ 30 and shape matches", () => {
    const result = resolveWiderApertureEvidence({
      constraints: { energy: "low", social: "solo" },
      retreatKey: "unknown",
      stores: {
        cohortSlices: [
          {
            energy: "low",
            social: "solo",
            sampleSize: 47,
            intentionShapeLabel: "recovery and solitude",
            refreshedAt: "2026-07-01T00:00:00.000Z",
            summary: "Pattern summary.",
          },
        ],
      },
    });
    expect(result.cohort?.sampleSize).toBe(47);
    expect(result.public).toBeNull();
  });

  it("hides cohort when sample size is below threshold", () => {
    const result = resolveWiderApertureEvidence({
      constraints: { energy: "low", social: "solo" },
      retreatKey: "retreat-001",
      stores: {
        cohortSlices: [
          {
            energy: "low",
            social: "solo",
            sampleSize: 12,
            intentionShapeLabel: "recovery and solitude",
            refreshedAt: "2026-07-01T00:00:00.000Z",
            summary: "Too thin.",
          },
        ],
      },
    });
    expect(result.cohort).toBeNull();
  });

  it("resolves public evidence by retreat key", () => {
    const result = resolveWiderApertureEvidence({
      constraints: {},
      retreatKey: "retreat-001",
      stores: SEED_WIDER_APERTURE_STORES,
    });
    expect(result.public?.claims.length).toBeGreaterThan(0);
  });

  it("hides public evidence when confidence is too low", () => {
    const result = resolveWiderApertureEvidence({
      constraints: {},
      retreatKey: "retreat-001",
      stores: {
        publicRecords: [
          {
            retreatKeys: ["retreat-001"],
            confidence: 0.2,
            refreshedAt: "2026-07-01T00:00:00.000Z",
            summary: "Weak.",
            claims: [
              {
                text: "claim",
                sourceLabel: "src",
                fetchedAt: "2026-07-01T00:00:00.000Z",
                provenance: "reported",
              },
            ],
          },
        ],
      },
    });
    expect(result.public).toBeNull();
  });
});

describe("letterEvidenceClause", () => {
  it("returns null when there is no uncertainty", () => {
    expect(
      letterEvidenceClause(
        {
          cohort: null,
          public: {
            summary: "Public reports often mention silence.",
            claims: [],
            refreshedAt: "2026-07-01T00:00:00.000Z",
          },
        },
        0,
      ),
    ).toBeNull();
  });

  it("prefers public clause over cohort under uncertainty", () => {
    const clause = letterEvidenceClause(
      {
        cohort: {
          summary: "Among practitioners who named recovery…",
          intentionShapeLabel: "recovery",
          sampleSize: 40,
          refreshedAt: "2026-07-01T00:00:00.000Z",
          provenance: "reported",
        },
        public: {
          summary: "Public reports often mention the morning silence.",
          claims: [],
          refreshedAt: "2026-07-01T00:00:00.000Z",
        },
      },
      2,
    );
    expect(clause).toContain("Public reports");
  });

  it("composeBeat2Letter appends clause only with uncertainty", () => {
    const evidence = resolveWiderApertureEvidence({
      constraints: { energy: "low", social: "solo" },
      retreatKey: "retreat-001",
      stores: SEED_WIDER_APERTURE_STORES,
    });
    const base = "This one sits close to what you named.";
    expect(composeBeat2Letter(base, evidence, [])).toBe(base);
    expect(composeBeat2Letter(base, evidence, ["timing"])).toContain(
      "Public reports",
    );
  });
});
