"use client";

// Lenis smooth scroll provider — wraps the app and adds inertia-based
// scroll smoothing. Invisible to the user; they just feel that the
// site is "buttery" instead of janky native scroll.
//
// Respects prefers-reduced-motion (disables smoothing entirely).
// Active only on journey routes that benefit from cinematic scrolling.

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

function shouldSmoothScroll(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/episode/")) return true;
  if (pathname.startsWith("/demo/")) return true;
  return false;
}

export default function SmoothScroll({
  children,
}: {
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const enabled = shouldSmoothScroll(pathname);

  useEffect(() => {
    if (reduced || !enabled) return;
    if (typeof window === "undefined") return;

    let lenis: { destroy: () => void; raf: (time: number) => void } | null =
      null;
    let frameId = 0;
    let cancelled = false;

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        duration: 0.8,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1,
      });

      function raf(time: number) {
        if (cancelled) return;
        lenis?.raf(time);
        frameId = requestAnimationFrame(raf);
      }
      frameId = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      lenis?.destroy();
    };
  }, [reduced, enabled]);

  return <>{children}</>;
}
