"use client";

// Gooey emergence — wraps content in an SVG filter that makes elements
// appear to detach from a source point with viscous fluid behavior.
// Inspired by github.com/oguzhantufenk/gooey-search (SVG feGaussianBlur +
// feColorMatrix contrast bump → shapes merge/divide like liquid).
//
// Usage:
//   <GooeyEmergence active={isEmerging} blur={12} contrast={20}>
//     <div className="origin-element" />  {/* the orb proxy / source */}
//     <div className="emerging-card" />   {/* animates outward */}
//   </GooeyEmergence>
//
// The filter is applied while `active` is true. Once elements settle,
// pass `active={false}` to remove the filter and restore text crispness.
// Reduced motion: filter is never applied; children render with simple
// opacity transition.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  children: ReactNode;
  /** Whether the gooey filter is currently active. */
  active: boolean;
  /** Gaussian blur radius — controls the "blob radius" of the merge. */
  blur?: number;
  /** Color matrix contrast multiplier — higher = sharper goo edges.
   *  The formula is: contrast on alpha channel, offset to re-center.
   *  Default 20 with offset -9 gives a thick, visible goo. */
  contrast?: number;
  /** Duration in ms before auto-disabling the filter (text crispness). */
  settleMs?: number;
  /** Extra className on the wrapper. */
  className?: string;
  /** Extra inline styles on the wrapper. */
  style?: CSSProperties;
  /** aria-live region for accessibility. */
  ariaLive?: "polite" | "assertive" | "off";
};

export default function GooeyEmergence({
  children,
  active,
  blur = 12,
  contrast = 20,
  settleMs = 600,
  className = "",
  style,
  ariaLive = "polite",
}: Props) {
  const reduced = useReducedMotion();
  const filterId = useId();
  const safeId = filterId.replace(/:/g, "-");
  const [filterActive, setFilterActive] = useState(active);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When `active` flips on, enable the filter immediately.
  // When it flips off, keep the filter for `settleMs` so the final
  // frames of the spring still get the gooey treatment, then remove.
  useEffect(() => {
    if (active) {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs external `active` prop to internal filter state
      setFilterActive(true);
    } else {
      settleTimer.current = setTimeout(() => {
        setFilterActive(false);
      }, settleMs);
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [active, settleMs]);

  // The contrast offset is calculated so the matrix keeps alpha centered:
  // alpha_out = alpha_in * contrast + offset
  // We want alpha = 0.5 to map to 0.5: 0.5 * contrast + offset = 0.5
  // → offset = 0.5 - 0.5 * contrast = 0.5 * (1 - contrast)
  const offset = 0.5 * (1 - contrast);

  const shouldFilter = filterActive && !reduced;

  return (
    <>
      {/* Hidden SVG filter definition — one per instance so blur/contrast
          can vary between usages without conflicting. */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id={`goo-${safeId}`}>
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={blur}
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${offset}`}
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div
        className={className}
        style={{
          ...style,
          filter: shouldFilter ? `url(#goo-${safeId})` : "none",
          // Smooth filter removal so text doesn't pop.
          transition: shouldFilter ? "none" : "filter 200ms ease-out",
        }}
        aria-live={ariaLive}
      >
        {children}
      </div>
    </>
  );
}

/**
 * A small "source dot" that serves as the origin point for the gooey merge.
 * Place this inside a GooeyEmergence container at the orb's position. As
 * other elements animate away from it, the filter creates the viscous
 * detachment read.
 */
export function GooeySource({
  size = 48,
  className = "",
  color = "var(--accent)",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-full flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, ${color} 60%, transparent 100%)`,
      }}
    />
  );
}
