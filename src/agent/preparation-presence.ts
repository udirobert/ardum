// Preparation presence — the wait projected into Mira's posture.
//
// The third presence projection: practitioner journey (mira-presence),
// operator demand (operator-presence), and now the post-booking wait.
// Anticipation research (see docs/plans/anticipation-layer.md) finds the
// booking-to-departure window is where most of the joy lives; the orb
// paces it — same grammar the practitioner already learned.
//
// Pure function of days-since-booking against the 5-day preparation arc
// (the attestation schema carries no start date, so the plan arc IS the
// timeline — honest, no invented dates):
//   day 0     arriving   — just booked, the radiating moment
//   days 1–2  holding    — the intention is held; settle in
//   day 3     gathering  — mid-arc, excitement builds (the research's
//                          pre-departure peak)
//   day 4+    resolving  — approaching; the plan completes

import type { MiraPresence } from "./mira-presence";

export const PREPARATION_ARC_DAYS = 5;

/** Whole days elapsed since the booking was recorded (never negative). */
export function daysSinceBooking(
  bookedAt: string,
  now: Date = new Date(),
): number {
  const booked = new Date(bookedAt);
  if (Number.isNaN(booked.getTime())) return 0;
  const ms = now.getTime() - booked.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Project the wait into Mira's posture for the booked landing. */
export function preparationPresence(
  bookedAt: string,
  now: Date = new Date(),
): MiraPresence {
  const days = daysSinceBooking(bookedAt, now);
  if (days <= 0) return { posture: "arriving", valence: 0 };
  if (days <= 2) return { posture: "holding", valence: 0 };
  if (days <= 3) return { posture: "gathering", valence: 0.1 };
  return { posture: "resolving", valence: 0 };
}
