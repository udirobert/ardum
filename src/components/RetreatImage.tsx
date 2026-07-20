"use client";

import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import type { Retreat } from "@/inventory/retreat";
import { generateCurvePoints } from "@/hooks/useMotionPath";
import { useMiraOrbPosition } from "./MiraOrbContext";

interface RetreatImageProps {
  retreat: Retreat;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  transitioning?: boolean;
  orbPosition?: { x: number; y: number } | null;
}

export default function RetreatImage({
  retreat,
  index,
  isActive,
  onSelect,
  transitioning = false,
  orbPosition: orbPositionProp = null,
}: RetreatImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { orbPosition: contextOrbPosition } = useMiraOrbPosition();
  const orbPosition = orbPositionProp || contextOrbPosition;
  
  // Motion path state for enter/exit animations
  const pathX = useMotionValue(0);
  const pathY = useMotionValue(0);
  const pathScale = useMotionValue(1);
  const pathOpacity = useMotionValue(1);
  
  const springX = useSpring(pathX, { stiffness: 100, damping: 20 });
  const springY = useSpring(pathY, { stiffness: 100, damping: 20 });
  const springScale = useSpring(pathScale, { stiffness: 100, damping: 20 });
  const springOpacity = useSpring(pathOpacity, { stiffness: 100, damping: 25 });
  
  // Scroll progress for this specific retreat
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Image parallax and scale
  const y = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1.05, 0.95]);
  
  // Progressive text disclosure
  const titleOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const titleY = useTransform(scrollYProgress, [0.3, 0.5], [20, 0]);
  
  const priceOpacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
  const priceY = useTransform(scrollYProgress, [0.4, 0.6], [20, 0]);
  
  const locationOpacity = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const locationY = useTransform(scrollYProgress, [0.5, 0.7], [20, 0]);

  // Motion path enter/exit animations
  useEffect(() => {
    if (!transitioning) {
      // Normal state - no offset
      pathX.set(0);
      pathY.set(0);
      pathScale.set(1);
      pathOpacity.set(1);
      return;
    }

    // Calculate start position (from orb or off-screen)
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const centerX = containerRect.left + containerRect.width / 2;
    const centerY = containerRect.top + containerRect.height / 2;

    // Generate curved path from orb to final position
    const orbPos = orbPosition || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const curvePoints = generateCurvePoints(
      orbPos,
      { x: centerX, y: centerY },
      { curviness: 0.4, curveDirection: index % 2 === 0 ? 'left' : 'right' }
    );

    // Calculate initial offset from orb
    const startOffsetX = curvePoints[0].x - centerX;
    const startOffsetY = curvePoints[0].y - centerY;

    // Stagger by index (max 600ms stagger)
    const staggerDelay = Math.min(index * 150, 600);

    // Set initial state (at orb position, small and transparent)
    pathX.set(startOffsetX);
    pathY.set(startOffsetY);
    pathScale.set(0.3);
    pathOpacity.set(0);

    // Animate to final position after delay
    setTimeout(() => {
      pathX.set(0);
      pathY.set(0);
      pathScale.set(1);
      pathOpacity.set(1);
    }, staggerDelay);
  }, [transitioning, orbPosition, index]);

  return (
    <motion.div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden cursor-pointer"
      onClick={onSelect}
      style={{
        x: springX,
        y: springY,
        scale: springScale,
        opacity: springOpacity,
      }}
    >
      {/* Full-bleed image with parallax */}
      <motion.div
        className="absolute inset-0"
        style={{ y }}
      >
        <motion.img
          src={retreat.heroImage}
          alt={retreat.title}
          className="w-full h-full object-cover"
          style={{ scale }}
        />
        
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </motion.div>

      {/* Text overlays - positioned bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
        {/* Title */}
        <motion.h2
          className="font-serif text-4xl md:text-6xl text-[#f6efe3] mb-2 drop-shadow-lg"
          style={{ opacity: titleOpacity, y: titleY }}
        >
          {retreat.title}
        </motion.h2>
        
        {/* Price */}
        <motion.p
          className="text-xl md:text-2xl text-[#f6efe3]/90 mb-1 drop-shadow"
          style={{ opacity: priceOpacity, y: priceY }}
        >
          ${retreat.price.amount.toLocaleString()} • {retreat.dates.duration} days
        </motion.p>
        
        {/* Location */}
        <motion.p
          className="text-base md:text-lg text-[#f6efe3]/70 drop-shadow"
          style={{ opacity: locationOpacity, y: locationY }}
        >
          {retreat.location}
        </motion.p>
      </div>

      {/* Active indicator - subtle glow on the side */}
      {isActive && (
        <motion.div
          className="absolute top-0 right-0 w-2 h-full bg-gradient-to-l from-[#a85a3a]/60 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
      )}

      {/* Scroll indicator for first retreat */}
      {index === 0 && (
        <motion.div
          className="absolute bottom-8 right-8 text-[#f6efe3]/60 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
        >
          Scroll to explore →
        </motion.div>
      )}
    </motion.div>
  );
}
