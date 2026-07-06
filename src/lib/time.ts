// ── Relative-time helpers ─────────────────────────────────────────────
// Pure functions for turning ISO 8601 timestamps into human-readable
// phrases ("three days ago", "yesterday", "a week ago"). Lives in
// src/lib/time.ts rather than next to any specific feature so both
// server (mira-voice.ts) and client (matchBanner.tsx) surfaces can
// import without crossing the server-only boundary on cognee.ts.
//
// The `now` parameter is exposed for testability and for callers that
// want a stable "ago" phrase relative to a fixed reference (e.g., the
// server-rendered time when SSRing a page).

/**
 * Turn an ISO timestamp into a phrase like "three days ago".
 * Returns null when the timestamp can't be parsed so the caller can
 * fall back to a temporal-less phrasing. Clock drift (future-dated
 * timestamps) is treated as "just now" — the same behavior as very
 * recent events.
 */
export function humanizeAgo(
  iso: string,
  now: number = Date.now(),
): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const diffMs = now - t;
  // Under a minute (or clock-drift negative) — treat as "just now".
  if (diffMs < 60_000) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return min === 1 ? "a minute ago" : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "an hour ago" : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  const wk = Math.floor(day / 7);
  if (wk === 1) return "a week ago";
  if (wk < 5) return `${wk} weeks ago`;
  const mo = Math.floor(day / 30);
  if (mo === 1) return "a month ago";
  if (mo < 12) return `${mo} months ago`;
  const yr = Math.floor(day / 365);
  return yr === 1 ? "a year ago" : `${yr} years ago`;
}
