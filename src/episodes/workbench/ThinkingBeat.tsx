import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MiraOrb from "@/components/MiraOrb";
import { reasoningBeat } from "@/agent/mira-voice";
import { DUSK_HEADING } from "@/aesthetics/dusk-theme";
import type { MatchResult } from "@/matching/types";
import type { IntentionConstraints } from "@/episodes/model";
import type { MiraPresence } from "@/agent/mira-presence";

// The thinking beat — Mira's reasoning surfaces in-flow before the
// recommendation card. Two phases:
//
//   Working  — orb (processing) + quiet label + progressive reasoning
//             lines from reasoningBeat(). The "looking" beat from the
//             design target: the breath between intention and card.
//             The card is hidden during this phase.
//
//   Settled  — collapses to "thought for Ns" with an expandable trace.
//             Reasoning stays available without competing with the
//             decision (experience-layer contract). The card appears
//             below the collapsed trace.
//
// The parent remounts this component on each new beat (key change), so
// each beat starts with fresh state — no reset effect needed. The
// component stays mounted across the thinking→settled transition.
export default function ThinkingBeat({
  thinking,
  constraints,
  poolSize,
  presence,
  upcomingPick,
  rejectedTitle,
}: {
  thinking: boolean;
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
  const [expanded, setExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  // Capture mount time for elapsed calculation. The parent remounts
  // this component on each new beat (key change), so this runs once
  // per beat.
  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  // Progressive line reveal during the working phase.
  useEffect(() => {
    if (!thinking) return;
    const timers: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      timers.push(
        window.setTimeout(() => setVisibleCount(i + 1), steps[i].delayMs),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [steps, thinking]);

  // When thinking ends, capture elapsed time and collapse the trace.
  // Both setState calls are inside the timeout callback (asynchronous),
  // so they don't trigger cascading renders from the effect itself.
  useEffect(() => {
    if (thinking) return;
    const timer = setTimeout(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
      setExpanded(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [thinking]);

  return (
    <div className="mb-6">
      <AnimatePresence mode="wait">
        {!thinking ? (
          // ── Settled: collapsed expandable trace ──
          // Quiet, above the card. Expands to show the narrative
          // reasoning. Does not compete with the primary decision.
          <motion.div
            key="settled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors duration-200"
            >
              <MiraOrb
                size={20}
                presence={presence ?? undefined}
                className="flex-shrink-0"
              />
              <span className="tag">
                thought for{" "}
                {elapsed < 1 ? "a moment" : `${Math.round(elapsed)}s`}
              </span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-300"
                style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300"
              style={{
                gridTemplateRows: expanded ? "1fr" : "0fr",
                transitionTimingFunction: "var(--ease-ardum)",
              }}
            >
              <div className="overflow-hidden">
                <div className="mt-3 space-y-2 pl-7">
                  {steps.map((step, index) => (
                    <p
                      key={`trace-${index}`}
                      className="font-serif text-base leading-relaxed text-[color:var(--muted)]"
                      style={DUSK_HEADING}
                    >
                      {step.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // ── Working: in-flow beat with progressive reasoning ──
          // The "looking" phase. Orb is prominent (processing activity),
          // reasoning lines fade in on the reasoningBeat() schedule.
          <motion.div
            key="working"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            className="flex flex-col items-start gap-5"
            aria-live="polite"
            aria-label="Mira is thinking"
          >
            <div className="flex items-center gap-3">
              <MiraOrb
                size={48}
                presence={presence ?? undefined}
                activity="processing"
                className="flex-shrink-0"
              />
              <span className="tag pulse-soft">looking at what fits…</span>
            </div>
            <div className="space-y-3 min-h-[6rem]">
              {steps.slice(0, visibleCount).map((step, index) => (
                <motion.p
                  key={`reasoning-${index}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="font-serif text-lg tracking-tight leading-relaxed text-[color:var(--foreground)]"
                  style={DUSK_HEADING}
                >
                  {step.text}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
