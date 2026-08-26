// One-time teaching flag for the Mira nudge gesture. The beckon (a soft
// ring + whisper that appears on first visit) writes this flag when the
// practitioner has had a chance to see it, so it never repeats on the same
// device. Cleared alongside other local storage on /memory.

const SEEN_KEY = "ardum:mira-nudge-seen";

export function hasSeenNudgeGesture(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SEEN_KEY) === "1";
}

export function markNudgeGestureSeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_KEY, "1");
}
