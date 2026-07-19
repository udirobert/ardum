// Cream-on-dark treatment for surfaces that float over the hero orb's dusk
// field (calibration, retreat vision). Arrival voice lane uses underline
// inputs only; panel chrome is for invite / multi-party surfaces.

export const CREAM = "#f6efe3";

export const DUSK_MUTED = {
  color: "rgba(246,239,227,0.72)",
  textShadow: "0 1px 10px rgba(9,5,3,0.5)",
} as const;

export const DUSK_HEADING = {
  textShadow: "0 2px 26px rgba(9,5,3,0.6), 0 1px 3px rgba(9,5,3,0.55)",
} as const;

// Grounds interactive controls in a legible dark surface over the orb.
export const DUSK_PANEL = {
  background: "rgba(10,7,5,0.58)",
  borderColor: "rgba(246,239,227,0.14)",
} as const;
