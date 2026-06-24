"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

// Full-viewport atmospheric background with slow parallax scroll.

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1557093793-d149a38a1be8?w=1920&q=80&auto=format&fit=crop";

export default function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          const c = containerRef.current;
          const i = imageRef.current;
          if (!c || !i) return;
          const rect = c.getBoundingClientRect();
          // Only parallax while the hero is visible on screen.
          if (rect.bottom > 0 && rect.top < window.innerHeight) {
            const offset = rect.top * 0.25; // slower than scroll
            i.style.transform = `translateY(${offset}px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* The photo — extra tall to allow parallax movement */}
      <div
        ref={imageRef}
        className="absolute inset-0 will-change-transform"
        style={{ top: "-10%", height: "120%", width: "100%" }}
      >
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
          style={{ objectPosition: "center 30%" }}
        />
      </div>
      {/* Warm cream wash — fades from transparent at the top (so the photo
          reads) to nearly-opaque at the bottom (so the section underneath
          starts on a clean cream baseline). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(246,241,231,0.20) 0%, rgba(246,241,231,0.35) 50%, rgba(246,241,231,0.95) 100%)",
        }}
      />
      {/* Terracotta atmosphere — soft-light radial so warmer tones glow
          without colour-shifting the surface. */}
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(168,90,58,0.30) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
