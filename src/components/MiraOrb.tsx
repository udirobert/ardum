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
      </div>
      {children}
    </div>
  );
}
