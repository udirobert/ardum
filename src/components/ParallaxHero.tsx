"use client";

// Parallax hero — layered images move at different speeds on scroll,
// creating a cinematic depth effect. Adapted from the Osmo parallax
// layers technique, toned down for Ardum's calm editorial aesthetic.
//
// Three layers:
//   1. Background — distant, moves slowest
//   2. Midground — atmospheric, moves medium
//   3. Foreground — title + accent, moves fastest
//
// Uses GSAP ScrollTrigger for scroll-driven animation.

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1557093793-d149a38a1be8?w=1920&q=80&auto=format&fit=crop";

const HERO_IMAGE_ALT =
  "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1920&q=80&auto=format&fit=crop";

export default function ParallaxHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "0% 0%",
          end: "100% 0%",
          scrub: 0.5,
        },
      });

      // Layer 1 — background, slowest
      tl.to(bgRef.current, {
        yPercent: 15,
        ease: "none",
      }, 0);

      // Layer 2 — midground atmosphere, medium
      tl.to(midRef.current, {
        yPercent: 35,
        ease: "none",
      }, 0);

      // Layer 3 — foreground title, fastest
      tl.to(fgRef.current, {
        yPercent: 55,
        ease: "none",
      }, 0);

      // Title fades + lifts as you scroll
      tl.to(titleRef.current, {
        opacity: 0,
        y: -40,
        ease: "none",
      }, 0);
    }, containerRef);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Layer 1 — background photo (distant, slowest) */}
      <div
        ref={bgRef}
        className="absolute inset-0 will-change-transform"
        style={{ top: "-5%", height: "110%" }}
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

      {/* Layer 2 — midground atmosphere (soft overlay, medium speed) */}
      <div
        ref={midRef}
        className="absolute inset-0 will-change-transform mix-blend-soft-light opacity-40"
        style={{ top: "-10%", height: "120%" }}
      >
        <Image
          src={HERO_IMAGE_ALT}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
          style={{ objectPosition: "center 60%" }}
        />
      </div>

      {/* Warm cream wash — fades from semi-transparent to opaque.
          The top is denser than before so the headline area has enough
          backing for the dark ink text to read over any photo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(246,241,231,0.35) 0%, rgba(246,241,231,0.45) 40%, rgba(246,241,231,0.92) 100%)",
        }}
      />

      {/* Terracotta atmosphere */}
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(168,90,58,0.30) 0%, transparent 70%)",
        }}
      />

      {/* Layer 3 — foreground (title + accent, fastest) */}
      <div
        ref={fgRef}
        className="absolute inset-0 will-change-transform flex items-center justify-center"
        style={{ top: "0%", height: "100%" }}
      >
        <div
          ref={titleRef}
          className="text-center px-6"
        >
          <p
            className="font-serif text-[clamp(3rem,12vw,9rem)] leading-none tracking-tight text-[color:var(--foreground)] opacity-[0.07] select-none"
          >
            ardum
          </p>
        </div>
      </div>
    </div>
  );
}
