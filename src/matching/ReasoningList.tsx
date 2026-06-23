"use client";

import type { ReasoningStep } from "./types";

// ReasoningList renders reasoning steps as they arrive. No internal
// setTimeout pacing — the source (SSE stream or pre-loaded array) controls
// cadence. Each step fades in on mount.

export default function ReasoningList({
  steps,
  isStreaming = false,
}: {
  steps: ReasoningStep[];
  isStreaming?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-5">
      {steps.map((s, i) => (
        <li
          key={`${s.axis}-${i}`}
          className="fade-in-up"
        >
          <div className="flex items-baseline gap-3 mb-1">
            <span className="tag">reasoning · {s.axis}</span>
            <span
              className="h-px flex-1"
              style={{
                background:
                  "linear-gradient(90deg, var(--hairline) 0%, transparent 100%)",
              }}
            />
            {s.weight > 0 && (
              <span className="tag tabular-nums">
                weight {s.weight.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-lg leading-snug mb-1">{s.observation}</p>
          <p className="why max-w-prose">{s.reasoning}</p>
        </li>
      ))}
      {isStreaming && (
        <li className="why pulse-soft">agent reasoning…</li>
      )}
    </ol>
  );
}
