"use client";

import { useMemo } from "react";
import type { ReasoningStep } from "./types";

// ReasoningList renders Gherkin-style reasoning steps (Given / When / Then)
// as they arrive from the SSE stream or a pre-loaded array. Consecutive
// "Considering" steps are collapsed into a single animated block so the
// user isn't scrolling through ten near-identical entries.

type DisplayItem =
  | { kind: "single"; step: ReasoningStep; key: string }
  | { kind: "group"; label: string; items: ReasoningStep[]; key: string };

function groupSteps(steps: ReasoningStep[]): DisplayItem[] {
  const result: DisplayItem[] = [];
  let buffer: ReasoningStep[] = [];

  function flush() {
    if (buffer.length === 0) return;
    if (buffer.length === 1) {
      result.push({ kind: "single", step: buffer[0], key: `s-${result.length}` });
    } else {
      result.push({
        kind: "group",
        label: `Scanning ${buffer.length} retreats`,
        items: [...buffer],
        key: `g-${result.length}`,
      });
    }
    buffer = [];
  }

  for (const s of steps) {
    if (s.axis === "Considering") {
      buffer.push(s);
    } else {
      flush();
      result.push({ kind: "single", step: s, key: `s-${result.length}` });
    }
  }
  flush();

  return result;
}

export default function ReasoningList({
  steps,
  isStreaming = false,
}: {
  steps: ReasoningStep[];
  isStreaming?: boolean;
}) {
  const items = useMemo(() => groupSteps(steps), [steps]);

  return (
    <ol className="flex flex-col gap-7">
      {items.map((item) =>
        item.kind === "single" ? (
          <SingleStep key={item.key} step={item.step} />
        ) : (
          <ConsideringGroup key={item.key} label={item.label} items={item.items} />
        )
      )}
      {isStreaming && (
        <li className="why pulse-soft">agent reasoning&hellip;</li>
      )}
    </ol>
  );
}

function SingleStep({ step }: { step: ReasoningStep }) {
  return (
    <li className="fade-in-up">
      <header className="flex items-baseline gap-3 mb-4">
        <span className="font-serif text-base sm:text-lg text-foreground">
          {step.axis}
        </span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, var(--hairline) 0%, transparent 100%)",
          }}
        />
        {step.weight > 0 && <WeightChip weight={step.weight} />}
      </header>
      <dl className="grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-2 max-w-prose">
        <GherkinRow label="Given" body={step.given} />
        <GherkinRow label="When" body={step.when} />
        <GherkinRow label="Then" body={step.then} emphasis />
      </dl>
    </li>
  );
}

function ConsideringGroup({
  label,
  items,
}: {
  label: string;
  items: ReasoningStep[];
}) {
  return (
    <li className="fade-in-up">
      <header className="flex items-baseline gap-3 mb-4">
        <span className="font-serif text-base sm:text-lg text-foreground">
          {label}
        </span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, var(--hairline) 0%, transparent 100%)",
          }}
        />
      </header>
      <div className="flex flex-col gap-1.5 max-w-prose">
        {items.map((s, i) => (
          <ConsideringRow key={s.given} name={s.given} index={i} total={items.length} />
        ))}
      </div>
    </li>
  );
}

// A small visual weight bar — replaces the "weight 0.35" tag with a
// felt indicator. The dot fills with accent in proportion to weight (0-1).
function WeightChip({ weight }: { weight: number }) {
  const pct = Math.max(0, Math.min(1, weight));
  return (
    <span className="inline-flex items-center gap-2 shrink-0" aria-label={`weight ${weight.toFixed(2)}`}>
      <span
        aria-hidden
        className="block h-1 w-12 rounded-sm overflow-hidden"
        style={{ background: "var(--hairline)" }}
      >
        <span
          className="block h-full"
          style={{ width: `${pct * 100}%`, background: "var(--accent)" }}
        />
      </span>
      <span className="tag tabular-nums">{weight.toFixed(2)}</span>
    </span>
  );
}

function ConsideringRow({
  name,
  index,
  total,
}: {
  name: string;
  index: number;
  total: number;
}) {
  return (
    <div
      className="flex items-center gap-3 text-sm fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span
        className="shrink-0 w-1.5 h-1.5 rounded-full"
        style={{
          background:
            index === total - 1
              ? "var(--accent)"
              : "var(--hairline)",
        }}
      />
      <span
        className={
          index === total - 1
            ? "text-foreground font-medium"
            : "text-[color:var(--muted)]"
        }
      >
        {name}
      </span>
      {index === total - 1 && (
        <span className="tag pulse-soft ml-auto">scoring&hellip;</span>
      )}
    </div>
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
