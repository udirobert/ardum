import type { BreathCycle } from "@/attestation/schema";

// A small, quiet diagram of a breath cycle. Each segment of the main cycle
// is rendered as a sequence of bars (inhale / retain / exhale / sustain)
// with proportional widths. It's deliberately minimal — the goal is
// structure, not decoration.

const PHASES = ["inhale", "retain", "exhale", "sustain"] as const;
type Phase = (typeof PHASES)[number];

const PHASE_LABEL: Record<Phase, string> = {
  inhale: "in",
  retain: "hold",
  exhale: "out",
  sustain: "rest",
};

const PHASE_TINT: Record<Phase, string> = {
  inhale: "var(--accent-soft)",
  retain: "var(--accent)",
  exhale: "var(--accent-ink)",
  sustain: "var(--muted)",
};

export default function BreathCycleDiagram({
  cycle,
}: {
  cycle: BreathCycle;
}) {
  // Flatten all segments into a single list of phase durations, weighted
  // by repeat. This is the canonical timeline.
  const timeline: { phase: Phase; seconds: number }[] = [];
  for (const seg of cycle.cycle) {
    for (let i = 0; i < seg.repeat; i++) {
      for (const p of PHASES) {
        const v = seg[p];
        if (v > 0) timeline.push({ phase: p, seconds: v });
      }
    }
  }
  const totalSeconds = timeline.reduce((s, x) => s + x.seconds, 0);
  if (totalSeconds === 0) return null;

  return (
    <div>
      {/* The cycle strip — proportional widths, phase tints. */}
      <div
        className="flex w-full h-10 rounded-sm overflow-hidden border border-[color:var(--hairline)]"
        aria-label={`Breath cycle: ${cycle.ratio}`}
      >
        {timeline.map((step, i) => {
          const pct = (step.seconds / totalSeconds) * 100;
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: PHASE_TINT[step.phase],
              }}
              title={`${PHASE_LABEL[step.phase]} ${step.seconds}s`}
            />
          );
        })}
      </div>

      {/* Legend. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs">
        {PHASES.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: PHASE_TINT[p] }}
            />
            <span className="text-[color:var(--muted)]">
              {PHASE_LABEL[p]}
            </span>
          </li>
        ))}
      </ul>

      {/* Total cycle length, in plain language. */}
      <p className="text-xs text-[color:var(--muted)] mt-2">
        {timeline.length} phases · {totalSeconds}s per full cycle · ratio{" "}
        <span className="tag">{cycle.ratio}</span>
      </p>
    </div>
  );
}
