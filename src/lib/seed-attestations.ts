// Seed attestations: deliberately varied across geography, energy, budget,
// social register, breath cycle, and practice style — so the agent's
// reasoning is visibly non-trivial across many input combinations.
//
// Design intent: at least one retreat that is the "obvious" match for each
// high-traffic input combination, plus one or two that *contradict* the
// obvious pick on some axis (forcing the agent to weigh tradeoffs, not
// just pick by energy string-match).
//
// In production these would come from 0G Storage by rootHash.

import type { Attestation } from "@/attestation/schema";

export const SEED_ATTESTOR =
  // Read-only public wallet for the seed. Replace with the real attestor
  // wallet once it's set up.
  "0x0000000000000000000000000000000000000000";

export const SEED_ATTESTATIONS: Attestation[] = [
  // ───────────── Bali ─────────────

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

  // ───────────── Tulum, Mexico ─────────────

  {
    rootHash: "tulum-cenote-intensive-0006",
    kind: "retreat",
    title: "Tulum Cenote & Vinyasa Intensive",
    description:
      "Eight days of dawn vinyasa on a beachside platform, with two " +
      "cenote meditation sessions and a closing fire ceremony. Premium " +
      "all-inclusive; small cohort but big energy.",
    claims: {
      location: "Tulum, Mexico",
      durationDays: 8,
      priceUsd: 4100,
      capacity: 14,
      practiceStyle: ["power vinyasa", "pranayama", "meditation"],
      energyFit: ["sharp", "in-movement"],
      socialFit: ["open-circle"],
      breathPhase: ["dynamic", "even"],
      notes:
        "Premium pricing covers cenote access, all meals, and a private " +
        "closing ceremony. Not for anyone wanting silence — the cohort " +
        "is social and the venue is loud in the evenings.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },

  // ───────────── Lisbon, Portugal ─────────────

  {
    rootHash: "lisbon-silent-coast-0007",
    kind: "retreat",
    title: "Lisbon Silent Coast Retreat",
    description:
      "Seven silent days on the Atlantic coast outside Lisbon. One " +
      "morning practice, one evening practice, three meals shared in " +
      "silence. Cohort is large but the silence does the work.",
    claims: {
      location: "Sesimbra, Portugal",
      durationDays: 7,
      priceUsd: 2400,
      capacity: 28,
      practiceStyle: ["yin", "meditation", "gentle vinyasa"],
      energyFit: ["settled", "low"],
      socialFit: ["solo", "communal"],
      breathPhase: ["extended"],
      breathCycle: {
        unit: "seconds",
        pre: [{ inhale: 6, exhale: 6 }],
        cycle: [{ repeat: 12, inhale: 5, retain: 5, exhale: 5, sustain: 5 }],
        ratio: "1:1:1:1",
      },
      notes:
        "The cohort is large (28) but the silence makes it feel small. " +
        "Not for anyone who wants heat or conversation.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },

  // ───────────── Rishikesh, India ─────────────

  {
    rootHash: "rishikesh-ashram-stay-0008",
    kind: "retreat",
    title: "Rishikesh Traditional Ashram Stay",
    description:
      "Two weeks at a long-running ashram on the Ganges. Four hours of " +
      "asana a day, two hours of pranayama, satsang, karma yoga. " +
      "Vegetarian, simple rooms, real schedule.",
    claims: {
      location: "Rishikesh, India",
      durationDays: 14,
      priceUsd: 950,
      capacity: 30,
      practiceStyle: ["hatha", "pranayama", "meditation", "kriya"],
      energyFit: ["settled", "in-movement"],
      socialFit: ["solo", "communal"],
      breathPhase: ["extended"],
      breathCycle: {
        unit: "seconds",
        pre: [{ inhale: 8, retain: 4, exhale: 8, sustain: 4 }],
        cycle: [
          { repeat: 6, inhale: 8, retain: 4, exhale: 8, sustain: 4 },
          { repeat: 4, inhale: 4, retain: 8, exhale: 4, sustain: 4 },
        ],
        ratio: "2:1:2:1 → 1:2:1:1",
      },
      notes:
        "Demanding in a different way from a Western retreat — the " +
        "schedule is the practice. Budget pricing but not for comfort-" +
        "seekers; rooms are simple and the food is spartan.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },

  // ───────────── Nosara, Costa Rica ─────────────

  {
    rootHash: "nosara-surf-yin-0009",
    kind: "retreat",
    title: "Nosara Surf & Yin",
    description:
      "Eight days of morning surf and evening yin. Two yoga sessions " +
      "a day — strong vinyasa at sunrise, slow yin at sunset. Cohort " +
      "is social and the town is walkable.",
    claims: {
      location: "Nosara, Costa Rica",
      durationDays: 8,
      priceUsd: 1650,
      capacity: 12,
      practiceStyle: ["vinyasa", "yin", "breath"],
      energyFit: ["in-movement", "sharp"],
      socialFit: ["open-circle", "communal"],
      breathPhase: ["even", "dynamic"],
      notes:
        "The surf is real — instructor-led for two hours each morning, " +
        "then full yoga in the afternoon and evening. Best for " +
        "practitioners who want movement, not stillness.",
    },
    attestor: SEED_ATTESTOR,
    createdAt: "2026-04-12T08:00:00.000Z",
  },

  // ───────────── Joshua Tree, USA ─────────────

  {
    rootHash: "joshua-tree-desert-silent-0010",
    kind: "retreat",
    title: "Joshua Tree Desert Silent",
    description:
      "Six silent days in the Mojave. Sound bath at dusk, dawn " +
      "meditation walk, one restorative practice per day. Tiny cohort, " +
      "cabins not rooms. Cold nights.",
    claims: {
      location: "Joshua Tree, California",
      durationDays: 6,
      priceUsd: 2800,
      capacity: 6,
      practiceStyle: ["restorative", "yin", "meditation"],
      energyFit: ["low", "settled"],
      socialFit: ["solo"],
      breathPhase: ["extended"],
      breathCycle: {
        unit: "seconds",
        pre: [{ inhale: 8, exhale: 8 }],
        cycle: [{ repeat: 10, inhale: 4, retain: 4, exhale: 8, sustain: 4 }],
        ratio: "1:1:2:1",
      },
      notes:
        "Truly tiny — six people, one teacher. Best for practitioners " +
        "who want solitude more than instruction.",
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
    attestor: a.attestor,
    createdAt: a.createdAt,
  }));
}
