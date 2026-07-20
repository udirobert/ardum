/**
 * Curated retreat catalog for the inventory-led experience.
 * 
 * This is Track A's Phase A1 deliverable: a static catalog of 5-10 stunning
 * retreats with pre-computed color palettes. Track B builds the visual
 * experience against this mock data while Track A builds the live extraction
 * and ranking engine.
 * 
 * For the demo, we use Unsplash images. Phase A4 replaces this with real operator
 * data from attestations.
 */

import type { Retreat } from "./retreat";

function unsplash(id: string, w = 1200): string {
  return `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
}

export const MOCK_CATALOG: Retreat[] = [
  {
    id: "retreat-001",
    title: "Silent Mountain Retreat",
    location: "Himalayan Foothills, India",
    heroImage: unsplash("photo-1544787219-7f47ccb76574"),
    gallery: [
      unsplash("photo-1545389336-cf090694435e"),
      unsplash("photo-1507525428034-b723cf961d3e"),
    ],
    operator: {
      name: "Ananda Collective",
      bio: "Founded by practitioners who spent 12 years in Himalayan monasteries. Specializes in silent retreats with personalized breath work.",
      avatar: unsplash("photo-1544005313-94ddf0286df2", 200),
    },
    dates: {
      start: "2026-10-15",
      end: "2026-10-22",
      duration: 7,
    },
    price: {
      amount: 1850,
      currency: "USD",
      includes: [
        "All meals (sattvic, organic)",
        "Private cottage with mountain view",
        "Daily 1:1 guidance sessions",
        "Breath cycle programming",
        "Airport transfers",
      ],
    },
    capacity: {
      min: 6,
      max: 12,
      current: 8,
    },
    description:
      "Seven days of noble silence in the Himalayan foothills. Each morning begins with sunrise pranayama on the terrace overlooking snow-capped peaks. The practice blends ancient hatha yoga with modern breath science, creating a container for deep inner work.",
    highlights: [
      "Complete silence for 7 days",
      "Personalized breath cycle based on your baseline",
      "Mountain sunrise meditation terrace",
      "1:1 guidance with senior practitioners",
      "Organic sattvic meals from the retreat garden",
    ],
    attestationId: "0xabc123...",
    palette: {
      primary: "#8B7355", // Warm earth brown
      secondary: "#D4A574", // Soft golden sand
      accent: "#4A6741", // Mountain green
    },
    fit: { energy: "low", social: "small-circle" },
  },
  {
    id: "retreat-002",
    title: "Ocean Breath Intensive",
    location: "Bali, Indonesia",
    heroImage: unsplash("photo-1537996194471-e657df71f429"),
    gallery: [
      unsplash("photo-1555400038-63f5ba517a47"),
      unsplash("photo-1518611012118-696072aa579a"),
    ],
    operator: {
      name: "Maya Suryani",
      bio: "Balinese yoga teacher and breathwork facilitator with 15 years of experience. Combines traditional Balinese healing with contemporary somatic practices.",
      avatar: unsplash("photo-1507003211169-0a1ddc80a048", 200),
    },
    dates: {
      start: "2026-09-01",
      end: "2026-09-06",
      duration: 5,
    },
    price: {
      amount: 1450,
      currency: "USD",
      includes: [
        "Shared villa accommodation",
        "All meals (local organic)",
        "Daily group sessions",
        "Sound healing ceremony",
        "Traditional Balinese blessing",
      ],
    },
    capacity: {
      min: 8,
      max: 16,
      current: 12,
    },
    description:
      "Five days of ocean-inspired breath work and vinyasa flow in a clifftop villa overlooking the Indian Ocean. The rhythm of the waves guides each practice, creating a natural metronome for your breath cycle.",
    highlights: [
      "Clifftop villa with ocean views",
      "Daily sound healing with Tibetan bowls",
      "Traditional Balinese water blessing",
      "Surf-inspired vinyasa sequences",
      "Community of 12 practitioners",
    ],
    palette: {
      primary: "#5B8FA8", // Ocean blue
      secondary: "#E8D5B7", // Sand beige
      accent: "#D4726A", // Coral pink
    },
    fit: { energy: "in-movement", social: "open-circle" },
  },
  {
    id: "retreat-003",
    title: "Forest Silence Solo",
    location: "Pacific Northwest, USA",
    heroImage: unsplash("photo-1509316785289-025f5b846b35"),
    gallery: [
      unsplash("photo-1469851632435-2f32b4f4a2e2"),
      unsplash("photo-1500530855697-c5861c7e7c5b"),
    ],
    operator: {
      name: "Cedar Grove Sanctuary",
      bio: "A small collective of forest-dwelling practitioners offering solo retreats in the old-growth forests of the Pacific Northwest. Minimal infrastructure, maximum solitude.",
      avatar: unsplash("photo-1472099645785-5658abbe450d", 200),
    },
    dates: {
      start: "2026-10-01",
      end: "2026-10-04",
      duration: 3,
    },
    price: {
      amount: 750,
      currency: "USD",
      includes: [
        "Private forest cabin",
        "Self-catering kitchen",
        "Daily optional check-in call",
        "Trail maps and practice guides",
        "Hot spring access",
      ],
    },
    capacity: {
      min: 1,
      max: 4,
      current: 1,
    },
    description:
      "Three days of complete solitude in a hand-built cabin deep in old-growth forest. No group sessions, no scheduled activities—just you, the trees, and your practice. The forest holds space for whatever needs to emerge.",
    highlights: [
      "Complete solitude (solo retreat)",
      "Hand-built cabin in old-growth forest",
      "Self-paced practice with optional guidance",
      "Natural hot springs 10-minute walk",
      "Minimal digital footprint (no WiFi in cabin)",
    ],
    attestationId: "0xdef456...",
    palette: {
      primary: "#3D5A3D", // Deep forest green
      secondary: "#A8B5A0", // Moss grey-green
      accent: "#C9A961", // Warm wood brown
    },
    fit: { energy: "settled", social: "solo" },
  },
  {
    id: "retreat-004",
    title: "Desert Moon Immersion",
    location: "Sedona, Arizona, USA",
    heroImage: unsplash("photo-1509316785289-025f5b846b35"),
    gallery: [
      unsplash("photo-1469851632435-2f32b4f4a2e2"),
      unsplash("photo-1500530855697-c5861c7e7c5b"),
    ],
    operator: {
      name: "Red Rock Collective",
      bio: "A group of energy workers and yoga teachers based in Sedona's red rock country. Specializes in lunar cycle practices and earth-based healing modalities.",
      avatar: unsplash("photo-1438761681033-6461ffad8d80", 200),
    },
    dates: {
      start: "2026-10-10",
      end: "2026-10-17",
      duration: 7,
    },
    price: {
      amount: 2400,
      currency: "USD",
      includes: [
        "Luxury eco-lodge accommodation",
        "All meals (chef-prepared)",
        "Daily group ceremonies",
        "Vortex hikes with guides",
        "New moon fire ceremony",
        "Crystal sound bath",
      ],
    },
    capacity: {
      min: 10,
      max: 20,
      current: 15,
    },
    description:
      "Seven days aligned with the lunar cycle in Sedona's red rock country. Each day builds toward the new moon fire ceremony, where intentions are released into the desert sky. The practice blends kundalini yoga, breathwork, and earth-based rituals.",
    highlights: [
      "Lunar cycle alignment (new moon ceremony)",
      "Red rock vortex hikes",
      "Luxury eco-lodge with desert views",
      "Crystal sound healing sessions",
      "Community of 15 practitioners",
    ],
    palette: {
      primary: "#C87070", // Red rock rust
      secondary: "#E8C4A0", // Desert sand
      accent: "#6B4E71", // Twilight purple
    },
    fit: { energy: "sharp", social: "small-circle" },
  },
  {
    id: "retreat-005",
    title: "Coastal Flow & Restore",
    location: "Algarve, Portugal",
    heroImage: unsplash("photo-1533900298318-6b8da08a523e"),
    gallery: [
      unsplash("photo-1523906838053-52d40098b1ef"),
      unsplash("photo-1504813184451-ef688f9a0e8b"),
    ],
    operator: {
      name: "Ana Rodrigues",
      bio: "Portuguese yoga teacher and physical therapist. Combines Iyengar precision with restorative practices, creating a balanced approach for bodies in transition.",
      avatar: unsplash("photo-1494790108377-be9c29b29330", 200),
    },
    dates: {
      start: "2026-09-20",
      end: "2026-09-27",
      duration: 7,
    },
    price: {
      amount: 1650,
      currency: "USD",
      includes: [
        "Beachfront villa (shared room)",
        "All meals (Mediterranean organic)",
        "Daily morning flow + evening restore",
        "Anatomy workshops",
        "Surf lessons (optional)",
      ],
    },
    capacity: {
      min: 8,
      max: 14,
      current: 10,
    },
    description:
      "Seven days of balanced practice on Portugal's golden coast. Mornings bring dynamic vinyasa flow to build heat and strength. Evenings offer restorative poses and yoga nidra to integrate and restore. The ocean is your constant companion.",
    highlights: [
      "Beachfront villa with ocean access",
      "Balanced practice (flow + restore)",
      "Anatomy and alignment workshops",
      "Optional surf lessons",
      "Mediterranean organic cuisine",
    ],
    palette: {
      primary: "#6B93A8", // Coastal blue
      secondary: "#F0E5D8", // Creamy sand
      accent: "#E8A87C", // Warm terracotta
    },
    fit: { energy: "settled", social: "small-circle" },
  },
];

/**
 * Get a retreat by ID from the mock catalog.
 */
export function getRetreatById(id: string): Retreat | undefined {
  return MOCK_CATALOG.find((r) => r.id === id);
}

/**
 * Get all retreats from the mock catalog.
 */
export function getAllRetreats(): Retreat[] {
  return MOCK_CATALOG;
}

/**
 * Get retreats filtered by constraints (placeholder for ranking integration).
 * Phase A2 will replace this with the live ranking engine.
 */
export function getRetreatsByConstraints(constraints: {
  budget?: string;
  duration?: { max: number };
  social?: string;
  horizon?: string;
}): Retreat[] {
  let filtered = [...MOCK_CATALOG];

  if (constraints.budget) {
    const budgetLimits: Record<string, number> = {
      "under-1k": 1000,
      "1k-2k": 2000,
      "2k-3k": 3000,
      "3k-plus": Infinity,
    };
    const limit = budgetLimits[constraints.budget] ?? Infinity;
    filtered = filtered.filter((r) => r.price.amount <= limit);
  }

  if (constraints.duration?.max) {
    filtered = filtered.filter((r) => r.dates.duration <= constraints.duration!.max);
  }

  if (constraints.social === "solo") {
    filtered = filtered.filter((r) => r.capacity.min === 1);
  }

  if (constraints.horizon) {
    const targetMonth = constraints.horizon; // e.g., "2026-09"
    filtered = filtered.filter((r) => r.dates.start.startsWith(targetMonth));
  }

  return filtered.length > 0 ? filtered : MOCK_CATALOG.slice(0, 3);
}
