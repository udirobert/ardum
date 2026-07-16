"use client";

// BreathSync — ambient ritual while Mira secures a commitment.
// Maps to a relaxed 4-2-6 breath (practice language), not chain names.
// Labels stay human per docs/decisions/0008-agentic-commitment.md.

import { useEffect, useState } from "react";

type BreathPhase = "inhale" | "hold" | "exhale" | "settled";

type BreathSyncProps = {
  /** Trigger the breath cycle when true */
  active: boolean;
  /** Called when the full cycle completes */
  onComplete?: () => void;
};

const PHASES: {
  phase: BreathPhase;
  duration: number;
  label: string;
  scale: number;
}[] = [
  { phase: "inhale", duration: 4000, label: "Confirming with you…", scale: 1.6 },
  { phase: "hold", duration: 2000, label: "Securing the place…", scale: 1.6 },
  { phase: "exhale", duration: 6000, label: "Held.", scale: 1.0 },
];

export default function BreathSync({ active, onComplete }: BreathSyncProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  const currentPhase = PHASES[phaseIndex];
  const isSettled = phaseIndex >= PHASES.length;
  const scale = currentPhase?.scale ?? 1.0;

  useEffect(() => {
    if (!active || isSettled) return;

    const phase = PHASES[phaseIndex];

    const timer = setTimeout(() => {
      if (phaseIndex < PHASES.length - 1) {
        setPhaseIndex(phaseIndex + 1);
      } else {
        setPhaseIndex(PHASES.length);
        onComplete?.();
      }
    }, phase.duration);

    return () => clearTimeout(timer);
  }, [active, phaseIndex, isSettled, onComplete]);

  if (!active) return null;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border border-[color:var(--accent-soft)]"
          style={{
            transform: `scale(${scale})`,
            transition: `transform ${currentPhase?.duration ?? 0}ms ease-in-out`,
          }}
        />
        <div
          className="w-20 h-20 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--accent), var(--accent-ink))",
            transform: `scale(${scale * 0.7 + 0.3})`,
            transition: `transform ${currentPhase?.duration ?? 0}ms ease-in-out`,
            opacity: isSettled ? 0.9 : 0.7,
          }}
        />
        {isSettled && (
          <div
            className="absolute inset-0 rounded-full border-2 border-[color:var(--accent)]"
            style={{
              animation: "breath-ripple 1.5s ease-out",
            }}
          />
        )}
      </div>

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
            Held.
          </p>
        )}
      </div>

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
    </div>
  );
}
