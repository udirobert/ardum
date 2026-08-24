// Retreat location → IATA destination code mapping.
//
// The retreat catalog uses human-readable locations ("Bali, Indonesia",
// "Sedona, Arizona, USA"). The Atlas API needs IATA codes. This mapping
// resolves a retreat location string to the nearest major airport so an
// agent can search flights to the retreat destination.
//
// Only locations that appear in the seed catalog are mapped. Unknown
// locations return null — the agent should skip flight search and surface
// the retreat match alone.

const LOCATION_TO_IATA: Record<string, string> = {
  // Bali
  "bali": "DPS", // Ngurah Rai International, Denpasar
  "sidemen": "DPS",
  "canggu": "DPS",
  "ubud": "DPS",
  // Mexico
  "tulum": "CUN", // Cancún (nearest international)
  // USA
  "joshua tree": "LAX", // Los Angeles (nearest major)
  "joshua tree, california": "LAX",
  "sedona": "FLG", // Flagstaff (closest), but PHX is more connected
  "sedona, arizona": "PHX", // Phoenix Sky Harbor (better international coverage)
  "arizona": "PHX",
  // Portugal
  "sintra": "LIS", // Lisbon
  "algarve": "FAO", // Faro
  // India
  "himalayan foothills": "DEL", // Delhi (entry point for Himalayan retreats)
  "himalayan foothills, india": "DEL",
  // Pacific Northwest
  "pacific northwest": "SEA", // Seattle-Tacoma
  "pacific northwest, usa": "SEA",
};

/**
 * Resolve a retreat location string to an IATA airport code.
 * Returns null if no mapping exists — the caller should skip flight search.
 */
export function locationToIata(location: string): string | null {
  const normalized = location.toLowerCase().trim();
  if (normalized in LOCATION_TO_IATA) {
    return LOCATION_TO_IATA[normalized];
  }
  // Try matching by the first word (e.g. "Bali, Indonesia" → "bali")
  const firstWord = normalized.split(/[,\s]/)[0];
  if (firstWord && firstWord in LOCATION_TO_IATA) {
    return LOCATION_TO_IATA[firstWord];
  }
  return null;
}
