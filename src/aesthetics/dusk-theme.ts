export const CREAM = "#f6efe3";

// Editorial (parchment) — the refuge arrival lands on. Separate from dusk
// so the two worlds can diverge without token leakage.
export const PAPER = "#fbf6ee";

export const EDITORIAL_MUTED = {
  color: "rgba(26,23,20,0.58)",
} as const;

export const EDITORIAL_EYEBROW = {
  fontFamily: "var(--font-geist-sans)",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "rgba(26,23,20,0.42)",
} as const;

// Cream-on-dark treatment for surfaces that float over the hero orb's dusk
// field. Arrival voice lane uses underline inputs only; panel chrome is for
// invite / multi-party surfaces.

export const DUSK_MUTED = {
  color: "rgba(246,239,227,0.72)",
  textShadow: "0 1px 10px rgba(9,5,3,0.5)",
} as const;

export const DUSK_HEADING = {
  textShadow: "0 2px 26px rgba(9,5,3,0.6), 0 1px 3px rgba(9,5,3,0.55)",
} as const;

// Eyebrow: the one serif/sans role for the small line above the ask.
// Sans, muted cream, letterspaced — never mono. Used for "Mira — your
// persistent guide" and "your active intention".
export const DUSK_EYEBROW = {
  fontFamily: "var(--font-geist-sans)",
  fontSize: "0.8125rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "rgba(246,239,227,0.58)",
  marginBottom: "0.75rem",
};

// Grounds interactive controls in a legible dark surface over the orb.
export const DUSK_PANEL = {
  background: "rgba(10,7,5,0.58)",
  borderColor: "rgba(246,239,227,0.14)",
} as const;

// Veil levels — the only two opacities for darkening the field.
export const VEIL = {
  quiet: 0.18,
  focus: 0.34,
} as const;
