// Real Unsplash photos for each seed retreat — every location has a
// genuine, high-quality editorial photo that matches the retreat's setting.

export type RetreatPhoto = {
  src: string;
  alt: string;
};

function unsplash(id: string, w = 800): string {
  return `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
}

export const RETREAT_PHOTOS: Record<string, RetreatPhoto> = {
  "bali-ubud-stillness-0001": {
    src: unsplash("photo-1557093793-d149a38a1be8"),
    alt: "Tegalalang rice terraces in Ubud, Bali",
  },
  "bali-canggu-movement-0002": {
    src: unsplash("photo-1507525428034-b723cf961d3e"),
    alt: "Tropical beach at golden hour in Bali",
  },
  "bali-sidemen-restoration-0003": {
    src: unsplash("photo-1555400038-63f5ba517a47"),
    alt: "Lush green rice terraces in Sidemen valley",
  },
  "bali-ubud-pranayama-0004": {
    src: unsplash("photo-1545389336-cf090694435e"),
    alt: "Quiet meditation space surrounded by jungle",
  },
  "bali-canggu-strength-0005": {
    src: unsplash("photo-1544367567-0f2fcb009e0b"),
    alt: "Active yoga practice overlooking the ocean",
  },
  "tulum-cenote-intensive-0006": {
    src: unsplash("photo-1552072092-7f6b0a4c9c2c"),
    alt: "Turquoise cenote surrounded by jungle in Tulum",
  },
  "lisbon-silent-coast-0007": {
    src: unsplash("photo-1533900298318-6b8da08a523e"),
    alt: "Atlantic coast cliffs near Lisbon",
  },
  "rishikesh-ashram-stay-0008": {
    src: unsplash("photo-1506197603052-3cc9c3a2bd24"),
    alt: "Ganges river flowing through the Himalayan foothills",
  },
  "nosara-surf-yin-0009": {
    src: unsplash("photo-1506953823976-52e1fdc0149a"),
    alt: "Costa Rican beach at sunset with palm trees",
  },
  "joshua-tree-desert-silent-0010": {
    src: unsplash("photo-1509316785289-025f5b846b35"),
    alt: "Joshua Tree desert landscape at dusk",
  },
};

// Palette-matched fallback for when an image fails to load.
export const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #efe7d6 0%, #d8a892 100%)";
