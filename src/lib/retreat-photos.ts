// Photo mapping for each seed retreat. Each entry maps a rootHash to an
// Unsplash photo that evokes the retreat's location and character.
//
// Direct CDN URLs — no API key required. Swap these for local images or a
// paid provider when the photo budget is established.

export type RetreatPhoto = {
  id: string;
  alt: string;
};

export const RETREAT_PHOTOS: Record<string, RetreatPhoto> = {
  "bali-ubud-stillness-0001": {
    id: "ca3d4FYDf84",
    alt: "Tegalalang rice terraces in Ubud, Bali",
  },
  "bali-canggu-movement-0002": {
    id: "I2YSmEUAgDY",
    alt: "Woman stretching on a mountain top during sunrise",
  },
  "bali-sidemen-restoration-0003": {
    id: "8w7b4SdhOgw",
    alt: "Woman meditating on floor with view of trees",
  },
  "bali-ubud-pranayama-0004": {
    id: "NTyBbu66_SI",
    alt: "Woman doing yoga meditation on wooden floor",
  },
  "bali-canggu-strength-0005": {
    id: "KeGKEOjhy6E",
    alt: "Silhouette of man raising hands during sunset",
  },
  "tulum-cenote-intensive-0006": {
    id: "GXOU59djQU0",
    alt: "Person sitting facing a blue and white sky",
  },
  "lisbon-silent-coast-0007": {
    id: "HS5CLnQbCOc",
    alt: "Woman sitting on bench overlooking a mountain view",
  },
  "rishikesh-ashram-stay-0008": {
    id: "vs-PjCh5goo",
    alt: "Person doing a meditation pose",
  },
  "nosara-surf-yin-0009": {
    id: "aZTGEJlNjuw",
    alt: "Person walking on a Costa Rica beach with a surfboard at sunset",
  },
  "joshua-tree-desert-silent-0010": {
    id: "3myqoCfSnAQ",
    alt: "Joshua Tree in the desert at sunset",
  },
};

// Build a full Unsplash CDN URL for a given photo at the requested width.
export function unsplashUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/photo-${photoId}?w=${width}&q=80&auto=format&fit=crop`;
}

// Palette-matched fallback for when an image fails to load or no mapping
// exists.
export const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #efe7d6 0%, #d8a892 100%)";
