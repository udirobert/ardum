"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Activates transitions.dev t-stagger when the block enters the viewport.
// `eager` shows immediately — required on arrival so the intention input
// is visible/focusable on first paint (arrival.md: no animation that
// delays the input).

export default function StaggerReveal({
  children,
  className,
  eager = false,
}: {
  children: ReactNode;
  className?: string;
  /** Skip the intersection wait; start in is-shown. */
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (eager) {
      el.classList.add("is-shown");
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-shown");
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager]);

  return (
    <div
      ref={ref}
      className={`t-stagger${eager ? " is-shown" : ""} ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
