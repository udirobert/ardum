// Operator presence — demand truth projected into Mira's posture.
//
// Mira is one agent with two projections: the practitioner sees her as a
// guide, the operator sees her as a scout. This module is the operator
// side of mira-presence.ts: it consumes only coarse demand counts
// (matches, holds, bookings) — never verbatim intentions or actor IDs —
// so the ADR 0010 privacy contract holds by construction.
//
// Posture grammar (same ring vocabulary the practitioner sees):
//   steady    — no demand yet          (sealed ring)
//   watching  — intentions are forming  (open ring)
//   gathering — holds are live          (open ring)
//   arriving  — a booking landed        (radiating ring)
// An operator learns the grammar once: open means attention is live,
// radiating means someone is coming.

import type { MiraPresence } from "./mira-presence";

export type DemandSignal = {
  totalMatches: number;
  activeHolds: number;
  bookings: number;
};

/** Project aggregate demand into Mira's posture for an operator surface. */
export function operatorPresence(demand: DemandSignal): MiraPresence {
  if (demand.bookings > 0) {
    // Someone is coming — the relationship surface.
    return { posture: "arriving", valence: 0 };
  }
  if (demand.activeHolds > 0) {
    // Decisions in flight; a mild deadline tension (holds expire).
    return { posture: "gathering", valence: 0.1 };
  }
  if (demand.totalMatches > 0) {
    // Intentions are forming toward this retreat.
    return { posture: "watching", valence: 0 };
  }
  return { posture: "steady", valence: 0 };
}
