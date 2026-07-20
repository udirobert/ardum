/**
 * MiraNote - Mira's contextual commentary
 * 
 * Displays Mira's voice in a visually distinct way that feels like
 * guidance rather than a chat message. Uses the dusk theme and
 * serif typography to maintain the sacred, intentional-focused tone.
 */

import { useEffect, useState } from "react";

interface MiraNoteProps {
  children: React.ReactNode;
  animate?: boolean;
}

export default function MiraNote({ children, animate = false }: MiraNoteProps) {
  const [isVisible, setIsVisible] = useState(!animate);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animate, children]);

  return (
    <div
      className={`transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="relative pl-8 border-l-2 border-[#a85a3a]/40">
        {/* Decorative orb */}
        <div className="absolute left-[-10px] top-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#a85a3a] to-[#8b4513] shadow-lg shadow-[#a85a3a]/30" />
        
        {/* Note content */}
        <p className="font-serif text-xl sm:text-2xl text-[#f6efe3] leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
