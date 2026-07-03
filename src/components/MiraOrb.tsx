"use client";

// Mira — the agent persona that guides users through Ardum.
//
// Not a chatbot. Not a mascot. A breathing presence that anchors the
// conversation. The orb pulses at a calm 4-second cycle (matching
// a relaxed breathing rhythm of ~15 breaths/min). When Mira is
// "thinking" (processing), the orb breathes slightly faster.
//
// Mira's voice is warm, second-person, present tense. Never says
// "I am an AI." Talks like a guide who has been doing this for years.
//
// Name: Mira (Sanskrit: "ocean" — the vast, calm body that holds depth)
//
// ── The mudra ring ──────────────────────────────────────────────────
//
// Ardum is "mudra" reversed. A mudra is a seal — a closed shape that
// directs energy. Ardum opens the seal. The orb carries a thin ring
// inside it that represents this:
//
//   calm    → ring is complete (the seal — chin mudra, receptivity)
//   thinking → ring has a gap  (the seal opened — Ardum, inquiry)
//   speaking → ring radiates    (the offering — abhaya, fearlessness)
//
// The gap IS the concept. A mudra seals. Ardum opens. The user sees
// this without needing to know Sanskrit.

import { useEffect, useRef, type ReactNode } from "react";

type MiraOrbProps = {
  /** Breathing state — "calm" (default), "thinking" (faster pulse), "speaking" (gentle expand) */
  state?: "calm" | "thinking" | "speaking";
  /** Size in px. Default: 48 */
  size?: number;
  /** Optional children rendered below the orb (e.g. a label) */
  children?: ReactNode;
  className?: string;
};

export default function MiraOrb({
  state = "calm",
  size = 48,
  children,
  className,
}: MiraOrbProps) {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;

    // Sync the breathing animation speed to the state
    const duration = state === "thinking" ? "2s" : state === "speaking" ? "3s" : "4s";
    orb.style.animationDuration = duration;
  }, [state]);

  // The mudra ring — an SVG circle that changes based on state.
  //   calm:    complete circle (the seal)
  //   thinking: circle with a gap (the seal opened — Ardum)
  //   speaking: circle with a wider gap + radiating dots (the offering)
  //
  // The ring is drawn as an SVG stroke-dasharray so we can animate
  // the gap opening and closing. The dasharray creates the gap; the
  // dashoffset rotates it.
  const ringRadius = (size - 8) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;

  // Gap sizes — how much of the ring is "opened"
  const gapSize =
    state === "thinking"
      ? ringCircumference * 0.15 // 15% gap — the seal cracked open
      : state === "speaking"
        ? ringCircumference * 0.25 // 25% gap — the offering
        : 0; // calm — complete seal

  const visibleLength = ringCircumference - gapSize;

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <div
        ref={orbRef}
        className="relative rounded-full mira-orb"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 35% 30%, rgba(168,90,58,0.35), rgba(168,90,58,0.08) 60%, transparent 80%)",
          border: "1px solid rgba(168,90,58,0.15)",
        }}
        aria-hidden
      >
        {/* Inner glow */}
        <div
          className="absolute inset-2 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 40% 35%, rgba(246,241,231,0.4), transparent 70%)",
          }}
        />
        {/* Outer halo */}
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(168,90,58,0.2), transparent 70%)",
            transform: "scale(1.4)",
          }}
        />

        {/* The mudra ring — the seal that opens */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={ringRadius}
            stroke="rgba(168,90,58,0.4)"
            strokeWidth="0.75"
            strokeDasharray={`${visibleLength} ${gapSize}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{
              transition: "stroke-dasharray 1.2s ease-in-out",
              transform: "rotate(-90deg)",
              transformOrigin: "center",
            }}
          />
        </svg>

        {/* Speaking state — radiating dots (abhaya, the offering) */}
        {state === "speaking" && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
          >
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const dotR = size / 2 + 3;
              const cx = size / 2 + dotR * Math.cos(rad);
              const cy = size / 2 + dotR * Math.sin(rad);
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="0.8"
                  fill="rgba(168,90,58,0.5)"
                  style={{
                    animation: `mira-radiate 3s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              );
            })}
          </svg>
        )}
      </div>
      {children}
    </div>
  );
}
