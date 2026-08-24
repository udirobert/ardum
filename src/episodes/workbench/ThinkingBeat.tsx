import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import MiraOrb from "@/components/MiraOrb";
import { reasoningBeat } from "@/agent/mira-voice";
import { DUSK_HEADING } from "@/aesthetics/dusk-theme";
import type { MatchResult } from "@/matching/types";
import type { IntentionConstraints } from "@/episodes/model";
import type { MiraPresence } from "@/agent/mira-presence";

// The thinking beat — Mira's reasoning surfaces step by step before
// the recommendation card appears. The orb is prominent (inquiry
// posture) and the reasoning lines fade in on a timed schedule from
// reasoningBeat(). This makes the recommendation feel earned, not
// instant.
//
// For `reject-recommendation`, we have the upcoming top pick (the first
// alternative) and can surface its actual reasoning. For `recommend`,
// we don't have the new top pick yet — the beat shows constraints +
// pool size only, and the full reasoning appears in the card's "how
// Mira chose this" disclosure.
export default function ThinkingBeat({
  constraints,
  poolSize,
  presence,
  upcomingPick,
  rejectedTitle,
}: {
  constraints: IntentionConstraints;
  poolSize?: number;
  presence: MiraPresence | null;
  upcomingPick?: MatchResult;
  rejectedTitle?: string;
}) {
  const steps = useMemo(() => {
    if (upcomingPick) {
      const beat = reasoningBeat(
        upcomingPick,
        undefined,
        {
          energy: constraints.energy,
          budget: constraints.budget,
          social: constraints.social,
          partySize: constraints.partySize,
          travelWindow: constraints.travelWindow,
        },
        poolSize,
      );
      if (rejectedTitle) {
        return [
          { text: `Not ${rejectedTitle}. Let me look again.`, delayMs: 0 },
          ...beat.slice(1),
        ];
      }
      return beat;
    }
    return reasoningBeat(
      undefined,
      undefined,
      {
        energy: constraints.energy,
        budget: constraints.budget,
        social: constraints.social,
        partySize: constraints.partySize,
        travelWindow: constraints.travelWindow,
      },
      poolSize,
    );
  }, [
    constraints.energy,
    constraints.budget,
    constraints.social,
    constraints.partySize,
    constraints.travelWindow,
    poolSize,
    upcomingPick,
    rejectedTitle,
  ]);

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      timers.push(
        window.setTimeout(() => setVisibleCount(i + 1), steps[i].delayMs),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [steps]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeOut" } }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0c0806]/95 backdrop-blur-sm"
      aria-live="polite"
      aria-label="Mira is thinking"
    >
      <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
        <MiraOrb
          size={120}
          presence={presence ?? undefined}
          activity="processing"
          className="flex-shrink-0"
        />
        <div className="space-y-3 min-h-[6rem]">
          {steps.slice(0, visibleCount).map((step, index) => (
            <p
              key={`reasoning-${index}`}
              className="font-serif text-lg tracking-tight leading-relaxed fade-in-up"
              style={DUSK_HEADING}
            >
              {step.text}
            </p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
