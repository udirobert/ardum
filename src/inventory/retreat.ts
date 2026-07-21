// Presentation contract for retreats in the inventory-led experience.
// Track A owns catalog/ranking; Track B owns how this is rendered.

export interface Retreat {
  id: string;
  title: string;
  location: string;
  heroImage: string;
  gallery: string[];
  operator: {
    name: string;
    bio: string;
    avatar: string;
  };
  dates: {
    start: string;
    end: string;
    duration: number; // days
  };
  price: {
    amount: number;
    currency: string;
    includes: string[];
  };
  capacity: {
    min: number;
    max: number;
    current: number;
  };
  description: string;
  highlights: string[];
  /** Attestation that backs this retreat, if any. */
  attestationId?: string;
  /** Extracted or hand-tuned color palette for ambient effects. */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Somatic fit tags — used for Mira's contextual notes and ranking. */
  fit?: {
    energy?: "settled" | "in-movement" | "low" | "sharp";
    social?: "solo" | "small-circle" | "open-circle" | "communal";
  };
}
