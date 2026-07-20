"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { Retreat } from "@/inventory/retreat";

interface RetreatImageProps {
  retreat: Retreat;
  index: number;
  total: number;
  isActive: boolean;
  onSelect: () => void;
}

export default function RetreatImage({
  retreat,
  index,
  isActive,
  onSelect,
}: RetreatImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
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

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden cursor-pointer"
      onClick={onSelect}
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
    </div>
  );
}
