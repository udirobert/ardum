// Presentation-only image map for seed retreats. The attestation schema
// (0G Storage) intentionally carries no image URLs — attestations are
// evidence records, not marketing assets. This lookup keeps the image
// data in the presentation layer where it belongs.
//
// In production, operator-submitted retreats would carry image URLs in
// the operator record (not the attestation). This seed map is the demo
// equivalent: it joins rootHash → curated Unsplash image + palette so
// the workbench can render imagery without polluting the attestation
// contract.

export type RetreatImage = {
  heroImage: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

function unsplash(id: string, w = 1200): string {
  return `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
}

const RETREAT_IMAGES: Record<string, RetreatImage> = {
  "bali-ubud-stillness-0001": {
    heroImage: unsplash("photo-1518544801976-3e159e50e5bb"),
    palette: { primary: "#5B8266", secondary: "#A8C09A", accent: "#E8D5B7" },
  },
  "bali-canggu-movement-0002": {
    heroImage: unsplash("photo-1537996194471-e657df71f429"),
    palette: { primary: "#5B8FA8", secondary: "#E8D5B7", accent: "#D4726A" },
  },
  "bali-sidemen-restoration-0003": {
    heroImage: unsplash("photo-1518544801976-3e159e50e5bb"),
    palette: { primary: "#6B8E5A", secondary: "#C4D4B8", accent: "#D4A574" },
  },
  "bali-ubud-pranayama-0004": {
    heroImage: unsplash("photo-1537900298318-6b8da08a523e"),
    palette: { primary: "#4A6741", secondary: "#A8B5A0", accent: "#D4A574" },
  },
  "bali-canggu-strength-0005": {
    heroImage: unsplash("photo-1544367567-0f2fcb009e0b"),
    palette: { primary: "#6B7B8C", secondary: "#D0D8E0", accent: "#E8A87C" },
  },
  "tulum-cenote-intensive-0006": {
    heroImage: unsplash("photo-1518611012118-696072aa579a"),
    palette: { primary: "#4A8EA8", secondary: "#B8E0E8", accent: "#C8A064" },
  },
  "lisbon-silent-coast-0007": {
    heroImage: unsplash("photo-1555400038-63f5ba517a47"),
    palette: { primary: "#6B93A8", secondary: "#F0E5D8", accent: "#E8A87C" },
  },
  "rishikesh-ashram-stay-0008": {
    heroImage: unsplash("photo-1544787219-7f47ccb76574"),
    palette: { primary: "#8B7355", secondary: "#D4A574", accent: "#4A6741" },
  },
  "nosara-surf-yin-0009": {
    heroImage: unsplash("photo-1500534314209-a25ddb2c4e03"),
    palette: { primary: "#5B8FA8", secondary: "#E8D5B7", accent: "#C8A064" },
  },
  "joshua-tree-desert-silent-0010": {
    heroImage: unsplash("photo-1509316785289-025f5b846b35"),
    palette: { primary: "#C87070", secondary: "#E8C4A0", accent: "#6B4E71" },
  },
};

const FALLBACK: RetreatImage = {
  heroImage: unsplash("photo-1518544801976-3e159e50e5bb"),
  palette: { primary: "#7B6B5A", secondary: "#C4B8A8", accent: "#A89888" },
};

export function getRetreatImage(rootHash: string): RetreatImage {
  return RETREAT_IMAGES[rootHash] ?? FALLBACK;
}
