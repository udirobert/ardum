"use client";

// CommitmentArc — a trigonometric arc slider for the hold → commit gesture.
// Inspired by the CSS flight slider (Álvaro Montoro): sin(π × val / 100)
// creates parabolic arcs from a linear <input type="range">, giving physical
// lift, shadow depth, and scale without JS animation.
//
// The slider fills with the terracotta accent as the user drags. At 100%,
// it fires the onCommit callback. The thumb lifts at the midpoint (highest
// "weight" of the decision) and settles at the end. At 80%, a haptic
// threshold signals "point of no return" with a scale bump.
//
// Accessible: native <input type="range"> with aria-label.
// Reduced motion: trig-derived transforms zeroed, standard range renders.

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  /** Label text shown at the start (left) of the slider. */
  labelStart?: string;
  /** Label text shown at the end (right) of the slider. */
  labelEnd?: string;
  /** Accessible label for the range input. */
  ariaLabel?: string;
  /** Called when the slider reaches 100% and commitment triggers. */
  onCommit: () => void;
  /** Called at the threshold (80%) — optional haptic/visual feedback. */
  onThreshold?: () => void;
  /** Whether the slider is disabled (e.g. during processing). */
  disabled?: boolean;
  /** The amount being committed — shown on the thumb at threshold. */
  amount?: string;
  /** Extra className for the outer container. */
  className?: string;
};

export default function CommitmentArc({
  labelStart = "Hold",
  labelEnd = "Secure my place",
  ariaLabel = "Commitment — drag to confirm",
  onCommit,
  onThreshold,
  disabled = false,
  amount,
  className = "",
}: Props) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);
  const [committed, setCommitted] = useState(false);
  const thresholdFired = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || committed) return;
      const v = Number(e.target.value);

      // Direct DOM update for sub-frame visual latency — bypasses React
      // render cycle so the thumb feels physically attached to the finger.
      const el = wrapperRef.current;
      if (el) {
        el.style.setProperty("--val", String(v));
        if (!reduced) {
          el.style.setProperty("--arc", `calc(sin(3.14159 * ${v} / 100))`);
        }
      }

      // React state for logic (threshold, commit, spring-back).
      setVal(v);

      // Threshold feedback at 80%
      if (v >= 80 && !thresholdFired.current) {
        thresholdFired.current = true;
        onThreshold?.();
      }
      if (v < 80) {
        thresholdFired.current = false;
      }

      // Commit at 100%
      if (v >= 100) {
        setCommitted(true);
        onCommit();
      }
    },
    [disabled, committed, onCommit, onThreshold, reduced],
  );

  // If the user releases before 100%, spring back to 0 with a smooth tween.
  const springRef = useRef(0);
  const handleRelease = useCallback(() => {
    if (committed || disabled) return;
    if (val < 100) {
      thresholdFired.current = false;
      // Animate from current val to 0 over ~400ms with ease-out
      const startVal = val;
      const startTime = performance.now();
      const duration = 400;

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Cubic ease-out: 1 - (1-t)^3
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(startVal * (1 - eased));
        // Direct DOM for visual, React state for logic sync at end.
        const el = wrapperRef.current;
        if (el) {
          el.style.setProperty("--val", String(current));
          if (!reduced) {
            el.style.setProperty("--arc", `calc(sin(3.14159 * ${current} / 100))`);
          }
        }
        if (t < 1) {
          springRef.current = requestAnimationFrame(tick);
        } else {
          setVal(0);
        }
      };
      springRef.current = requestAnimationFrame(tick);
    }
  }, [val, committed, disabled, reduced]);

  const cssVars = {
    "--val": val,
    "--arc": reduced ? 0 : `calc(sin(3.14159 * ${val} / 100))`,
  } as CSSProperties;

  return (
    <div ref={wrapperRef} className={`commitment-arc ${className}`} style={cssVars}>
      <div className="commitment-arc__labels">
        <span className="commitment-arc__label commitment-arc__label--start">
          {labelStart}
        </span>
        <span className="commitment-arc__label commitment-arc__label--end">
          {labelEnd}
        </span>
      </div>

      <div className="commitment-arc__track-wrapper">
        <input
          type="range"
          className="commitment-arc__input"
          min="0"
          max="100"
          value={val}
          disabled={disabled || committed}
          aria-label={ariaLabel}
          aria-valuetext={
            committed
              ? "Committed"
              : val >= 80
                ? `Almost there — ${val}%`
                : `${val}%`
          }
          onChange={handleInput}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          onPointerUp={handleRelease}
        />

        {/* Threshold marker — subtle notch at 80% */}
        <div
          className="commitment-arc__threshold"
          aria-hidden="true"
        />

        {/* Amount badge — appears at threshold */}
        {amount && val >= 70 && !committed && (
          <div
            className="commitment-arc__amount"
            aria-hidden="true"
            style={{
              opacity: Math.min(1, (val - 70) / 10),
            }}
          >
            {amount}
          </div>
        )}
      </div>

      {committed && (
        <p className="commitment-arc__confirmed" aria-live="assertive">
          Confirmed
        </p>
      )}
    </div>
  );
}
