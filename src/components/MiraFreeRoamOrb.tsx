"use client";

// MiraFreeRoamOrb - Free-roaming orb that moves independently across viewport
//
// Uses spring physics to smoothly traverse the viewport, coexisting with
// glass-transparent content. The orb passes behind cards, creating a sense
// of shared space rather than layered backgrounds.
//
// Motion features:
// - Delta-time for frame-rate independent physics
// - Velocity-based lean (orb tilts into movement direction)
// - Scroll velocity reaction (fast scroll pulls orb along)
// - Reduced-motion support (falls back to gentle drift)
// - Off-screen throttling (pauses RAF when not visible)

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import MiraOrb from "./MiraOrb";
import type { MiraPresence, MiraActivity } from "@/agent/mira-presence";
import type { AestheticVector } from "@/aesthetics/image-pool";

interface MiraFreeRoamOrbProps {
  presence?: MiraPresence | null;
  activity?: MiraActivity;
  aestheticVector?: AestheticVector | null;
  scrollProgress: number; // 0-1, from parent scroll tracking
  scrollVelocity?: number; // pixels/second, for scroll-speed reaction
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
  scrollVelocity = 0,
  activeTarget,
  busy = false,
}: MiraFreeRoamOrbProps) {
  const reducedMotion = useReducedMotion();
  
  // Motion values for spring physics
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const targetScale = useMotionValue(1);
  const targetRotate = useMotionValue(0); // lean angle in degrees

  // Spring-physics smoothed output
  const x = useSpring(targetX, { stiffness: 50, damping: 20, mass: 1.5 });
  const y = useSpring(targetY, { stiffness: 50, damping: 20, mass: 1.5 });
  const scale = useSpring(targetScale, { stiffness: 100, damping: 15, mass: 0.8 });
  const rotate = useSpring(targetRotate, { stiffness: 80, damping: 18, mass: 0.6 });

  // Track velocity for lean calculation
  const prevX = useRef(0);
  const prevY = useRef(0);
  const velocityX = useRef(0);
  const velocityY = useRef(0);

  const timeRef = useRef(0);
  const lastFrameTime = useRef(0);
  const viewportRef = useRef({ width: 0, height: 0 });
  const isVisible = useRef(true);

  // Track viewport dimensions and visibility
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

    // Throttle when orb scrolls off-screen
    const handleScroll = () => {
      const rect = document.querySelector('[data-mira-orb]')?.getBoundingClientRect();
      isVisible.current = rect 
        ? rect.bottom > 0 && rect.top < window.innerHeight
        : true;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Motion controller with delta-time physics
  useEffect(() => {
    let raf: number;

    const tick = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastFrameTime.current, 50); // cap at 50ms
      lastFrameTime.current = currentTime;
      
      // Throttle to 30fps when off-screen
      if (!isVisible.current && deltaTime < 33) {
        raf = requestAnimationFrame(tick);
        return;
      }

      timeRef.current += deltaTime;
      const time = timeRef.current;
      const { width, height } = viewportRef.current;

      // Reduced motion: gentle drift only, no complex paths
      if (reducedMotion) {
        const gentleX = width / 2 + noise(time, 0) * (width * 0.05);
        const gentleY = height / 2 + noise(time, 100) * (height * 0.05);
        targetX.set(gentleX);
        targetY.set(gentleY);
        targetScale.set(1);
        targetRotate.set(0);
        raf = requestAnimationFrame(tick);
        return;
      }

      // 1. Organic drift
      const driftAmplitude = width * 0.15;
      const driftX = noise(time, 0) * driftAmplitude;
      const driftY = noise(time, 100) * driftAmplitude;

      // 2. Scroll-driven path (figure-8 curve) with velocity amplification
      const scrollAngle = scrollProgress * Math.PI * 2;
      const scrollRadius = width * 0.25;
      const velocityBoost = Math.min(Math.abs(scrollVelocity) / 2000, 1.5); // cap at 1.5x
      const scrollX = Math.sin(scrollAngle) * scrollRadius * (1 + velocityBoost * 0.3);
      const scrollY = Math.cos(scrollAngle * 0.5) * (height * 0.2) * (1 + velocityBoost * 0.2);

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

      // Calculate velocity for lean effect
      const dtSeconds = deltaTime / 1000;
      if (dtSeconds > 0) {
        velocityX.current = (finalX - prevX.current) / dtSeconds;
        velocityY.current = (finalY - prevY.current) / dtSeconds;
        prevX.current = finalX;
        prevY.current = finalY;
      }

      // Lean into movement direction (max 8 degrees)
      const speed = Math.sqrt(velocityX.current ** 2 + velocityY.current ** 2);
      const maxLean = 8;
      const leanAngle = Math.min(speed / 200, maxLean) * Math.sign(velocityX.current);
      targetRotate.set(leanAngle);

      // Scale: contract when busy, expand when hovering over active retreat
      const busyScale = busy ? 0.85 : 1;
      const activeScale = activeTarget ? 1.1 : 1;
      const velocityScale = 1 + velocityBoost * 0.05; // subtle expansion at high scroll speed
      targetScale.set(busyScale * activeScale * velocityScale);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollProgress, scrollVelocity, activeTarget, busy, targetX, targetY, targetScale, targetRotate, reducedMotion]);

  return (
    <motion.div
      data-mira-orb
      className="fixed top-0 left-0 pointer-events-none z-0"
      style={{
        x,
        y,
        scale,
        rotate,
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
