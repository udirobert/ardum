"use client";

// Mira motion controller — orchestrates free-roaming orb movement.
//
// Combines three forces:
// 1. Organic drift — Perlin-like wandering when idle
// 2. Scroll path — orb travels along a curve as user scrolls
// 3. Gravity pull — attracted toward active retreat or focal point
//
// Uses framer-motion springs for smooth, physics-based response.

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, MotionValue } from "framer-motion";

type MiraMotionConfig = {
  /** 0-1 scroll progress through the experience */
  scrollProgress: MotionValue<number>;
  /** Active retreat's bounding box center (viewport coords) */
  activeTarget?: { x: number; y: number } | null;
  /** Processing state - orb pulses and contracts */
  busy?: boolean;
  /** Enable organic drift (disable for cinematic scroll-only paths) */
  drift?: boolean;
};

type MiraMotionState = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
};

// Simple Perlin-like noise using sine waves
function organicNoise(time: number, offset: number): number {
  const t = time * 0.0001 + offset;
  return (
    Math.sin(t * 1.3) * 0.5 +
    Math.sin(t * 2.1 + 0.7) * 0.3 +
    Math.sin(t * 3.7 + 1.2) * 0.2
  );
}

export function useMiraMotion({
  scrollProgress,
  activeTarget,
  busy = false,
  drift = true,
}: MiraMotionConfig): MiraMotionState {
  // Target positions (before spring physics)
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const targetScale = useMotionValue(1);

  // Spring-physics smoothed output
  const x = useSpring(targetX, { stiffness: 50, damping: 20, mass: 1.5 });
  const y = useSpring(targetY, { stiffness: 50, damping: 20, mass: 1.5 });
  const scale = useSpring(targetScale, { stiffness: 100, damping: 15, mass: 0.8 });

  // Track viewport dimensions
  const viewportRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    viewportRef.current = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const handleResize = () => {
      viewportRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Motion controller
  useEffect(() => {
    let raf = 0;
    let time = 0;

    const tick = () => {
      time += 16; // ~60fps
      const { width, height } = viewportRef.current;

      // 1. Organic drift (when enabled)
      let driftX = 0;
      let driftY = 0;
      if (drift) {
        const amplitude = width * 0.15;
        driftX = organicNoise(time, 0) * amplitude;
        driftY = organicNoise(time, 100) * amplitude;
      }

      // 2. Scroll-driven path (figure-8 curve across viewport)
      const progress = scrollProgress.get();
      const scrollAngle = progress * Math.PI * 2;
      const scrollRadius = width * 0.25;
      const scrollX = Math.sin(scrollAngle) * scrollRadius;
      const scrollY = Math.cos(scrollAngle * 0.5) * (height * 0.2);

      // 3. Gravity toward active target
      let gravityX = 0;
      let gravityY = 0;
      if (activeTarget) {
        const centerX = width / 2;
        const centerY = height / 2;
        gravityX = (activeTarget.x - centerX) * 0.3;
        gravityY = (activeTarget.y - centerY) * 0.3;
      }

      // Combine forces
      const baseX = width / 2 + scrollX + driftX + gravityX;
      const baseY = height / 2 + scrollY + driftY + gravityY;

      // Constrain to viewport with padding
      const padding = 120;
      const finalX = Math.max(padding, Math.min(width - padding, baseX));
      const finalY = Math.max(padding, Math.min(height - padding, baseY));

      targetX.set(finalX);
      targetY.set(finalY);

      // Scale: contract when busy, expand when active
      const busyScale = busy ? 0.85 : 1;
      const activeScale = activeTarget ? 1.1 : 1;
      targetScale.set(busyScale * activeScale);

      if (!busy) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollProgress, activeTarget, busy, drift, targetX, targetY, targetScale]);

  return { x, y, scale };
}
