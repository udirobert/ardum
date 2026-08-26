"use client";

// Scroll progress — how far the viewport has scrolled past the fold, as a
// 0–1 ease. Passive + rAF-throttled so it never blocks the main thread. Used
// by the Mira field to grow the orb subtly as the practitioner scrolls past
// the hero, so Mira's presence deepens rather than retreats during a long
// read.

import { useEffect, useState } from "react";

/**
 * Returns 0 at the top of the page, approaching 1 once the viewport has
 * scrolled roughly one viewport-height past the fold. Clamped to [0, 1].
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      if (vh <= 0) return;
      setProgress(Math.max(0, Math.min(1, scrollY / vh)));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return progress;
}
