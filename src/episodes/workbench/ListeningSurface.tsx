"use client";

// ListeningSurface — Beat 3 of the four-beat reveal. When the practitioner
// rejects the current recommendation ("not this one"), instead of immediately
// swapping to the next pick, Mira presents bounded alternative cards (3–5)
// with one-line differentiating reasons and elevate/not-this actions.
//
// This is the "Listening" beat: Mira heard the rejection and is showing what
// else she's weighing. The practitioner can elevate one of the alternatives
// (which fires reject-recommendation on the current pick, moving the
// alternative to the top) or go back.
//
// Design contract (experience-layer.md):
//   "Listening — summoned only via 'see other possibilities' or 'not this.'
//    Bounded 3–5 alternative cards with one-line differentiating reasons,
//    elevate/not-this actions, and the voice lane (the only place free-text
//    refinement lives)."
//
// Alternatives render as hairline-divided rows — quiet, information-first;
// the state stays fully legible statically (state-projection rule).

import MiraOrb from "@/components/MiraOrb";
import type { MiraPresence } from "@/agent/mira-presence";
import type { MatchResult } from "@/matching/types";
import { formatUsd } from "@/lib/format";
import { noFitLine } from "@/agent/mira-voice";

type Props = {
  alternatives: MatchResult[];
  currentTitle: string;
  presence: MiraPresence | null;
  onElevate: (retreatRootHash: string) => void;
  onBack: () => void;
  busy: boolean;
};

export default function ListeningSurface({
  alternatives,
  currentTitle,
  presence,
  onElevate,
  onBack,
  busy,
}: Props) {
  // Bound to 5 cards max (design contract: "bounded 3–5").
  const shown = alternatives.slice(0, 5);

  return (
    <div className="space-y-6" data-testid="listening-surface">
      {/* Mira's voice — she heard the rejection. */}
      <div className="flex items-start gap-3">
        <MiraOrb
          size={40}
          presence={presence ?? undefined}
          activity="speaking"
          className="flex-shrink-0 mt-1"
        />
        <div className="space-y-2 flex-1">
          <p className="text-lg leading-relaxed">
            Not {currentTitle}. Let me show you what else I&apos;m weighing.
          </p>
          <p className="text-sm leading-relaxed italic text-[color:var(--muted)]">
            These are the ones that also qualified. Pick one and I&apos;ll
            bring it forward — or tell me what feels off.
          </p>
        </div>
      </div>

      {/* Empty pool — canonical no-fit vocabulary, no improvised stretch. */}
      {shown.length === 0 ? (
        <p className="text-base leading-relaxed" role="status" data-testid="listening-empty">
          {noFitLine()}
        </p>
      ) : null}

      {/* Bounded alternative rows — scannable, elevate on the right. */}
      <div className="divide-y divide-[color:var(--hairline)]">
        {shown.map((alt, index) => (
          <div
            key={alt.retreatRootHash}
            className="py-4 first:pt-0 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[color:var(--muted)] mb-1">
                {index === 0 ? "next in line" : `option ${index + 1}`}
              </p>
              <p className="font-serif text-lg tracking-tight">
                {alt.retreatTitle}
              </p>
              <p className="text-xs text-[color:var(--muted)] mt-0.5">
                {alt.retreatLocation} · {alt.durationDays} days ·{" "}
                {formatUsd(alt.priceUsd)}
              </p>
              {alt.reasoning.length > 0 && (
                <p className="text-xs mt-1 italic text-[color:var(--accent-ink)]">
                  {alt.reasoning[0].then}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onElevate(alt.retreatRootHash)}
              className="flex-shrink-0 px-4 py-2 rounded-sm text-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-ink)] transition-colors disabled:opacity-40"
              aria-label={`Elevate ${alt.retreatTitle} to the top recommendation`}
            >
              Elevate
            </button>
          </div>
        ))}
      </div>

      {/* Back — return to the current recommendation. */}
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="text-sm text-[color:var(--muted)] hover:text-foreground underline disabled:opacity-40"
      >
        ← back to {currentTitle}
      </button>
    </div>
  );
}
