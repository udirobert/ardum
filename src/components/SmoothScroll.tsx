"use client";

// Lenis smooth scroll provider — wraps the app and adds inertia-based
// scroll smoothing. Invisible to the user; they just feel that the
// site is "buttery" instead of janky native scroll.
//
// Respects prefers-reduced-motion (disables smoothing entirely).

import { useEffect, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function SmoothScroll({
  children,
}: {
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;

    let lenis: { destroy: () => void; raf: (time: number) => void } | null =
      null;

    // Dynamic import — Lenis doesn't ship ESM-friendly for SSR
    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 0.8,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1,
      });

      function raf(time: number) {
        lenis?.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    });

    return () => {
      lenis?.destroy();
    };
  }, [reduced]);

  return <>{children}</>;
}
