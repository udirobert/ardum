"use client";

// MemoryGraph — a custom SVG node-edge diagram showing Mira's knowledge
// graph for this practitioner. The practitioner sits at the center;
// energy states, retreats, bookings, and notes radiate outward as
// connected nodes.
//
// No charting library — hand-built SVG following the existing pattern.
// Uses the cream/terracotta palette and the contemplative aesthetic.
//
// Layout: radial. The practitioner is the center node. Four rings of
// satellites:
//   - Energy states (top-left arc) — small circles, terracotta
//   - Past matches (top-right arc) — squares, soft terracotta
//   - Past bookings (bottom-right arc) — squares with border, accent
//   - Past notes (bottom-left arc) — small dashes, muted
//
// Edges are thin lines from center to each node. The graph is static
// (no force simulation) — deterministic layout for reproducibility.

import { useMemo } from "react";

type GraphData = {
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
};

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "practitioner" | "energy" | "match" | "booking" | "note";
  size: number;
};

type Edge = {
  from: string;
  to: string;
};

const ENERGY_LABEL: Record<string, string> = {
  low: "Low",
  settled: "Settled",
  "in-movement": "In movement",
  sharp: "Sharp",
};

export default function MemoryGraph({ data }: { data: GraphData }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Center node — the practitioner
    const cx = 200;
    const cy = 150;
    nodes.push({
      id: "practitioner",
      label: "You",
      x: cx,
      y: cy,
      type: "practitioner",
      size: 8,
    });

    // Place satellites in four quadrants
    const placeArc = (
      items: { label: string; id: string; type: Node["type"]; size: number }[],
      startAngle: number,
      endAngle: number,
      radius: number,
    ) => {
      const n = items.length;
      if (n === 0) return;
      const angleStep = n === 1 ? 0 : (endAngle - startAngle) / (n - 1);
      items.forEach((item, i) => {
        const angle = (startAngle + i * angleStep) * (Math.PI / 180);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        nodes.push({ ...item, x, y });
        edges.push({ from: "practitioner", to: item.id });
      });
    };

    // Energy states — top-left arc (180° to 270°)
    placeArc(
      data.energyHistory.map((e, i) => ({
        id: `energy-${i}`,
        label: ENERGY_LABEL[e] ?? e,
        type: "energy" as const,
        size: 5,
      })),
      195,
      255,
      95,
    );

    // Past matches — top-right arc (270° to 360°)
    placeArc(
      data.pastMatches.map((m, i) => ({
        id: `match-${i}`,
        label: m.title.length > 20 ? m.title.slice(0, 18) + "…" : m.title,
        type: "match" as const,
        size: 6,
      })),
      285,
      345,
      110,
    );

    // Past bookings — bottom-right arc (0° to 90°)
    placeArc(
      data.pastBookings.map((b, i) => ({
        id: `booking-${i}`,
        label: b.title.length > 20 ? b.title.slice(0, 18) + "…" : b.title,
        type: "booking" as const,
        size: 7,
      })),
      15,
      75,
      105,
    );

    // Past notes — bottom-left arc (90° to 180°)
    placeArc(
      data.pastNotes.map((n, i) => ({
        id: `note-${i}`,
        label: n.length > 25 ? n.slice(0, 23) + "…" : n,
        type: "note" as const,
        size: 4,
      })),
      105,
      165,
      90,
    );

    return { nodes, edges };
  }, [data]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const hasContent =
    data.energyHistory.length > 0 ||
    data.pastMatches.length > 0 ||
    data.pastBookings.length > 0 ||
    data.pastNotes.length > 0;

  if (!hasContent) return null;

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 400 300"
        className="w-full h-auto"
        role="img"
        aria-label="Mira's knowledge graph"
      >
        {/* Edges — thin lines from center to each node */}
        {edges.map((edge, i) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--accent-soft)"
              strokeWidth="0.5"
              opacity="0.4"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          if (node.type === "practitioner") {
            // The practitioner — a larger circle with a breathing glow
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size + 4}
                  fill="var(--accent)"
                  opacity="0.1"
                  className="pulse-soft"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size}
                  fill="var(--accent)"
                  opacity="0.3"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size - 2}
                  fill="var(--surface)"
                  stroke="var(--accent)"
                  strokeWidth="1"
                />
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-serif"
                  fill="var(--accent-ink)"
                  fontSize="7"
                >
                  {node.label}
                </text>
              </g>
            );
          }

          if (node.type === "energy") {
            // Energy — small filled circle
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size}
                  fill="var(--accent-soft)"
                  stroke="var(--accent)"
                  strokeWidth="0.5"
                />
                <text
                  x={node.x}
                  y={node.y + node.size + 8}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="6"
                >
                  {node.label}
                </text>
              </g>
            );
          }

          if (node.type === "match") {
            // Match — square (retreat)
            return (
              <g key={node.id}>
                <rect
                  x={node.x - node.size}
                  y={node.y - node.size}
                  width={node.size * 2}
                  height={node.size * 2}
                  rx="1"
                  fill="var(--surface)"
                  stroke="var(--accent-soft)"
                  strokeWidth="0.8"
                />
                <text
                  x={node.x}
                  y={node.y - node.size - 4}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="5.5"
                >
                  {node.label}
                </text>
              </g>
            );
          }

          if (node.type === "booking") {
            // Booking — square with accent border (committed)
            return (
              <g key={node.id}>
                <rect
                  x={node.x - node.size}
                  y={node.y - node.size}
                  width={node.size * 2}
                  height={node.size * 2}
                  rx="1"
                  fill="var(--accent)"
                  opacity="0.15"
                  stroke="var(--accent)"
                  strokeWidth="1"
                />
                <text
                  x={node.x}
                  y={node.y + node.size + 8}
                  textAnchor="middle"
                  fill="var(--accent-ink)"
                  fontSize="5.5"
                  fontWeight="500"
                >
                  {node.label}
                </text>
              </g>
            );
          }

          // Note — small dash, muted
          return (
            <g key={node.id}>
              <line
                x1={node.x - node.size}
                y1={node.y}
                x2={node.x + node.size}
                y2={node.y}
                stroke="var(--muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.6"
              />
              <text
                x={node.x}
                y={node.y + 8}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="5"
                fontStyle="italic"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        <LegendItem shape="circle" color="var(--accent-soft)" label="Energy states" />
        <LegendItem shape="square" color="var(--accent-soft)" label="Recommendations" />
        <LegendItem shape="square" color="var(--accent)" label="Bookings" filled />
        <LegendItem shape="dash" color="var(--muted)" label="Notes" />
      </div>
    </div>
  );
}

function LegendItem({
  shape,
  color,
  label,
  filled,
}: {
  shape: "circle" | "square" | "dash";
  color: string;
  label: string;
  filled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 12 12">
        {shape === "circle" && (
          <circle cx="6" cy="6" r="4" fill={filled ? color : "none"} stroke={color} strokeWidth="1" />
        )}
        {shape === "square" && (
          <rect x="2" y="2" width="8" height="8" rx="1" fill={filled ? color : "none"} stroke={color} strokeWidth="1" opacity={filled ? 0.3 : 1} />
        )}
        {shape === "dash" && (
          <line x1="2" y1="6" x2="10" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      <span className="tag text-xs opacity-70">{label}</span>
    </div>
  );
}
