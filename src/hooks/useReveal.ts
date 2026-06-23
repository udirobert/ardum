"use client";

import { useEffect, useRef, useState } from "react";

// Tracks whether an element has scrolled into the viewport. Disconnects
// after the first intersection so it fires exactly once per element.

export function useReveal(options?: {
  threshold?: number;
  rootMargin?: string;
}): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold: options?.threshold ?? 0.15, rootMargin: options?.rootMargin }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [options?.threshold, options?.rootMargin, revealed]);

  return [ref, revealed];
}
