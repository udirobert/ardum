// Seed attestations: a small, deliberately varied set of Bali retreats that
// exercise the matching axes (energy, budget, social, practice, breath).
// In production these would come from 0G Storage by rootHash.

import type { Attestation } from "@/attestation/schema";

export const SEED_ATTESTOR =
  // Read-only public wallet for the seed. Replace with the real attestor
  // wallet once it's set up.
  "0x0000000000000000000000000000000000000000";

export const SEED_ATTESTATIONS: Attestation[] = [
  {
    rootHash: "bali-ubud-stillness-0001",
    kind: "retreat",
    title: "Ubud Stillness Retreat",
    description:
      "A seven-day silent retreat in the rice paddies outside Ubud. Two " +
      "gentle vinyasa sessions a day, silent breakfasts and dinners, an " +
      "evening yin class. No phone use after 6pm. Cohort of twelve.",
    claims: {
      location: "Ubud, Bali",
      durationDays: 7,
      priceUsd: 1800,
      capacity: 12,
      practiceStyle: ["gentle vinyasa", "yin", "pranayama", "meditation"],
      energyFit: ["settled", "low"],
      socialFit: ["solo", "small-circle"],
      breathPhase: ["extended", "even"],
      breathCycle: {
        unit: "seconds",
        pre: [{ inhale: 6, exhale: 6 }],
        cycle: [{ repeat: 10, inhale: 4, retain: 2, exhale: 6, sustain: 0 }],
        ratio: "2:1:3:0",
      },
      notes:
        "Owner-taught. Strong on subtlety — less suitable for practitioners " +
        "wanting high heat or large-group energy.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },
  {
    rootHash: "bali-canggu-movement-0002",
    kind: "retreat",
    title: "Canggu Movement Intensive",
    description:
      "Ten days of twice-daily power vinyasa on a clifftop shala. Strong " +
      "teachers, big cohort, surf in the afternoons. For practitioners " +
      "who want heat, structure, and company.",
    claims: {
      location: "Canggu, Bali",
      durationDays: 10,
      priceUsd: 2400,
      capacity: 16,
      practiceStyle: ["power vinyasa", "ashtanga", "pranayama"],
      energyFit: ["in-movement", "sharp"],
      socialFit: ["open-circle", "communal"],
      breathPhase: ["dynamic", "even"],
      notes:
        "Beginner-friendly in framing but the volume is real — five full " +
        "practice days plus two surf days.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },
  {
    rootHash: "bali-sidemen-restoration-0003",
    kind: "retreat",
    title: "Sidemen Restoration Retreat",
    description:
      "Five slow days in a village east of Ubud. Restorative and yin " +
      "only. Long lie-ins, single class per day, communal dinners. " +
      "Cohort of eight, mostly solo travellers.",
    claims: {
      location: "Sidemen, Bali",
      durationDays: 5,
      priceUsd: 1200,
      capacity: 8,
      practiceStyle: ["restorative", "yin", "meditation"],
      energyFit: ["low", "settled"],
      socialFit: ["solo", "small-circle"],
      breathPhase: ["extended"],
      breathCycle: {
        unit: "seconds",
        pre: [{ inhale: 8, exhale: 8 }],
        cycle: [{ repeat: 8, inhale: 6, retain: 2, exhale: 8, sustain: 0 }],
        ratio: "3:1:4:0",
      },
      notes:
        "Hosted by a local family. The food alone is a reason to come. " +
        "Not for anyone wanting volume or variety.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },
  {
    rootHash: "bali-ubud-pranayama-0004",
    kind: "retreat",
    title: "Ubud Pranayama & Stillness",
    description:
      "A focused eight-day on breath. One asana class per day, two " +
      "long pranayama sessions, daily meditation. Cohort of ten, " +
      "intermediate and up.",
    claims: {
      location: "Ubud, Bali",
      durationDays: 8,
      priceUsd: 2100,
      capacity: 10,
      practiceStyle: ["pranayama", "meditation", "gentle vinyasa"],
      energyFit: ["settled", "in-movement"],
      socialFit: ["solo", "small-circle", "open-circle"],
      breathPhase: ["extended", "even"],
      breathCycle: {
        unit: "seconds",
        pre: [{ inhale: 4, exhale: 4 }],
        cycle: [{ repeat: 12, inhale: 4, retain: 4, exhale: 4, sustain: 0 }],
        ratio: "1:1:1:0",
      },
      notes:
        "If breathwork is your entry point and you want depth without " +
        "asana volume, this is the strongest fit in the region.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },
  {
    rootHash: "bali-canggu-strength-0005",
    kind: "retreat",
    title: "Canggu Strength & Flow",
    description:
      "Six days blending strong flow with weight-room work. Two " +
      "practices daily, afternoon strength block, optional ice baths. " +
      "Cohort of fourteen, social and energetic.",
    claims: {
      location: "Canggu, Bali",
      durationDays: 6,
      priceUsd: 1950,
      capacity: 14,
      practiceStyle: ["vinyasa", "strength", "breath"],
      energyFit: ["sharp", "in-movement"],
      socialFit: ["open-circle", "communal"],
      breathPhase: ["even", "dynamic"],
      notes:
        "Athletic and warm. Strong food, communal dinners, late " +
        "evenings — not a silent retreat.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },
];

export function indexFromSeed() {
  return SEED_ATTESTATIONS.map((a) => ({
    rootHash: a.rootHash,
    kind: a.kind,
    title: a.title,
    description: a.description,
    claims: a.claims,
    createdAt: a.createdAt,
  }));
}
