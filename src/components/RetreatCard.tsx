/**
 * RetreatCard - Presentation component for individual retreats
 * 
 * Displays retreat information with a visually rich layout:
 * - Hero image with gradient overlay
 * - Location, dates, and price
 * - Operator name and bio
 * - Capacity and highlights
 * 
 * Enhanced with motion transitions for smooth enter/exit animations.
 */

import { motion } from "framer-motion";
import type { Retreat } from "@/inventory/retreat";

interface RetreatCardProps {
  retreat: Retreat;
  isActive: boolean;
  onSelect: () => void;
  className?: string;
}

export default function RetreatCard({
  retreat,
  isActive,
  onSelect,
  className = "",
}: RetreatCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
          duration: 0.6,
          ease: [0.23, 1, 0.32, 1]
        }
      }}
      exit={{ 
        opacity: 0, 
        y: -40, 
        scale: 0.95,
        transition: {
          duration: 0.4,
          ease: [0.23, 1, 0.32, 1]
        }
      }}
      whileHover={{ 
        y: -8,
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-lg border transition-all duration-300 cursor-pointer ${
        isActive
          ? "border-[#a85a3a] shadow-lg shadow-[#a85a3a]/20"
          : "border-[#f6efe3]/10 hover:border-[#f6efe3]/30"
      } ${className}`}
      style={{ background: "rgba(16,10,8,0.8)" }}
    >
      {/* Hero image */}
      <div className="relative h-64 overflow-hidden">
        <motion.img
          src={retreat.heroImage}
          alt={retreat.title}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.5 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0806] via-[#0c0806]/40 to-transparent" />
        
        {/* Location badge */}
        <motion.div 
          className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-[#0c0806]/80 backdrop-blur-sm border border-[#f6efe3]/20"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <span className="text-xs text-[#f6efe3]/90">{retreat.location}</span>
        </motion.div>

        {/* Active indicator */}
        {isActive && (
          <motion.div 
            className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#a85a3a]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: 1,
              transition: {
                scale: {
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut"
                }
              }
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <h3 className="font-serif text-2xl text-[#f6efe3] mb-2">{retreat.title}</h3>
          <p className="text-sm text-[#f6efe3]/70 leading-relaxed">
            {retreat.description}
          </p>
        </motion.div>

        {/* Key details */}
        <motion.div 
          className="grid grid-cols-2 gap-4 pt-4 border-t border-[#f6efe3]/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div>
            <p className="text-xs text-[#f6efe3]/50 mb-1">Dates</p>
            <p className="text-sm text-[#f6efe3]">
              {formatDate(retreat.dates.start)} – {formatDate(retreat.dates.end)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#f6efe3]/50 mb-1">Duration</p>
            <p className="text-sm text-[#f6efe3]">{retreat.dates.duration} days</p>
          </div>
          <div>
            <p className="text-xs text-[#f6efe3]/50 mb-1">Investment</p>
            <p className="text-sm text-[#f6efe3]">
              ${retreat.price.amount.toLocaleString()} USD
            </p>
          </div>
          <div>
            <p className="text-xs text-[#f6efe3]/50 mb-1">Capacity</p>
            <p className="text-sm text-[#f6efe3]">
              {retreat.capacity.current}/{retreat.capacity.max} spaces
            </p>
          </div>
        </motion.div>

        {/* Operator */}
        <motion.div 
          className="flex items-center gap-3 pt-4 border-t border-[#f6efe3]/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f6efe3]/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={retreat.operator.avatar}
              alt={retreat.operator.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm text-[#f6efe3] font-medium">{retreat.operator.name}</p>
            <p className="text-xs text-[#f6efe3]/60">Retreat operator</p>
          </div>
        </motion.div>

        {/* Highlights */}
        {retreat.highlights.length > 0 && (
          <motion.div 
            className="pt-4 border-t border-[#f6efe3]/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <p className="text-xs text-[#f6efe3]/50 mb-2">What makes this special</p>
            <ul className="space-y-1">
              {retreat.highlights.slice(0, 3).map((highlight, index) => (
                <motion.li 
                  key={index} 
                  className="text-xs text-[#f6efe3]/70 flex items-start gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                >
                  <span className="text-[#a85a3a] mt-0.5">•</span>
                  <span>{highlight}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

      {/* Active indicator glow */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -inset-px rounded-lg bg-gradient-to-r from-[#a85a3a]/20 via-[#a85a3a]/10 to-[#a85a3a]/20 -z-10 blur-xl pointer-events-none"
        />
      )}
    </motion.article>
  );
}
