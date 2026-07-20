/**
 * StickyRetreatGrid - Scroll-driven sticky layout for retreat exploration
 * 
 * Implements a sticky grid where each retreat pins to the viewport while
 * the user scrolls through its details. This creates a focused, immersive
 * experience for each retreat before moving to the next.
 * 
 * Inspired by: https://tympanus.net/codrops/?p=106424
 */

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import type { Retreat } from "@/inventory/retreat";
import RetreatCard from "./RetreatCard";

interface StickyRetreatGridProps {
  retreats: Retreat[];
  onSelectRetreat: (id: string) => void;
}

interface RetreatItemProps {
  retreat: Retreat;
  index: number;
  total: number;
  isActive: boolean;
  scrollYProgress: MotionValue<number>;
  onSelect: () => void;
}

function RetreatItem({ retreat, index, total, isActive, scrollYProgress, onSelect }: RetreatItemProps) {
  // Calculate vertical offset for parallax
  const start = index / total;
  const end = (index + 1) / total;
  const y = useTransform(
    scrollYProgress,
    [start, end],
    ["100%", "0%"]
  );
  const opacity = useTransform(
    scrollYProgress,
    [start, Math.min(start + 0.1, end), end - 0.1, end],
    [0, 1, 1, 0]
  );

  return (
    <motion.div
      style={{ y, opacity }}
      className="absolute inset-0 flex items-center justify-center p-6 sm:p-10"
    >
      <div className="w-full max-w-5xl">
        <RetreatCard
          retreat={retreat}
          isActive={isActive}
          onSelect={onSelect}
          className="w-full"
        />
      </div>
    </motion.div>
  );
}

export default function StickyRetreatGrid({
  retreats,
  onSelectRetreat,
}: StickyRetreatGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Calculate which retreat should be active based on scroll progress
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (progress) => {
      const newIndex = Math.floor(progress * retreats.length);
      const clampedIndex = Math.min(newIndex, retreats.length - 1);
      setActiveIndex(clampedIndex);
      if (retreats[clampedIndex]) {
        onSelectRetreat(retreats[clampedIndex].id);
      }
    });

    return () => unsubscribe();
  }, [scrollYProgress, retreats, onSelectRetreat]);

  // Each retreat gets a full viewport height of scroll space
  const totalHeight = `calc(${retreats.length * 100}vh)`;

  return (
    <div ref={containerRef} style={{ height: totalHeight }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Progress indicator */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-[#a85a3a]/20 z-50"
          style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
        />

        {/* Retreat cards with parallax effect */}
        <div className="relative h-full">
          {retreats.map((retreat, index) => {
            const isActive = index === activeIndex;
            
            return (
              <RetreatItem
                key={retreat.id}
                retreat={retreat}
                index={index}
                total={retreats.length}
                isActive={isActive}
                scrollYProgress={scrollYProgress}
                onSelect={() => onSelectRetreat(retreat.id)}
              />
            );
          })}
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: activeIndex > 0 ? 0 : 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#f6efe3]/60 text-sm"
        >
          Scroll to explore retreats
        </motion.div>
      </div>
    </div>
  );
}
