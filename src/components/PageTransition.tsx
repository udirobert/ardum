"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Wraps page content and applies a crossfade transition on route change.
// Uses the View Transitions API (Chromium) with a CSS fade-in/fade-out
// fallback for other browsers. Skipped entirely when the user prefers
// reduced motion.

const DURATION = 420;

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(children);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const mounted = useRef(false);

  // Hooks are unconditional — the early return below only affects JSX.
  useEffect(() => {
    // First render: initial state is already correct; just mark mounted.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    // Try View Transitions API first (Chromium). Bound to document
    // because startViewTransition relies on `this` being the document.
    const doc = document as unknown as {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => setDisplay(children));
      return;
    }

    // CSS fallback: fade out, swap, fade in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("exit");
    const timer = setTimeout(() => {
      setDisplay(children);
      setPhase("enter");
    }, DURATION * 0.6);

    return () => clearTimeout(timer);
  }, [pathname, children]);

  // Skip animation when the user prefers reduced motion.
  if (reduced) return <>{children}</>;

  return (
    <div
      className={phase === "enter" ? "page-enter" : "page-exit"}
      style={{
        animationDuration: `${DURATION}ms`,
        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {display}
    </div>
  );
}
