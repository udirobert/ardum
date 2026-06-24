"use client";

import Image from "next/image";

// A subtle full-viewport atmospheric background for the home page. The
// gradient overlays ensure text readability and brand consistency —
// the photograph sits under warm cream and terracotta-tinted layers so
// it blends into the palette instead of fighting it.

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1557093793-d149a38a1be8?w=1920&q=80&auto=format&fit=crop";

export default function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Warm cream gradient overlay — photography sits under this */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(246,241,231,0.92) 0%, rgba(246,241,231,0.65) 50%, rgba(246,241,231,0.95) 100%)",
        }}
      />
      {/* Terracotta tint — extremely subtle warm cast */}
      <div
        className="absolute inset-0 z-10 mix-blend-soft-light opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(168,90,58,0.15) 0%, transparent 70%)",
        }}
      />
      {/* The photo */}
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
  );
}
