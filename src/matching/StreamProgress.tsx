"use client";

// A quiet progress indicator for the reasoning stream. The bar fills as
// steps arrive; we cap at 90% while streaming so we never lie about
// completion. When the stream finishes the parent swaps us out for the
// 'matched' indicator.

const MIN_STEPS_DISPLAY = 6;

export default function StreamProgress({ steps }: { steps: number }) {
  // Derived directly from props — no need for state here. The transition
  // CSS handles the visual smoothing.
  const pct = Math.min(90, (steps / MIN_STEPS_DISPLAY) * 90);

  return (
    <div
      className="h-px w-full bg-[color:var(--hairline)] mb-8 overflow-hidden"
      aria-label={`Reasoning progress: ${steps} steps received`}
    >
      <div
        className="h-full bg-[color:var(--accent)] transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
