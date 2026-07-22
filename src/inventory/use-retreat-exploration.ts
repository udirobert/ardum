"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Recommendation } from "@/agent/retreat-response";

/**
 * Presentation-only beat timing for the recommendation reveal flow.
 *
 * Domain state (recommendation, hold, constraints) lives in the episode
 * repository. This hook only drives Beat 1→2 animation timing.
 */

export type ExplorationState =
  | "looking"
  | "arriving"
  | "settled"
  | "listening"
  | "processing"
  | "committing";

export interface RevealPresentation {
  state: ExplorationState;
  openAlternatives: () => void;
  closeAlternatives: () => void;
  beginHoldCeremony: () => void;
  endHoldCeremony: () => void;
  setProcessing: (active: boolean) => void;
  replaySettle: () => void;
}

const REVEAL_DURATION_MS = 900;
const RERANK_REVEAL_DURATION_MS = 1200;
const LOOKING_DURATION_MS = 700;

export function useRevealPresentation(
  recommendation: Recommendation | null,
  options?: { skipLookingBeat?: boolean },
): RevealPresentation {
  const skipLooking = options?.skipLookingBeat ?? false;
  const recommendationKey = recommendation?.retreat.id ?? null;

  const beatStateForRecommendation = (): ExplorationState => {
    if (!recommendation) return "looking";
    return skipLooking ? "settled" : "looking";
  };

  const [trackedKey, setTrackedKey] = useState(recommendationKey);
  const [state, setState] = useState<ExplorationState>(beatStateForRecommendation);
  const timersRef = useRef<number[]>([]);

  if (trackedKey !== recommendationKey) {
    setTrackedKey(recommendationKey);
    setState(beatStateForRecommendation());
  }

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

  // Reveal timing: looking → arriving → settled.
  useEffect(() => {
    if (!recommendation || skipLooking) return;
    scheduleTimer(() => setState("arriving"), LOOKING_DURATION_MS);
    scheduleTimer(
      () => setState("settled"),
      LOOKING_DURATION_MS + REVEAL_DURATION_MS,
    );
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [recommendationKey, skipLooking, recommendation, scheduleTimer]);

  const replaySettle = useCallback(() => {
    setState("arriving");
    scheduleTimer(() => setState("settled"), RERANK_REVEAL_DURATION_MS);
  }, [scheduleTimer]);

  const openAlternatives = useCallback(() => {
    setState("listening");
  }, []);

  const closeAlternatives = useCallback(() => {
    setState("settled");
  }, []);

  const beginHoldCeremony = useCallback(() => {
    setState("committing");
  }, []);

  const endHoldCeremony = useCallback(() => {
    setState("settled");
  }, []);

  const setProcessing = useCallback((active: boolean) => {
    setState(active ? "processing" : "listening");
  }, []);

  return {
    state,
    openAlternatives,
    closeAlternatives,
    beginHoldCeremony,
    endHoldCeremony,
    setProcessing,
    replaySettle,
  };
}

/** @deprecated Use useRevealPresentation — domain logic belongs in episode commands. */
export type RetreatExploration = RevealPresentation & {
  recommendation: Recommendation | null;
  rejectedIds: string[];
  constraints: Record<string, never>;
  voiceLaneNudge: string | null;
  elevate: (retreatId: string) => void;
  rejectAlternative: (retreatId: string) => void;
  onVoiceMessage: (text: string) => Promise<void>;
  onCommit: (retreatId: string) => void;
  onCommitComplete: () => void;
};
