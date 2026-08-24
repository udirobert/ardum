// Haptic vocabulary — tactile language for Mira's key moments.
// Each pattern is a vibration sequence (duration in ms) that communicates
// a physical quality of the interaction. Falls back silently when the
// Vibration API is unavailable.

export type HapticPattern =
  | "tap"        // light acknowledgment (recommendation arrives, feedback sent)
  | "heartbeat"  // Mira took responsibility (hold created)
  | "weight"     // approaching commitment threshold
  | "settle"     // commitment confirmed — things landed
  | "release"    // let go (spring-back, cancel)
  | "nudge";     // gentle attention (tab refocus, hold expiry near)

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  heartbeat: [12, 60, 12],
  weight: 20,
  settle: [35, 15, 35, 15, 50],
  release: 6,
  nudge: [6, 40, 6],
};

/**
 * Fire a haptic pattern. No-op if the Vibration API is unavailable or if
 * the user has indicated they prefer reduced motion (haptics are motion).
 */
export function haptic(pattern: HapticPattern): void {
  if (typeof navigator === "undefined") return;
  if (!navigator.vibrate) return;

  // Respect reduced motion — haptics are a form of motion feedback.
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const sequence = PATTERNS[pattern];
  navigator.vibrate(sequence);
}
