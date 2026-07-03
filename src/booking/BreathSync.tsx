"use client";

// BreathSync — visualizes the on-chain deposit transaction as a breath
// cycle. Inhale = signing, hold = settling on-chain, exhale = confirmed.
//
// This is the marquee detail that ties the crypto primitive to the
// yoga primitive. Instead of a transaction spinner, the user sees
// a breathing circle that maps to both the breath they'll practice
// at the retreat AND the transaction settling on Arbitrum.
//
// The cycle:
//   Phase 1 (inhale, 4s): circle expands, "Signing your deposit…"
//   Phase 2 (hold, 2s): circle holds at full, "Settling on Arbitrum…"
//   Phase 3 (exhale, 6s): circle contracts, "Confirmed. Your spot is held."
//
// The timing matches a relaxed breathing ratio (4-2-6) — the same
// ratio that many of the retreats teach.

import { useEffect, useState } from "react";

type BreathPhase = "inhale" | "hold" | "exhale" | "settled";

type BreathSyncProps = {
  /** Trigger the breath cycle when true */
  active: boolean;
  /** Called when the full cycle completes */
  onComplete?: () => void;
};

const PHASES: { phase: BreathPhase; duration: number; label: string; scale: number }[] = [
  { phase: "inhale", duration: 4000, label: "Signing your deposit…", scale: 1.6 },
  { phase: "hold", duration: 2000, label: "Settling on Arbitrum…", scale: 1.6 },
  { phase: "exhale", duration: 6000, label: "Confirmed. Your spot is held.", scale: 1.0 },
];

export default function BreathSync({ active, onComplete }: BreathSyncProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  const currentPhase = PHASES[phaseIndex];
  const isSettled = phaseIndex >= PHASES.length;
  // Derive scale from phase index — no separate state needed
  const scale = currentPhase?.scale ?? 1.0;

  useEffect(() => {
    if (!active || isSettled) return;

    const phase = PHASES[phaseIndex];

    // Advance to next phase after duration
    const timer = setTimeout(() => {
      if (phaseIndex < PHASES.length - 1) {
        setPhaseIndex(phaseIndex + 1);
      } else {
        setPhaseIndex(PHASES.length); // settled
        onComplete?.();
      }
    }, phase.duration);

    return () => clearTimeout(timer);
  }, [active, phaseIndex, isSettled, onComplete]);

  if (!active) return null;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Breath circle */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Outer ring — the breath container */}
        <div
          className="absolute inset-0 rounded-full border border-[color:var(--accent-soft)]"
          style={{
            transform: `scale(${scale})`,
            transition: `transform ${currentPhase?.duration ?? 0}ms ease-in-out`,
          }}
        />
        {/* Inner orb — Mira's breathing body */}
        <div
          className="w-20 h-20 rounded-full"
          style={{
            background: "radial-gradient(circle at 30% 30%, var(--accent), var(--accent-ink))",
            transform: `scale(${scale * 0.7 + 0.3})`,
            transition: `transform ${currentPhase?.duration ?? 0}ms ease-in-out`,
            opacity: isSettled ? 0.9 : 0.7,
          }}
        />
        {/* Ripple effect on settle */}
        {isSettled && (
          <div
            className="absolute inset-0 rounded-full border-2 border-[color:var(--accent)]"
            style={{
              animation: "breath-ripple 1.5s ease-out",
            }}
          />
        )}
      </div>

      {/* Phase label */}
      <div className="mt-6 h-6">
        {!isSettled && currentPhase && (
          <p
            key={currentPhase.phase}
            className="text-sm text-[color:var(--muted)] fade-in-up tracking-wide"
          >
            {currentPhase.label}
          </p>
        )}
        {isSettled && (
          <p className="text-sm text-[color:var(--accent)] fade-in-up tracking-wide">
            Confirmed. Your spot is held.
          </p>
        )}
      </div>

      {/* Phase indicator dots */}
      <div className="flex gap-2 mt-4">
        {PHASES.map((p, i) => (
          <span
            key={p.phase}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i < phaseIndex
                ? "bg-[color:var(--accent)]"
                : i === phaseIndex
                  ? "bg-[color:var(--accent)] pulse-soft"
                  : "bg-[color:var(--hairline)]"
            }`}
          />
        ))}
      </div>

      {/* Breathing ratio label — ties to yoga practice */}
      {!isSettled && (
        <p className="tag mt-4 opacity-50">
          4-2-6 breathing ratio
        </p>
      )}
    </div>
  );
}
