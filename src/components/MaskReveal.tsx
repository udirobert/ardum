"use client";

import { type ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Wraps a section and applies a venetian-blind clip-path reveal when it
// scrolls into view. Reserved for the most important section transitions
// (hero, match results reveal) so the effect stays special.

export default function MaskReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [ref, revealed] = useReveal({ threshold: 0.1 });
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={
        revealed ? `mask-reveal ${className}`.trim() : `opacity-0 ${className}`.trim()
      }
    >
      {children}
    </div>
  );
}
