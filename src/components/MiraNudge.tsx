"use client";

// MiraNudge — the card that emerges from the orb when the practitioner
// presses and holds. One insight at a time, drawn from nudgeForEpisode.
//
// The card positions itself at the orb's lower-right edge — the natural
// "whisper" position, where Mira leans toward the practitioner. It
// animates in with a soft scale+opacity emergence (the gooey filter is
// too heavy for a quick nudge; this is a whisper, not a birth). On
// release it fades out and the gesture fires a nudge impulse.
//
// Accessibility: the card is aria-live="polite" so screen readers
// announce the nudge when it appears. The orb itself stays aria-hidden;
// the card is the accessible surface.

import { useEffect, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Nudge } from "@/agent/mira-voice";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  nudge: Nudge | null;
  /** When true, the card is visible (press-and-hold active). */
  visible: boolean;
};

export default function MiraNudge({ nudge, visible }: Props) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the card when it appears so keyboard users can read it.
  useEffect(() => {
    if (visible && nudge && cardRef.current) {
      cardRef.current.focus();
    }
  }, [visible, nudge]);

  const show = visible && nudge !== null;

  const cardStyle: CSSProperties = {
    // Position at the orb's lower-right — the whisper position.
    // The orb fills the field; this card sits at ~60% right, ~60% down,
    // biased toward where the practitioner's thumb reaches on mobile.
    position: "absolute",
    right: "8%",
    bottom: "18%",
    maxWidth: "min(320px, 80vw)",
    zIndex: 20,
  };

  const innerStyle: CSSProperties = {
    background: "rgba(18, 12, 9, 0.82)",
    backdropFilter: "blur(16px) saturate(1.2)",
    WebkitBackdropFilter: "blur(16px) saturate(1.2)",
    border: "1px solid rgba(216, 168, 146, 0.2)",
    borderRadius: "14px",
    padding: "16px 20px",
    boxShadow: [
      "0 10px 44px rgba(0, 0, 0, 0.4)",
      "inset 0 1px 0 rgba(216, 168, 146, 0.12)",
    ].join(", "),
  };

  return (
    <div style={cardStyle}>
      <AnimatePresence>
        {show && nudge && (
          <motion.div
            ref={cardRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-label={`Mira says: ${nudge.text}`}
            style={innerStyle}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
            transition={{
              duration: reduced ? 0.01 : 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#f6efe3",
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "0.9375rem",
                lineHeight: 1.55,
                letterSpacing: "0.01em",
              }}
            >
              {nudge.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
