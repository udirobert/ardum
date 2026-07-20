import type { Retreat } from "./retreat";

function unsplash(id: string, w = 1200): string {
  return `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
}

export const MOCK_RETREATS: Retreat[] = [
  {
    id: "sidemen-restoration",
    title: "Sidemen Restoration Retreat",
    location: "Sidemen Valley, Bali",
    heroImage: unsplash("photo-1537996194471-e657df71f429"),
    gallery: [
      unsplash("photo-1555400038-63f5ba517a47"),
      unsplash("photo-1545389336-cf090694435e"),
    ],
    operator: {
      name: "Sukawati House",
      bio: "A family-run retreat space overlooking the Unda River, hosting restorative practice since 2018.",
      avatar: unsplash("photo-1544005313-94ddf0286df2", 200),
    },
    dates: {
      start: "2026-10-12",
      end: "2026-10-19",
      duration: 7,
    },
    price: {
      amount: 1200,
      currency: "USD",
      includes: ["lodging", "twice-daily yoga", "breakfast", "closing ceremony"],
    },
    capacity: { min: 6, max: 14, current: 9 },
    description:
      "Seven days of restorative yoga, breathwork, and silence in the Sidemen Valley. The pace is slow, the rice terraces are green, and the only notification is the morning bell.",
    highlights: [
      "Daily restorative + pranayama",
      "Two silent mornings",
      "Rice-terrace walks at dawn",
      "Closing fire ceremony",
    ],
    palette: {
      primary: "#4A6741",
      secondary: "#D4A574",
      accent: "#F6F1E7",
    },
    fit: { energy: "low", social: "small-circle" },
  },
  {
    id: "canggu-movement",
    title: "Canggu Movement Intensive",
    location: "Canggu, Bali",
    heroImage: unsplash("photo-1544367567-0f2fcb009e0b"),
    gallery: [
      unsplash("photo-1507525428034-b723cf961d3e"),
      unsplash("photo-1518611012118-696072aa579a"),
    ],
    operator: {
      name: "Wave & Mat",
      bio: "Surf and movement studio on the south-west coast, built for people who want to sweat before breakfast.",
      avatar: unsplash("photo-1507003211169-0a1ddc80a048", 200),
    },
    dates: {
      start: "2026-09-05",
      end: "2026-09-11",
      duration: 6,
    },
    price: {
      amount: 890,
      currency: "USD",
      includes: ["lodging", "surf guiding", "morning vinyasa", "breakfast"],
    },
    capacity: { min: 8, max: 20, current: 14 },
    description:
      "Morning vinyasa, afternoon surf, and evening release work. For the person who arrives with energy to spend and leaves it in the ocean.",
    highlights: [
      "Daily vinyasa + surf blocks",
      "Breathwork for surfers",
      "Beach bonfire closing",
      "Board rental included",
    ],
    palette: {
      primary: "#2E6B8A",
      secondary: "#E8B568",
      accent: "#F6F1E7",
    },
    fit: { energy: "in-movement", social: "open-circle" },
  },
  {
    id: "tulum-cenote-silent",
    title: "Tulum Cenote Silent Week",
    location: "Tulum, Mexico",
    heroImage: unsplash("photo-1515859005217-8a1f0c4cf084"),
    gallery: [
      unsplash("photo-1512100356356-de10b85a2b40"),
      unsplash("photo-1504813184451-ef688f9a0e8b"),
    ],
    operator: {
      name: "Casa del Cenote",
      bio: "A jungle sanctuary minutes from the Caribbean, designed around silence, cenotes, and slow movement.",
      avatar: unsplash("photo-1438761681033-6461ffad8d80", 200),
    },
    dates: {
      start: "2026-11-03",
      end: "2026-11-10",
      duration: 7,
    },
    price: {
      amount: 1650,
      currency: "USD",
      includes: ["lodging", "daily yin", "two cenote trips", "meals"],
    },
    capacity: { min: 4, max: 12, current: 7 },
    description:
      "A silent week broken only by yin, cenote swims, and three shared meals. Designed for the person who needs the world to go quiet for a while.",
    highlights: [
      "Noble silence for 5 days",
      "Daily yin + meditation",
      "Two guided cenote visits",
      "All meals included",
    ],
    palette: {
      primary: "#1A4F5C",
      secondary: "#87C4C4",
      accent: "#F4E4BC",
    },
    fit: { energy: "settled", social: "solo" },
  },
  {
    id: "joshua-tree-desert",
    title: "Joshua Tree Desert Silent",
    location: "Joshua Tree, California",
    heroImage: unsplash("photo-1509316785289-025f5b846b35"),
    gallery: [
      unsplash("photo-1469851632435-2f32b4f4a2e2"),
      unsplash("photo-1500530855697-c5861c7e7c5b"),
    ],
    operator: {
      name: "Desert Still",
      bio: "Small-group desert retreats focused on solitude, stars, and the kind of quiet that only dry air can hold.",
      avatar: unsplash("photo-1472099645785-5658abbe450d", 200),
    },
    dates: {
      start: "2026-10-18",
      end: "2026-10-22",
      duration: 4,
    },
    price: {
      amount: 750,
      currency: "USD",
      includes: ["lodging", "daily yoga", "sound bath", "stargazing"],
    },
    capacity: { min: 4, max: 10, current: 4 },
    description:
      "Four days of desert silence, sunrise movement, and night-sky medicine. The land does most of the teaching.",
    highlights: [
      "Desert sunrise practice",
      "Cacao + sound bath",
      "Stargazing on clear nights",
      "Short, focused itinerary",
    ],
    palette: {
      primary: "#8B5E3C",
      secondary: "#E07A5F",
      accent: "#F2E9E4",
    },
    fit: { energy: "sharp", social: "small-circle" },
  },
  {
    id: "lisbon-silent-coast",
    title: "Lisbon Silent Coast",
    location: "Sintra, Portugal",
    heroImage: unsplash("photo-1533900298318-6b8da08a523e"),
    gallery: [
      unsplash("photo-1523906838053-52d40098b1ef"),
      unsplash("photo-1504813184451-ef688f9a0e8b"),
    ],
    operator: {
      name: "Costa Quieta",
      bio: "A small group of teachers and hosts running silent retreats along the Atlantic coast.",
      avatar: unsplash("photo-1494790108377-be9c29b29330", 200),
    },
    dates: {
      start: "2026-09-22",
      end: "2026-09-29",
      duration: 7,
    },
    price: {
      amount: 1350,
      currency: "USD",
      includes: ["lodging", "daily meditation", "coastal walks", "breakfast"],
    },
    capacity: { min: 6, max: 16, current: 11 },
    description:
      "Seven days of silence, Atlantic air, and cliffside walking. The retreat moves between a converted farmhouse and the coastal trail.",
    highlights: [
      "Daily silent meditation",
      "Guided coastal walks",
      "Farm-to-table breakfast",
      "Optional teaching interviews",
    ],
    palette: {
      primary: "#3D5A80",
      secondary: "#98C1D9",
      accent: "#E0FBFC",
    },
    fit: { energy: "settled", social: "small-circle" },
  },
];

export function findRetreatById(id: string): Retreat | undefined {
  return MOCK_RETREATS.find((r) => r.id === id);
}
