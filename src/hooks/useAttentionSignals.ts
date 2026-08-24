"use client";

// Attention signals — passive detection of the user's engagement state.
// Feeds breath modulation so the orb feels aware between explicit events.
//
// Signals:
// - idle: no scroll or input focus for 5+ seconds (Mira waits with you)
// - focused: an input/textarea is focused (Mira is listening)
// - returning: tab just regained visibility (Mira noticed you came back)
//
// These modulate the breath duration multiplier and inform activity overlays
// without changing operational posture (posture comes from episodes only).

import { useCallback, useEffect, useRef, useState } from "react";

export type AttentionState = "active" | "idle" | "focused" | "returning";

/**
 * Breath multiplier derived from attention state:
 * - active: 1.0 (normal 4s breath)
 * - idle: 1.35 (slower, 5.4s — waiting with you)
 * - focused: 0.85 (quickened, 3.4s — listening)
 * - returning: 0.7 briefly (deep inhale), then normalizes
 */
export function breathMultiplier(state: AttentionState): number {
  switch (state) {
    case "idle":
      return 1.35;
    case "focused":
      return 0.85;
    case "returning":
      return 0.7;
    default:
      return 1.0;
  }
}

const IDLE_THRESHOLD_MS = 5000;
const RETURNING_DURATION_MS = 2000;

export function useAttentionSignals(): AttentionState {
  const [state, setState] = useState<AttentionState>("active");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = useRef(0);

  const resetIdle = useCallback(() => {
    lastActivity.current = performance.now();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    // If we were idle, transition back to active.
    setState((prev) => (prev === "idle" ? "active" : prev));
    idleTimer.current = setTimeout(() => {
      setState((prev) => {
        // Don't override focused or returning states.
        if (prev === "focused" || prev === "returning") return prev;
        return "idle";
      });
    }, IDLE_THRESHOLD_MS);
  }, []);

  useEffect(() => {
    // Activity signals: scroll, pointermove, keydown
    const onActivity = () => resetIdle();

    // Focus signals
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        setState("focused");
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        setState("active");
        resetIdle();
      }
    };

    // Visibility signals
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setState("returning");
        if (returningTimer.current) clearTimeout(returningTimer.current);
        returningTimer.current = setTimeout(() => {
          setState("active");
          resetIdle();
        }, RETURNING_DURATION_MS);
      }
    };

    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Start the idle timer.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializes idle detection on mount
    resetIdle();

    return () => {
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (returningTimer.current) clearTimeout(returningTimer.current);
    };
  }, [resetIdle]);

  return state;
}
