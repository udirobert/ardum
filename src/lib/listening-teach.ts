// One-time teaching flag for the Listening beat. The Listening surface
// is summoned by rejection ("not this one — show me another"), which
// users socialized by marketplace apps may never press — they don't
// know alternatives exist because they're demoted, not absent. The
// beckon hint appears once, on the first strong-fit recommendation,
// and never repeats on the same device. Cleared alongside other local
// storage on /memory. (Pattern: nudge-teach.ts.)
//
// Exposed as a tiny external store so components read it through
// useSyncExternalStore — SSR-safe (server snapshot = seen, so the hint
// never renders on the server) and no setState-in-effect cascades.

const SEEN_KEY = "ardum:listening-beckon-seen";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

export function subscribeListeningBeckon(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Client snapshot for useSyncExternalStore. */
export function listeningBeckonSeen(): boolean {
  if (cached === null) {
    try {
      cached = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      cached = true; // private mode: never show the hint
    }
  }
  return cached;
}

/** Server snapshot — treated as seen so the hint is client-only. */
export function listeningBeckonSeenServer(): boolean {
  return true;
}

export function dismissListeningBeckon(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
  cached = true;
  for (const notify of listeners) notify();
}

