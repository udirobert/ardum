"use client";

// 3D retreat carousel — drag/scroll to browse retreat photos with
// cinematic depth. Toned down from the original agency-portfolio version:
//   - 10deg rotation (not 20deg)
//   - 3px blur (not 6px)
//   - Slower lerp (0.10 vs 0.14)
//   - Retreat photos with location overlays, not random images
//
// Uses GSAP ticker for the animation loop. Respects prefers-reduced-motion
// (renders as a static grid fallback).

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

gsap.config({ nullTargetWarn: false });

type Retreat = {
  rootHash: string;
  title: string;
  location: string;
  priceUsd: number;
  photo?: { src: string; alt: string };
};

type RetreatCarouselProps = {
  retreats: Retreat[];
  children?: (retreat: Retreat) => ReactNode;
};

export default function RetreatCarousel({
  retreats,
}: RetreatCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    // Clone cards for infinite scroll
    const originalCards = Array.from(
      track.querySelectorAll("[data-carousel-card]"),
    );
    const originalCount = originalCards.length;
    if (originalCount === 0) return;

    // Clear and re-append clones
    track.innerHTML = "";
    const cloneCount = 3;
    for (let i = 0; i < cloneCount; i++) {
      originalCards.forEach((c) => track.appendChild(c.cloneNode(true)));
    }

    const cards = Array.from(
      track.querySelectorAll("[data-carousel-card]"),
    ) as HTMLElement[];

    function getItemWidth() {
      const style = window.getComputedStyle(cards[0]);
      return cards[0].offsetWidth + parseFloat(style.marginRight || "0");
    }

    let itemW = getItemWidth();
    let totalWidth = itemW * cards.length;
    let visibleCenterX = window.innerWidth / 2;

    let position = 0;
    let velocity = 0;
    let smoothPos = 0;

    const friction = 0.93;
    const wheelMultiplier = 0.08;
    const lerpSpeed = 0.10;

    // Wheel input
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      velocity += e.deltaY * wheelMultiplier;
    }

    // Touch input
    let touchStartX: number | null = null;
    function onTouchStart(e: TouchEvent) {
      touchStartX = e.touches[0].clientX;
    }
    function onTouchMove(e: TouchEvent) {
      if (touchStartX === null) return;
      const dx = e.touches[0].clientX - touchStartX;
      position -= dx;
      touchStartX = e.touches[0].clientX;
    }
    function onTouchEnd() {
      touchStartX = null;
    }

    // Mouse drag
    let isDragging = false;
    let lastX = 0;
    let dragStartTime = 0;
    let dragStartX = 0;

    function onMouseDown(e: MouseEvent) {
      isDragging = true;
      lastX = e.clientX;
      dragStartX = e.clientX;
      dragStartTime = performance.now();
      velocity = 0;
      viewport?.classList.add("dragging");
    }
    function onMouseUp(e: MouseEvent) {
      if (!isDragging) return;
      viewport?.classList.remove("dragging");
      isDragging = false;
      const dx = e.clientX - dragStartX;
      const dt = (performance.now() - dragStartTime) / 1000;
      if (dt > 0) {
        const v = -(dx / dt) * 0.02;
        velocity = Math.max(Math.min(v, 20), -20);
      }
    }
    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      position -= dx * 0.8;
      lastX = e.clientX;
    }

    function wrap(x: number) {
      return ((x % totalWidth) + totalWidth) % totalWidth;
    }

    function easeScale(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: true });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    viewport.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    viewport.addEventListener("mousemove", onMouseMove);

    const tickerFn = () => {
      if (!isDragging) {
        position += velocity;
        velocity *= friction;
      }
      smoothPos += (position - smoothPos) * lerpSpeed;

      for (let i = 0; i < cards.length; i++) {
        let baseX = i * itemW - smoothPos;
        baseX = wrap(baseX);
        const finalX = baseX - totalWidth / 2 + visibleCenterX;
        const cardCenterX = finalX + itemW / 2;
        const dist = Math.abs(cardCenterX - visibleCenterX);

        let t = gsap.utils.clamp(0, 1, dist / Math.max(window.innerWidth, 900));
        t = easeScale(t);

        // Toned down from the original:
        //   scale: 0.75 (not 0.65)
        //   rotateY: 10 (not 20)
        //   rotateX: 4 (not 6)
        //   blur: 3 (not 6)
        //   brightness: 0.7 (not 0.6)
        const scale = gsap.utils.mapRange(0, 1, 1, 0.75, t);
        const rotateY =
          gsap.utils.mapRange(0, 1, 0, 10, t) *
          (cardCenterX < visibleCenterX ? 1 : -1);
        const rotateX =
          gsap.utils.mapRange(0, 1, 0, 4, t) *
          (cardCenterX < visibleCenterX ? -1 : 1);
        const z = gsap.utils.mapRange(0, 1, 80, -40, t);
        const yOffset = gsap.utils.mapRange(0, 1, 0, 30, t);
        const blur = gsap.utils.mapRange(0, 1, 0, 3, t);
        const brightness = gsap.utils.mapRange(0, 1, 1, 0.7, t);

        gsap.set(cards[i], {
          x: finalX,
          y: yOffset,
          scaleX: scale,
          scaleY: scale,
          rotationY: rotateY,
          rotationX: rotateX,
          z,
          filter: `blur(${blur}px) brightness(${brightness})`,
          transformOrigin: "center center",
        });

        // Parallax inner image
        const img = cards[i].querySelector(
          "[data-carousel-img]",
        ) as HTMLElement | null;
        if (img) {
          const parallaxRange = 30;
          const parallaxX = gsap.utils.mapRange(
            -window.innerWidth / 2,
            window.innerWidth / 2,
            parallaxRange,
            -parallaxRange,
            cardCenterX - visibleCenterX,
          );
          const parallaxY = gsap.utils.mapRange(
            -window.innerWidth / 2,
            window.innerWidth / 2,
            -8,
            8,
            cardCenterX - visibleCenterX,
          );
          gsap.to(img, {
            x: parallaxX,
            y: parallaxY,
            duration: 0.5,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
      }
    };

    gsap.ticker.add(tickerFn);

    function onResize() {
      itemW = getItemWidth();
      totalWidth = itemW * cards.length;
      visibleCenterX = window.innerWidth / 2;
    }
    window.addEventListener("resize", onResize);

    return () => {
      gsap.ticker.remove(tickerFn);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      viewport.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
    };
  }, [reduced, retreats]);

  // Reduced motion: render as a simple horizontal scroll
  if (reduced) {
    return (
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-6 px-6 sm:px-10">
          {retreats.map((r) => (
            <div
              key={r.rootHash}
              className="flex-shrink-0 w-[clamp(260px,30vw,400px)] aspect-[16/9] overflow-hidden rounded-sm border border-[color:var(--hairline)]"
            >
              {r.photo && (
                <Image
                  src={r.photo.src}
                  alt={r.photo.alt}
                  width={800}
                  height={450}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="relative w-full h-[40vh] min-h-[280px] overflow-visible cursor-grab"
      style={{ perspective: "1200px" }}
    >
      <div
        ref={trackRef}
        className="absolute bottom-4 left-0 h-full will-change-transform"
      >
        {retreats.map((r) => (
          <div
            key={r.rootHash}
            data-carousel-card
            className="absolute bottom-0 w-[clamp(260px,30vw,400px)] aspect-[16/9] mr-12 overflow-hidden rounded-sm border border-[color:var(--hairline)]"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="w-full h-full overflow-hidden will-change-transform relative">
              {r.photo ? (
                <Image
                  src={r.photo.src}
                  alt={r.photo.alt}
                  width={800}
                  height={450}
                  data-carousel-img
                  className="w-[120%] h-[120%] object-cover select-none pointer-events-none"
                  style={{
                    transform: "translate3d(0,0,0)",
                    willChange: "transform",
                  }}
                  draggable={false}
                />
              ) : (
                <div
                  data-carousel-img
                  className="w-[120%] h-[120%] bg-[color:var(--surface)]"
                />
              )}
              {/* Location overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                <p className="text-white text-sm font-medium tracking-tight">
                  {r.location}
                </p>
                <p className="text-white/70 text-xs mt-0.5">
                  {r.title} · ${r.priceUsd.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
