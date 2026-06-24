"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { findMatchResultByRetreatId } from "@/lib/client-session";
import type { MatchRun } from "@/matching/types";

// Read the cached match from localStorage via useSyncExternalStore so
// localStorage access is registered as external state, not a mount-time
// effect. The server snapshot is null (no localStorage on the server);
// React re-renders once after hydration with the real value.

const subscribeNoop = () => () => {};

function snapshot(retreatId: string): MatchRun | null {
  if (typeof window === "undefined") return null;
  const stored = findMatchResultByRetreatId(retreatId);
  return stored?.run ?? null;
}

const serverSnapshot: MatchRun | null = null;

export default function ClientMatchBanner({
  retreatId,
}: {
  retreatId: string;
}) {
  const match = useSyncExternalStore(
    subscribeNoop,
    () => snapshot(retreatId),
    () => serverSnapshot
  );

  if (!match) return null;

  const result = match.results.find(
    (r) => r.id === retreatId || r.retreatRootHash === retreatId
  );
  if (!result) return null;

  const pct = Math.round(result.score * 100);

  return (
    <div className="mb-8 flex items-baseline gap-3 p-4 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] surface-card">
      <p className="font-serif text-5xl tabular-nums">{pct}</p>
      <div>
        <p className="tag">fit score from your match</p>
        <Link
          href={`/match?session=${encodeURIComponent(match.practitionerId)}`}
          className="tag underline underline-offset-4 decoration-[color:var(--hairline)] hover:decoration-[color:var(--accent)]"
        >
          View full reasoning →
        </Link>
      </div>
    </div>
  );
}
