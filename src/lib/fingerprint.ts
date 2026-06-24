// Local cross-session memory. The agent remembers the practitioner's
// stated profile (and pose baseline, if one was captured) across visits
// to the demo. Nothing leaves the browser — this is localStorage only.
//
// Three guarantees:
//   - opt-in by default (we don't auto-populate; we ask first)
//   - obvious reset ("clear my history" link on the match page)
//   - time-bounded (only recall within 1-30 days; older is treated as
//     stale and the user is asked to start fresh)

import type { PoseBaseline, PractitionerProfile } from "@/calibration/schema";

const STORAGE_KEY = "ardum:fingerprint:v1";

// Show the recall prompt for sessions in this window. <1 day feels like
// the same session; >30 days is stale enough to start fresh.
const RECALL_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const RECALL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type Fingerprint = {
  // The profile fields the agent remembers. `notes` is intentionally
  // omitted — that's the most likely place for personally-identifying
  // detail and we'd rather ask again than carry it forward.
  profile: Pick<PractitionerProfile, "energy" | "budget" | "social">;
  pose?: PoseBaseline;
  // When the fingerprint was last saved (epoch ms). Updated on every
  // intake completion.
  savedAt: number;
};

export function getFingerprint(): Fingerprint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Fingerprint;
    if (!parsed.profile || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setFingerprint(
  profile: PractitionerProfile,
  pose?: PoseBaseline
): void {
  if (typeof window === "undefined") return;
  try {
    const fp: Fingerprint = {
      profile: {
        energy: profile.energy,
        budget: profile.budget,
        social: profile.social,
      },
      pose,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fp));
  } catch {
    // localStorage may be full or unavailable; the agent will just
    // start fresh next visit.
  }
}

export function clearFingerprint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// True if a fingerprint exists and falls within the recall window. This
// is the gate the Intake uses before showing the welcome-back prompt.
export function isRecallable(fp: Fingerprint | null): fp is Fingerprint {
  if (!fp) return false;
  const age = Date.now() - fp.savedAt;
  return age >= RECALL_MIN_AGE_MS && age <= RECALL_MAX_AGE_MS;
}

// Human-readable "X days ago" for the welcome-back prompt. Returns null
// for a fingerprint outside the recall window.
export function recallAgeLabel(fp: Fingerprint | null): string | null {
  if (!fp) return null;
  const age = Date.now() - fp.savedAt;
  if (age < RECALL_MIN_AGE_MS || age > RECALL_MAX_AGE_MS) return null;
  const days = Math.max(1, Math.round(age / (24 * 60 * 60 * 1000)));
  return days === 1 ? "yesterday" : `${days} days ago`;
}
