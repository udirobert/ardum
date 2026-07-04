"use client";

// MemoryGraph — a custom SVG node-edge diagram showing Mira's knowledge
// graph for this practitioner.
//
// Two modes:
//   1. REAL Cognee graph — when Cognee is configured and has processed
//      the practitioner's memory, we fetch the actual graph data from
//      GET /api/v1/datasets/{id}/graph and render the real nodes and
//      edges that Cognee extracted.
//   2. Synthetic fallback — when Cognee is not configured or the
//      dataset doesn't exist yet, we build a synthetic graph from the
//      structured MemoryContext (energy history, past matches, etc.).
//
// No charting library — hand-built SVG following the existing pattern.
// Uses the cream/terracotta palette and the contemplative aesthetic.

import { useEffect, useMemo, useState } from "react";

type SyntheticData = {
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
};

type RealGraphData = {
  nodes: { id: string; label: string; type: string; properties: Record<string, unknown> }[];
  edges: { source: string; target: string; label: string }[];
};

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "practitioner" | "energy" | "match" | "booking" | "note" | "entity";
  size: number;
};

type Edge = { from: string; to: string; label?: string };

const ENERGY_LABEL: Record<string, string> = {
  low: "Low",
  settled: "Settled",
  "in-movement": "In movement",
  sharp: "Sharp",
};

export default function MemoryGraph({ data }: { data: SyntheticData }) {
  const [realGraph, setRealGraph] = useState<RealGraphData | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(true);

  // Fetch the real Cognee graph. When it's available, we render it
  // instead of the synthetic approximation.
  useEffect(() => {
    let cancelled = false;
    async function fetchGraph() {
      try {
        // We need the userId — get it from the URL or pass it as a prop.
        // For now, use the fingerprint which is stored in localStorage.
        const { getOrCreateUserId } = await import("@/lib/fingerprint");
        const uid = getOrCreateUserId();
        if (!uid) {
          setLoadingGraph(false);
          return;
        }
        const res = await fetch(
          `/api/memory/graph?userId=${encodeURIComponent(uid)}`,
        );
        if (!res.ok) {
          setLoadingGraph(false);
          return;
        }
        const json = await res.json();
        if (!cancelled && json.graph) {
          setRealGraph(json.graph);
        }
      } catch {
        // Best-effort — fall back to synthetic graph.
      } finally {
        if (!cancelled) setLoadingGraph(false);
      }
    }
    fetchGraph();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the node layout. When we have real Cognee graph data, use it.
  // Otherwise, fall back to the synthetic radial layout.
  const { nodes, edges, isRealGraph } = useMemo(() => {
    if (realGraph && realGraph.nodes.length > 0) {
      return layoutRealGraph(realGraph);
    }
    return layoutSynthetic(data);
  }, [realGraph, data]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const hasContent =
    data.energyHistory.length > 0 ||
    data.pastMatches.length > 0 ||
    data.pastBookings.length > 0 ||
    data.pastNotes.length > 0 ||
    (realGraph && realGraph.nodes.length > 0);

  if (!hasContent && !loadingGraph) return null;

  if (loadingGraph) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <span className="tag pulse-soft">loading graph…</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isRealGraph && (
        <p className="tag mb-3 text-[color:var(--accent)]">
          live Cognee knowledge graph · {realGraph?.nodes.length ?? 0} nodes · {realGraph?.edges.length ?? 0} edges
        </p>
      )}
      <svg
        viewBox="0 0 400 300"
        className="w-full h-auto"
        role="img"
        aria-label="Mira's knowledge graph"
      >
        {/* Edges */}
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
        {nodes.map((node) => renderNode(node))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        <LegendItem shape="circle" color="var(--accent-soft)" label="Energy states" />
        <LegendItem shape="square" color="var(--accent-soft)" label="Recommendations" />
        <LegendItem shape="square" color="var(--accent)" label="Bookings" filled />
        <LegendItem shape="dash" color="var(--muted)" label="Notes" />
        {isRealGraph && (
          <LegendItem shape="circle" color="var(--accent)" label="Extracted entities" filled />
        )}
      </div>
    </div>
  );
}

// ── Layout: real Cognee graph ────────────────────────────────────────────
// Renders the actual nodes and edges from Cognee's knowledge graph.
// Uses a simple circular layout — nodes are distributed on concentric
// circles based on their type. The practitioner node (if identifiable)
// sits at the center.
function layoutRealGraph(graph: RealGraphData): {
  nodes: Node[];
  edges: Edge[];
  isRealGraph: boolean;
} {
  const cx = 200;
  const cy = 150;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Classify nodes by type to assign them to rings.
  const typedNodes = graph.nodes.map((n) => {
    const label = n.label.toLowerCase();
    let type: Node["type"] = "entity";
    if (label.includes("practitioner") || label.includes("user") || label === "you") {
      type = "practitioner";
    } else if (["low", "settled", "in-movement", "sharp", "energy"].some((e) => label.includes(e))) {
      type = "energy";
    } else if (label.includes("retreat") || label.includes("match") || label.includes("recommend")) {
      type = "match";
    } else if (label.includes("book") || label.includes("deposit")) {
      type = "booking";
    } else if (label.includes("note") || label.includes("feedback")) {
      type = "note";
    }
    return { ...n, nodeType: type };
  });

  // Center node — the practitioner (or the first node if none matches).
  const practitioner = typedNodes.find((n) => n.nodeType === "practitioner");
  const centerNode = practitioner ?? typedNodes[0];

  if (centerNode) {
    nodes.push({
      id: centerNode.id,
      label: centerNode.label.slice(0, 20),
      x: cx,
      y: cy,
      type: "practitioner",
      size: 8,
    });
  }

  // Place remaining nodes on concentric rings by type.
  const ringRadius: Record<Node["type"], number> = {
    practitioner: 0,
    energy: 70,
    match: 100,
    booking: 110,
    note: 85,
    entity: 130,
  };

  const byType: Record<string, typeof typedNodes> = {};
  for (const n of typedNodes) {
    if (n.id === centerNode?.id) continue;
    const arr = byType[n.nodeType] ?? [];
    arr.push(n);
    byType[n.nodeType] = arr;
  }

  for (const [type, items] of Object.entries(byType)) {
    const radius = ringRadius[type as Node["type"]] ?? 120;
    const n = items.length;
    items.forEach((item, i) => {
      const angle = (i / Math.max(1, n)) * Math.PI * 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      nodes.push({
        id: item.id,
        label: item.label.slice(0, 18),
        x,
        y,
        type: item.nodeType,
        size: item.nodeType === "entity" ? 4 : 5,
      });
    });
  }

  // Map edges from Cognee's source/target IDs to our node IDs.
  for (const e of graph.edges) {
    edges.push({ from: e.source, to: e.target, label: e.label });
  }

  return { nodes, edges, isRealGraph: true };
}

// ── Layout: synthetic fallback ───────────────────────────────────────────
function layoutSynthetic(data: SyntheticData): {
  nodes: Node[];
  edges: Edge[];
  isRealGraph: boolean;
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

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

  placeArc(
    data.energyHistory.map((e, i) => ({
      id: `energy-${i}`,
      label: ENERGY_LABEL[e] ?? e,
      type: "energy" as const,
      size: 5,
    })),
    195, 255, 95,
  );
  placeArc(
    data.pastMatches.map((m, i) => ({
      id: `match-${i}`,
      label: m.title.length > 20 ? m.title.slice(0, 18) + "…" : m.title,
      type: "match" as const,
      size: 6,
    })),
    285, 345, 110,
  );
  placeArc(
    data.pastBookings.map((b, i) => ({
      id: `booking-${i}`,
      label: b.title.length > 20 ? b.title.slice(0, 18) + "…" : b.title,
      type: "booking" as const,
      size: 7,
    })),
    15, 75, 105,
  );
  placeArc(
    data.pastNotes.map((n, i) => ({
      id: `note-${i}`,
      label: n.length > 25 ? n.slice(0, 23) + "…" : n,
      type: "note" as const,
      size: 4,
    })),
    105, 165, 90,
  );

  return { nodes, edges, isRealGraph: false };
}

// ── Node rendering ───────────────────────────────────────────────────────
function renderNode(node: Node) {
  if (node.type === "practitioner") {
    return (
      <g key={node.id}>
        <circle cx={node.x} cy={node.y} r={node.size + 4} fill="var(--accent)" opacity="0.1" className="pulse-soft" />
        <circle cx={node.x} cy={node.y} r={node.size} fill="var(--accent)" opacity="0.3" />
        <circle cx={node.x} cy={node.y} r={node.size - 2} fill="var(--surface)" stroke="var(--accent)" strokeWidth="1" />
        <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" className="font-serif" fill="var(--accent-ink)" fontSize="7">
          {node.label}
        </text>
      </g>
    );
  }
  if (node.type === "energy") {
    return (
      <g key={node.id}>
        <circle cx={node.x} cy={node.y} r={node.size} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="0.5" />
        <text x={node.x} y={node.y + node.size + 8} textAnchor="middle" fill="var(--muted)" fontSize="6">
          {node.label}
        </text>
      </g>
    );
  }
  if (node.type === "match") {
    return (
      <g key={node.id}>
        <rect x={node.x - node.size} y={node.y - node.size} width={node.size * 2} height={node.size * 2} rx="1" fill="var(--surface)" stroke="var(--accent-soft)" strokeWidth="0.8" />
        <text x={node.x} y={node.y - node.size - 4} textAnchor="middle" fill="var(--muted)" fontSize="5.5">
          {node.label}
        </text>
      </g>
    );
  }
  if (node.type === "booking") {
    return (
      <g key={node.id}>
        <rect x={node.x - node.size} y={node.y - node.size} width={node.size * 2} height={node.size * 2} rx="1" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" strokeWidth="1" />
        <text x={node.x} y={node.y + node.size + 8} textAnchor="middle" fill="var(--accent-ink)" fontSize="5.5" fontWeight="500">
          {node.label}
        </text>
      </g>
    );
  }
  if (node.type === "entity") {
    // Extracted entity from the real Cognee graph — small filled circle
    return (
      <g key={node.id}>
        <circle cx={node.x} cy={node.y} r={node.size} fill="var(--accent)" opacity="0.5" stroke="var(--accent)" strokeWidth="0.5" />
        <text x={node.x} y={node.y + node.size + 7} textAnchor="middle" fill="var(--muted)" fontSize="5">
          {node.label}
        </text>
      </g>
    );
  }
  // Note — small dash, muted
  return (
    <g key={node.id}>
      <line x1={node.x - node.size} y1={node.y} x2={node.x + node.size} y2={node.y} stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <text x={node.x} y={node.y + 8} textAnchor="middle" fill="var(--muted)" fontSize="5" fontStyle="italic">
        {node.label}
      </text>
    </g>
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
