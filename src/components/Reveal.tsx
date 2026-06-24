"use client";

import { type ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Wraps content and fades it in when it scrolls into the viewport.
// Accepts a `delay` prop (in ms) that maps to a staggered entrance.
// Content is visible by default — SSR, prerenders, screenshots, and
// no-JS readers see it. Animation plays only after the observer fires.

const DELAY_CLASSES = [
  "",
  "fade-in-up-1",
  "fade-in-up-2",
  "fade-in-up-3",
  "fade-in-up-4",
  "fade-in-up-5",
];

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, revealed] = useReveal({ rootMargin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  const delayClass = DELAY_CLASSES[delay / 100] ?? "";
  const cls = revealed
    ? `${className} ${delayClass || "fade-in-up"}`.trim()
    : className;

  return <div ref={ref} className={cls}>{children}</div>;
}
