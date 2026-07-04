"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { findMatchResultByRetreatId } from "@/lib/client-session";
import type { MatchRun } from "@/matching/types";

// Reads the cached match from localStorage and shows a fit-score banner
// if the user has a match result for this retreat. Uses useState + useEffect
// (not useSyncExternalStore) because findMatchResultByRetreatId parses JSON
// on every call, returning a new object reference each time — which would
// cause useSyncExternalStore to loop infinitely (React error #185).

export default function ClientMatchBanner({
  retreatId,
}: {
  retreatId: string;
}) {
  const [match, setMatch] = useState<MatchRun | null>(null);

  useEffect(() => {
    const stored = findMatchResultByRetreatId(retreatId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatch(stored?.run ?? null);
  }, [retreatId]);

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
