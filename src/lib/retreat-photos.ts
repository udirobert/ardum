// Photo mapping for each seed retreat. Uses picsum.photos (free, reliable,
// seeded so each retreat always shows the same photo) with a single verified
// Unsplash CDN URL for the Bali hero.

export type RetreatPhoto = {
  src: string;
  alt: string;
};

// Picsum gives deterministic photos per seed — not location-specific but
// consistently high-quality. Good enough for the competition demo.
function picsum(seed: string, w = 600): string {
  return `https://picsum.photos/seed/${seed}/${w}`;
}

export const RETREAT_PHOTOS: Record<string, RetreatPhoto> = {
  "bali-ubud-stillness-0001": {
    src: "https://images.unsplash.com/photo-1557093793-d149a38a1be8?w=800&q=80&auto=format&fit=crop",
    alt: "Tegalalang rice terraces in Ubud, Bali",
  },
  "bali-canggu-movement-0002": {
    src: picsum("canggu"),
    alt: "Beach and surf culture in Canggu, Bali",
  },
  "bali-sidemen-restoration-0003": {
    src: picsum("sidemen"),
    alt: "Peaceful Balinese village landscape",
  },
  "bali-ubud-pranayama-0004": {
    src: picsum("pranayama"),
    alt: "Quiet meditation space",
  },
  "bali-canggu-strength-0005": {
    src: picsum("strength"),
    alt: "Active yoga practice setting",
  },
  "tulum-cenote-intensive-0006": {
    src: picsum("tulum"),
    alt: "Tropical cenote and beach landscape",
  },
  "lisbon-silent-coast-0007": {
    src: picsum("lisbon"),
    alt: "Atlantic coast cliffs and ocean",
  },
  "rishikesh-ashram-stay-0008": {
    src: picsum("rishikesh"),
    alt: "Ganges river and mountain landscape",
  },
  "nosara-surf-yin-0009": {
    src: picsum("nosara"),
    alt: "Costa Rican beach at sunset",
  },
  "joshua-tree-desert-silent-0010": {
    src: picsum("joshua-tree"),
    alt: "Joshua Tree desert landscape",
  },
};

// Palette-matched fallback for when an image fails to load.
export const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #efe7d6 0%, #d8a892 100%)";
