"use client";

import { type ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Wraps a section and applies a venetian-blind clip-path reveal when it
// scrolls into view. Reserved for the most important section transitions
// (hero, match results reveal) so the effect stays special.
//
// Content is visible by default — SSR, prerenders, screenshots, and
// no-JS readers see it. The animation runs only when JS confirms the
// element scrolled into view; above-the-fold elements just stand.

export default function MaskReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [ref, revealed] = useReveal({ threshold: 0.1, rootMargin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  const cls = revealed ? `mask-reveal ${className}`.trim() : className;

  return (
    <div ref={ref} className={cls}>
      {children}
    </div>
  );
}
