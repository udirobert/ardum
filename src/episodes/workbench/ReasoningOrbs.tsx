"use client";

// ReasoningOrbs — the match's reasoning axes visualized as small blobs
// orbiting an inline Mira orb. Each reasoning axis (energy, social, budget,
// …) becomes a blob whose proximity to the core represents its weight:
// high weight = close and merged; low weight = distant and separate.
//
// This makes the recommendation's structure legible at a glance — the
// practitioner can see *how* Mira chose, not just read it. Inspired by the
// raymarching-tsl SDF metaball technique: blobs that orbit, merge, and
// separate in a continuous field.
//
// Accessibility: the blobs are aria-hidden decoration. The text reasoning
// remains available in the collapsed <details> below. This is a visual
// layer, not a replacement for the text.

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { ReasoningStep } from "@/matching/types";

type Props = {
  reasoning: ReasoningStep[];
  /** Inline orb size — the blobs orbit within this box. */
  size?: number;
};

export default function ReasoningOrbs({ reasoning, size = 48 }: Props) {
  const reduced = useReducedMotion();

  // Sort by weight descending so the strongest axis is innermost.
  const sorted = [...reasoning].sort((a, b) => b.weight - a.weight);

  // Each axis gets an orbit radius derived from its weight: high weight =
  // close to core (0.15), low weight = distant (0.48).
  const orbitRadius = (weight: number) =>
    0.48 - weight * 0.33;

  // Blob size scales with weight: strong axes are larger.
  const blobSize = (weight: number) => 3 + weight * 5;

  return (
    <div
      aria-hidden="true"
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Core — a faint warm circle representing the orb center. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(168,90,58,0.25), transparent 65%)",
        }}
      />
      {/* Orbiting blobs — each reasoning axis. */}
      {sorted.map((step, i) => {
        const r = orbitRadius(step.weight) * size;
        const blobR = blobSize(step.weight);
        // Distribute around the circle evenly.
        const angle = (i / sorted.length) * Math.PI * 2;
        const cx = size / 2 + Math.cos(angle) * r;
        const cy = size / 2 + Math.sin(angle) * r;

        return (
          <motion.div
            key={step.axis}
            className="absolute rounded-full"
            style={{
              width: blobR * 2,
              height: blobR * 2,
              left: cx - blobR,
              top: cy - blobR,
              background: `radial-gradient(circle, rgba(216,168,146,${0.3 + step.weight * 0.4}) 0%, rgba(168,90,58,${0.15 + step.weight * 0.25}) 60%, transparent 100%)`,
            }}
            animate={
              reduced
                ? undefined
                : {
                    // Slow orbit: each blob drifts around the core.
                    x: [
                      Math.cos(angle) * 2,
                      Math.cos(angle + 0.5) * 2,
                      Math.cos(angle) * 2,
                    ],
                    y: [
                      Math.sin(angle) * 2,
                      Math.sin(angle + 0.5) * 2,
                      Math.sin(angle) * 2,
                    ],
                  }
            }
            transition={{
              duration: 6 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}
