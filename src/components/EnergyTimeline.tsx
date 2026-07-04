"use client";

// EnergyTimeline — a custom SVG sparkline showing how the practitioner's
// energy has evolved across visits. This is the "AI that doesn't forget"
// made tangible in a single visual.
//
// No charting library — hand-built SVG following the existing pattern
// (BreathCycleDiagram, BreathSync). Uses the cream/terracotta palette.
//
// The energy states are mapped to a vertical scale:
//   low → 0.2 (bottom)
//   settled → 0.4
//   in-movement → 0.7
//   sharp → 0.9 (top)
//
// The line connects the points with a smooth curve. Each point is a
// circle with the energy label below. The most recent point is larger
// and pulses softly.

import { useMemo } from "react";

const ENERGY_SCALE: Record<string, number> = {
  low: 0.2,
  settled: 0.4,
  "in-movement": 0.7,
  sharp: 0.9,
};

const ENERGY_LABEL: Record<string, string> = {
  low: "Low",
  settled: "Settled",
  "in-movement": "In movement",
  sharp: "Sharp",
};

export default function EnergyTimeline({
  energyHistory,
}: {
  energyHistory: string[];
}) {
  const points = useMemo(() => {
    return energyHistory.map((e, i) => ({
      x: (i / Math.max(1, energyHistory.length - 1)) * 100,
      y: 100 - (ENERGY_SCALE[e] ?? 0.5) * 100,
      label: ENERGY_LABEL[e] ?? e,
      raw: e,
    }));
  }, [energyHistory]);

  if (points.length === 0) return null;

  // Build a smooth path through the points using simple line segments.
  // A Catmull-Rom spline would be smoother but lines are more honest —
  // these are discrete visits, not a continuous signal.
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Build a filled area under the line for visual weight.
  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 100 110"
        preserveAspectRatio="none"
        className="w-full h-32 sm:h-40"
        role="img"
        aria-label="Energy trajectory across visits"
      >
        {/* Horizontal guide lines — quiet, for orientation */}
        {[20, 40, 60, 80].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="var(--hairline)"
            strokeWidth="0.15"
            strokeDasharray="1 2"
            opacity="0.4"
          />
        ))}

        {/* Filled area under the line */}
        <path
          d={areaD}
          fill="var(--accent-soft)"
          opacity="0.12"
        />

        {/* The line itself */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Points */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 1.8 : 1.2}
                fill="var(--accent)"
                className={isLast ? "pulse-soft" : ""}
                vectorEffect="non-scaling-stroke"
              />
              {isLast && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="0.3"
                  opacity="0.3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Labels below — the energy state at each visit */}
      <div className="flex justify-between mt-2 -mx-1">
        {points.map((p, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{ flex: 1 }}
          >
            <span
              className={`tag text-[10px] sm:text-xs text-center ${
                i === points.length - 1
                  ? "text-[color:var(--accent)]"
                  : "opacity-60"
              }`}
            >
              {p.label}
            </span>
            <span className="tag text-[10px] opacity-40 mt-0.5">
              visit {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
