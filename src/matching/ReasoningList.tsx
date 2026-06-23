"use client";

import type { ReasoningStep } from "./types";

// ReasoningList renders Gherkin-style reasoning steps (Given / When / Then)
// as they arrive from the SSE stream or a pre-loaded array. No internal
// pacing — the source controls cadence.

export default function ReasoningList({
  steps,
  isStreaming = false,
}: {
  steps: ReasoningStep[];
  isStreaming?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-7">
      {steps.map((s, i) => (
        <li key={`${s.axis}-${i}`} className="fade-in-up">
          <header className="flex items-baseline gap-3 mb-3">
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
          </header>

          <dl className="grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-2 max-w-prose">
            <GherkinRow label="Given" body={s.given} />
            <GherkinRow label="When" body={s.when} />
            <GherkinRow label="Then" body={s.then} emphasis />
          </dl>
        </li>
      ))}
      {isStreaming && (
        <li className="why pulse-soft">agent reasoning…</li>
      )}
    </ol>
  );
}

function GherkinRow({
  label,
  body,
  emphasis = false,
}: {
  label: string;
  body: string;
  emphasis?: boolean;
}) {
  return (
    <>
      <dt
        className={
          emphasis
            ? "font-serif italic text-[color:var(--accent-ink)] text-sm pt-0.5"
            : "tag pt-1"
        }
      >
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "font-serif text-lg leading-snug"
            : "text-base leading-snug"
        }
      >
        {body}
      </dd>
    </>
  );
}
