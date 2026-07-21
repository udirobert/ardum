// Dev/demo seed for wider-aperture evidence. Production resolves against
// empty stores until cohort aggregates and evidence-repository fetches exist.
// Enable via ARDUM_WIDER_APERTURE_SEED=1 or pass useSeed from the demo route.

import type { WiderApertureStores } from "./resolve-wider-aperture";

export const SEED_WIDER_APERTURE_STORES: WiderApertureStores = {
  cohortSlices: [
    {
      energy: "low",
      social: "solo",
      sampleSize: 47,
      intentionShapeLabel: "recovery and solitude",
      refreshedAt: "2026-07-01T00:00:00.000Z",
      summary:
        "Among practitioners who named recovery and chose solitude, quiet mornings and short containers tended to matter more than destination. This is a pattern, not a rule — your hold does not depend on it.",
    },
  ],
  publicRecords: [
    {
      retreatKeys: ["retreat-001", "retreat-003"],
      confidence: 0.85,
      refreshedAt: "2026-07-18T12:00:00.000Z",
      summary:
        "Public reports often mention the morning silence here. Write-ups also note the small cohort size and optional daily check-in.",
      claims: [
        {
          text: "Small cohort, max 8",
          sourceLabel: "operator site",
          sourceUrl: "https://example.com/retreats/silent-mountain",
          fetchedAt: "2026-07-18T11:30:00.000Z",
          provenance: "reported",
        },
        {
          text: "Strong for burnout recovery",
          sourceLabel: "wellness publication",
          fetchedAt: "2026-07-17T09:00:00.000Z",
          provenance: "inferred",
        },
      ],
    },
    {
      retreatKeys: ["retreat-002"],
      confidence: 0.8,
      refreshedAt: "2026-07-16T08:00:00.000Z",
      summary:
        "Public sources often mention ocean proximity and movement-based mornings at this operator's coastal programs.",
      claims: [
        {
          text: "Movement-led mornings, ocean access",
          sourceLabel: "operator site",
          fetchedAt: "2026-07-16T07:00:00.000Z",
          provenance: "reported",
        },
      ],
    },
  ],
};

export function widerApertureSeedEnabled(): boolean {
  return process.env.ARDUM_WIDER_APERTURE_SEED === "1";
}

export function widerApertureStoresForEnv(): WiderApertureStores | undefined {
  return widerApertureSeedEnabled() ? SEED_WIDER_APERTURE_STORES : undefined;
}
