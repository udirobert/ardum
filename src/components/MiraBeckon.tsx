"use client";

// MiraBeckon — the one-time teaching moment for the nudge gesture.
//
// On a first visit, after the orb has settled, a single warm ring expands
// outward from the orb's center and a one-line whisper fades in below:
// "Hold for a note." The ring completes slow expansions; the whisper
// stays until the practitioner either holds (they learned it — the nudge
// card appears) or 8s pass (timeout — they saw it, just didn't act).
// Either way the gesture is marked seen and this never repeats.
//
// Design: this is not a notification or a tutorial overlay. It's Mira
// herself beckoning — the ring grows from her own light, the whisper
// sits in the same serif type as the nudge card. It speaks once, then
// goes quiet, respecting the companion-not-marketplace contract.

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hasSeenNudgeGesture, markNudgeGestureSeen } from "@/lib/nudge-teach";

type Props = {
  /** When true, the practitioner is actively pressing the orb — dismiss. */
  pressing: boolean;
  /** When true, the nudge card is visible — they learned it — dismiss. */
  nudgeVisible: boolean;
};

const BECKON_TIMEOUT_MS = 8000;

// useSyncExternalStore subscribe + getSnapshot. The subscribe is a no-op
// (we never need to re-render on storage change mid-session); the server
// snapshot is `true` (already seen) so nothing renders during SSR, avoiding
// hydration mismatch. After mount the client snapshot reflects the real
// localStorage value.
const emptySubscribe = () => () => {};

export default function MiraBeckon({ pressing, nudgeVisible }: Props) {
  const reduced = useReducedMotion();
  const alreadySeen = useSyncExternalStore(
    emptySubscribe,
    () => hasSeenNudgeGesture(),
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  const show = !alreadySeen && !dismissed;

  // Auto-dismiss after the timeout — they had their chance. The setState
  // runs in an async timeout callback, not synchronously in the effect
  // body, so it doesn't trigger cascading renders.
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => setDismissed(true), BECKON_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [show]);

  // Dismiss when the practitioner engages the gesture or the card appears.
  // Deferred to a rAF callback to avoid synchronous setState in the effect.
  useEffect(() => {
    if ((pressing || nudgeVisible) && show && !dismissed) {
      requestAnimationFrame(() => setDismissed(true));
    }
  }, [pressing, nudgeVisible, show, dismissed]);

  return (
    <AnimatePresence
      onExitComplete={() => {
        // Mark seen once the beckon fully leaves — covers both timeout
        // and engagement dismissal.
        if (dismissed) markNudgeGestureSeen();
      }}
    >
      {show && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 4,
            width: "min(36vw, 36vh)",
            height: "min(36vw, 36vh)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {/* The expanding ring — slow pulses from the orb's light. */}
          {!reduced && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1.4, opacity: [0, 0.5, 0] }}
              transition={{
                duration: 2.4,
                ease: [0.16, 1, 0.3, 1],
                repeat: Infinity,
                repeatDelay: 0.8,
              }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1.5px solid rgba(216, 168, 146, 0.4)",
              }}
            />
          )}

          {/* Reduced motion: a static faint ring instead of expanding. */}
          {reduced && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1.5px solid rgba(216, 168, 146, 0.25)",
              }}
            />
          )}

          {/* The whisper — one line in the nudge card's serif register. */}
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={reduced ? { opacity: 0.8 } : { opacity: 0.8, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              bottom: "-2.5rem",
              color: "rgba(246, 239, 227, 0.7)",
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "0.8125rem",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            Hold for a note
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
