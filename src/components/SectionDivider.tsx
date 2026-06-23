"use client";

import { type ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// A decorative divider between major page sections. Reveals with a subtle
// horizontal stretch — barely perceptible, but the page has rhythm.

export default function SectionDivider({
  children,
}: {
  children?: ReactNode;
}) {
  const [ref, revealed] = useReveal();
  const reduced = useReducedMotion();

  return (
    <div ref={ref} className="my-16 flex items-center gap-4" aria-hidden>
      <span
        className="h-px flex-1 transition-all duration-700"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--hairline) 50%, transparent 100%)",
          transform: reduced || revealed ? "scaleX(1)" : "scaleX(0)",
        }}
      />
      {children && (
        <span className="text-xs text-[color:var(--muted)]">{children}</span>
      )}
    </div>
  );
}
