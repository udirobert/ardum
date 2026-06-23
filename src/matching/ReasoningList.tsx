"use client";

import { useEffect, useState } from "react";
import type { ReasoningStep } from "./types";

// ReasoningList streams the agent's reasoning one step at a time. The
// cadence is fast enough to feel like the agent is "thinking out loud" but
// slow enough that the user can read each step.

export default function ReasoningList({
  steps,
  onComplete,
}: {
  steps: ReasoningStep[];
  onComplete?: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= steps.length) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 700);
    return () => clearTimeout(t);
  }, [shown, steps.length, onComplete]);

  return (
    <ol className="flex flex-col gap-5">
      {steps.slice(0, shown).map((s, i) => (
        <li key={i} className="fade-in-up">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="tag">reasoning · {s.axis}</span>
            <span
              className="h-px flex-1"
              style={{
                background:
                  "linear-gradient(90deg, var(--hairline) 0%, transparent 100%)",
              }}
            />
          </div>
          <p className="text-lg leading-snug mb-1">{s.observation}</p>
          <p className="why max-w-prose">{s.reasoning}</p>
        </li>
      ))}
      {shown < steps.length && (
        <li className="why pulse-soft">agent reasoning…</li>
      )}
    </ol>
  );
}
