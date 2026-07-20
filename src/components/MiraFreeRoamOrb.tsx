"use client";

// MiraFreeRoamOrb - Free-roaming orb that moves independently across viewport
//
// Uses spring physics to smoothly traverse the viewport, coexisting with
// glass-transparent content. The orb passes behind cards, creating a sense
// of shared space rather than layered backgrounds.

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import MiraOrb from "./MiraOrb";
import type { MiraPresence, MiraActivity } from "@/agent/mira-presence";
import type { AestheticVector } from "@/aesthetics/image-pool";

interface MiraFreeRoamOrbProps {
  presence?: MiraPresence | null;
  activity?: MiraActivity;
  aestheticVector?: AestheticVector | null;
  scrollProgress: number; // 0-1, from parent scroll tracking
  activeTarget?: { x: number; y: number } | null;
  busy?: boolean;
}

// Organic noise function for natural wandering
function noise(time: number, offset: number): number {
  const t = time * 0.0001 + offset;
  return (
    Math.sin(t * 1.3) * 0.5 +
    Math.sin(t * 2.1 + 0.7) * 0.3 +
    Math.sin(t * 3.7 + 1.2) * 0.2
  );
}

export default function MiraFreeRoamOrb({
  presence,
  activity,
  aestheticVector,
  scrollProgress,
  activeTarget,
  busy = false,
}: MiraFreeRoamOrbProps) {
  // Motion values for spring physics
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const targetScale = useMotionValue(1);

  // Spring-physics smoothed output
  const x = useSpring(targetX, { stiffness: 50, damping: 20, mass: 1.5 });
  const y = useSpring(targetY, { stiffness: 50, damping: 20, mass: 1.5 });
  const scale = useSpring(targetScale, { stiffness: 100, damping: 15, mass: 0.8 });

  const timeRef = useRef(0);
  const viewportRef = useRef({ width: 0, height: 0 });

  // Track viewport dimensions
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
    let raf: number;

    const tick = () => {
      timeRef.current += 16; // ~60fps
      const time = timeRef.current;
      const { width, height } = viewportRef.current;

      // 1. Organic drift
      const driftAmplitude = width * 0.15;
      const driftX = noise(time, 0) * driftAmplitude;
      const driftY = noise(time, 100) * driftAmplitude;

      // 2. Scroll-driven path (figure-8 curve)
      const scrollAngle = scrollProgress * Math.PI * 2;
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

      // Scale: contract when busy, expand when hovering over active retreat
      const busyScale = busy ? 0.85 : 1;
      const activeScale = activeTarget ? 1.1 : 1;
      targetScale.set(busyScale * activeScale);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollProgress, activeTarget, busy, targetX, targetY, targetScale]);

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-0"
      style={{
        x,
        y,
        scale,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      <div className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px]">
        <MiraOrb
          presence={presence ?? undefined}
          activity={activity}
          aestheticVector={aestheticVector}
          size={360}
          fill
        />
      </div>
    </motion.div>
  );
}
