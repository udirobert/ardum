"use client";

// Scroll-driven reveal — content animates in as it enters the viewport,
// tied to scroll position (scrub) rather than firing on mount.
//
// Uses GSAP ScrollTrigger. Respects prefers-reduced-motion.

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type ScrollRevealProps = {
  children: ReactNode;
  /** Direction to reveal from. Default: "bottom" */
  from?: "bottom" | "left" | "right" | "scale";
  /** Scrub intensity — 0 = fire on enter, 1 = locked to scroll. Default: 0.3 */
  scrub?: number | boolean;
  /** Stagger children? Default: false */
  stagger?: boolean;
  className?: string;
};

export default function ScrollReveal({
  children,
  from = "bottom",
  scrub = 0.3,
  stagger = false,
  className,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;

    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const targets = stagger
        ? Array.from(el.children)
        : [el];

      const fromVars: Record<string, gsap.TweenVars> = {
        bottom: { y: 60, opacity: 0 },
        left: { x: -60, opacity: 0 },
        right: { x: 60, opacity: 0 },
        scale: { scale: 0.92, opacity: 0 },
      };

      const toVars: gsap.TweenVars = {
        y: 0,
        x: 0,
        scale: 1,
        opacity: 1,
        ease: "power2.out",
        duration: 0.8,
      };

      gsap.fromTo(
        targets,
        fromVars[from],
        {
          ...toVars,
          stagger: stagger ? 0.12 : 0,
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            end: "top 50%",
            scrub: scrub,
          },
        },
      );
    }, ref);

    return () => ctx.revert();
  }, [reduced, from, scrub, stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
