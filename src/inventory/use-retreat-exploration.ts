"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  buildRecommendation,
  generateAlternativeReason,
  generateRecommendationLetter,
  type Recommendation,
} from "@/agent/retreat-response";
import { extractConstraints } from "@/agent/conversation-extractor";
import { mergeConstraints, type IntentionConstraints } from "@/agent/constraint-updater";

/**
 * Episode workbench state machine for the recommendation reveal flow.
 *
 * Beats (see docs/design/recommendation-reveal.md and
 * refinement-alternatives.md):
 *   looking     — Beat 1: Mira is ranking, orb only, no card
 *   arriving    — Beat 2 reveal: image emerging from orb, card rising
 *   settled     — Beat 2 steady: decision card with one CTA
 *   listening   — Beat 3: alternatives overlay open, voice lane active
 *   processing  — re-rank in progress (within any beat)
 *   committing  — Beat 4: hold transition running
 *
 * One primary decision per state. The hook never exposes a plural
 * "retreats" list — Mira presents one recommendation; alternatives are a
 * summoned branch.
 */

export type ExplorationState =
  | "looking"
  | "arriving"
  | "settled"
  | "listening"
  | "processing"
  | "committing";

export interface RetreatExploration {
  state: ExplorationState;
  recommendation: Recommendation | null;
  /** Retreats the practitioner has rejected this episode. */
  rejectedIds: string[];
  /** Constraints accumulated from voice-lane refinement. */
  constraints: IntentionConstraints;
  /** Most recent voice-lane extraction failure (for in-lane nudge copy). */
  voiceLaneNudge: string | null;
  /** Open the Beat 3 alternatives overlay. */
  openAlternatives: () => void;
  /** Close Beat 3 and return to Beat 2 without changing the top pick. */
  closeAlternatives: () => void;
  /** Elevate an alternative to the new top pick (Beat 3 → Beat 2). */
  elevate: (retreatId: string) => void;
  /** Reject an alternative (Beat 3 feedback that re-enters clarity). */
  rejectAlternative: (retreatId: string) => void;
  /** Submit free-text refinement in the Beat 3 voice lane. */
  onVoiceMessage: (text: string) => Promise<void>;
  /** Begin the hold ceremony for the current top pick (Beat 2 → Beat 4). */
  onCommit: (retreatId: string) => void;
  /** Clear the committing state once the transition completes. */
  onCommitComplete: () => void;
}

const REVEAL_DURATION_MS = 900;
const RERANK_REVEAL_DURATION_MS = 1200;
const LOOKING_DURATION_MS = 700;

export function useRetreatExploration(
  initialConstraints?: IntentionConstraints,
  onConstraintChange?: (constraints: IntentionConstraints) => void
): RetreatExploration {
  const [state, setState] = useState<ExplorationState>("looking");
  const [constraints, setConstraints] = useState<IntentionConstraints>(
    initialConstraints || {}
  );
  // Compute the initial recommendation lazily so the first render already
  // has it — no setState-in-effect needed for the recommendation itself.
  const [recommendation, setRecommendation] = useState<Recommendation | null>(() =>
    buildRecommendation(initialConstraints || {})
  );
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [voiceLaneNudge, setVoiceLaneNudge] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);

  // Clear any pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  // Initial load timing: looking → arriving → settled. The recommendation
  // is already computed in the useState initializer above; this effect
  // only schedules timer-driven state advances, no synchronous setState
  // in the effect body.
  useEffect(() => {
    if (!recommendation) return;
    scheduleTimer(() => setState("arriving"), LOOKING_DURATION_MS);
    scheduleTimer(
      () => setState("settled"),
      LOOKING_DURATION_MS + REVEAL_DURATION_MS
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAlternatives = useCallback(() => {
    setVoiceLaneNudge(null);
    setState("listening");
  }, []);

  const closeAlternatives = useCallback(() => {
    setVoiceLaneNudge(null);
    setState("settled");
  }, []);

  const elevate = useCallback(
    (retreatId: string) => {
      if (!recommendation) return;
      const elevated = recommendation.alternatives.find(
        (a) => a.retreat.id === retreatId
      );
      if (!elevated) return;

      const newTop = elevated.retreat;
      // The old top becomes an alternative; the remaining alternatives
      // stay, minus the elevated one. All reasons regenerate against the
      // new top pick so differentiations stay correct.
      const remaining = [
        recommendation.retreat,
        ...recommendation.alternatives
          .filter((a) => a.retreat.id !== retreatId)
          .map((a) => a.retreat),
      ].filter((r) => !rejectedIds.includes(r.id));

      const newAlternatives = remaining.slice(0, 4).map((r) => ({
        retreat: r,
        reason: generateAlternativeReason(r, newTop),
      }));

      const letter = generateRecommendationLetter(newTop, constraints);

      setRecommendation({
        retreat: newTop,
        letter,
        alternatives: newAlternatives,
      });
      setVoiceLaneNudge(null);
      setState("arriving");
      scheduleTimer(() => setState("settled"), RERANK_REVEAL_DURATION_MS);
    },
    [recommendation, rejectedIds, constraints, scheduleTimer]
  );

  const rejectAlternative = useCallback(
    (retreatId: string) => {
      if (!recommendation) return;
      setRejectedIds((prev) =>
        prev.includes(retreatId) ? prev : [...prev, retreatId]
      );
      const remaining = recommendation.alternatives.filter(
        (a) => a.retreat.id !== retreatId
      );
      setRecommendation({
        ...recommendation,
        alternatives: remaining,
      });
      // If the alternatives set drops below 1, close Beat 3 back to Beat 2
      // with the surviving top pick.
      if (remaining.length < 1) {
        setVoiceLaneNudge(null);
        setState("settled");
      }
    },
    [recommendation]
  );

  const onVoiceMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setState("processing");
      setVoiceLaneNudge(null);

      const extracted = extractConstraints(text);
      if (Object.keys(extracted).length === 0) {
        // Extraction failure: stay in listening, surface a specific nudge
        // rather than generic "I'd love to understand better."
        setVoiceLaneNudge(buildVoiceLaneNudge(constraints));
        setState("listening");
        return;
      }

      const merged = mergeConstraints(constraints, extracted);
      setConstraints(merged);
      onConstraintChange?.(merged);

      // Re-rank against merged constraints.
      const rec = buildRecommendation(merged, extracted);
      setRecommendation(rec);
      setVoiceLaneNudge(null);

      if (!rec) {
        setState("listening");
        return;
      }
      // Stay in Beat 3 (listening) so the user can react to the new set.
      setState("listening");
    },
    [constraints, onConstraintChange]
  );

  const onCommit = useCallback(
    (retreatId: string) => {
      if (!recommendation || recommendation.retreat.id !== retreatId) return;
      setState("committing");
    },
    [recommendation]
  );

  const onCommitComplete = useCallback(() => {
    setState("settled");
  }, []);

  return {
    state,
    recommendation,
    rejectedIds,
    constraints,
    voiceLaneNudge,
    openAlternatives,
    closeAlternatives,
    elevate,
    rejectAlternative,
    onVoiceMessage,
    onCommit,
    onCommitComplete,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Build a specific voice-lane nudge when extraction fails.
 * Names dimensions that are still open in the episode, rather than a
 * generic "I'd love to understand better."
 */
function buildVoiceLaneNudge(constraints: IntentionConstraints): string {
  const open: string[] = [];
  if (!constraints.budget) open.push("cost");
  if (!constraints.duration) open.push("length");
  if (!constraints.social) open.push("whether you want solitude or company");
  if (!constraints.horizon && !constraints.dates) open.push("timing");

  if (open.length === 0) {
    return "Tell me more about what feels off — the place, the practice, or the feel of it?";
  }
  if (open.length === 1) {
    return `Tell me about ${open[0]} — that's still open for me.`;
  }
  if (open.length === 2) {
    return `Two things are still open for me: ${open[0]} and ${open[1]}. Which one matters more right now?`;
  }
  return `A few things are still open — ${open.slice(0, 3).join(", ")}. Which one is most on your mind?`;
}
