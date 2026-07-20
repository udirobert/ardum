"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRetreatExploration } from "@/inventory/use-retreat-exploration";
import { useMiraField } from "./MiraField";
import { MiraOrbProvider } from "./MiraOrbContext";
import type { IntentionConstraints } from "@/agent/constraint-updater";
import type { Retreat } from "@/inventory/retreat";
import RetreatImage from "./RetreatImage";
import AmbientCanvas from "./AmbientCanvas";
import MiraNote from "./MiraNote";

interface RetreatExplorationViewProps {
  // Hook mode props (for EpisodeWorkbench)
  initialConstraints?: IntentionConstraints;
  onConstraintChange?: (constraints: IntentionConstraints) => void;
  
  // Direct mode props (for demo/testing)
  retreats?: Retreat[];
  miraNote?: string;
  onUserMessage?: (text: string) => void | Promise<void>;
  onCommit?: (retreatId: string) => void;
  onSelect?: (retreatId: string) => void;
  busy?: boolean;
}

export default function RetreatExplorationView({
  initialConstraints,
  onConstraintChange,
  retreats: propRetreats,
  miraNote: propMiraNote,
  onUserMessage: propOnUserMessage,
  onCommit: propOnCommit,
  onSelect: propOnSelect,
  busy: propBusy,
}: RetreatExplorationViewProps) {
  // Determine mode: if retreats prop is provided, use direct mode
  const isDirectMode = propRetreats !== undefined;
  
  // Use hook only in hook mode
  const hookResult = useRetreatExploration(
    isDirectMode ? undefined : initialConstraints
  );
  
  // Select data source based on mode
  const retreats = isDirectMode ? propRetreats : hookResult.retreats;
  const miraNote = isDirectMode ? propMiraNote : hookResult.miraNote;
  const busy = isDirectMode ? (propBusy ?? false) : (hookResult.state !== "idle");
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTarget, setActiveTarget] = useState<{ x: number; y: number } | null>(null);
  const [hasConversed, setHasConversed] = useState(false);
  const [input, setInput] = useState("");

  // Scroll container ref for tracking orb movement
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll progress (0-1) through the retreat list
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const prevValue = scrollProgress;
    setScrollProgress(value);
    
    // Calculate scroll velocity (change in progress per frame)
    const velocity = Math.abs(value - prevValue) * 1000;
    setScrollVelocity(velocity);
    
    // Determine active retreat based on scroll position
    if (retreats.length > 0) {
      const retreatIndex = Math.min(
        Math.floor(value * retreats.length),
        retreats.length - 1
      );
      if (retreatIndex !== activeIndex) {
        setActiveIndex(retreatIndex);
        setActiveTarget({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }
    }
  });
  
  // Integrate with Mira's field - enable free-roam mode and feed motion state
  useMiraField({
    activity: busy ? "processing" : "idle",
    freeRoam: true,
    scrollProgress,
    scrollVelocity,
    activeTarget,
  });
  
  const handleUserMessage = (text: string) => {
    if (isDirectMode && propOnUserMessage) {
      propOnUserMessage(text);
    } else if (!isDirectMode) {
      hookResult.onUserMessage(text);
      // Trigger constraint change callback after a brief delay
      setTimeout(() => {
        if (onConstraintChange && hookResult.constraints) {
          onConstraintChange(hookResult.constraints);
        }
      }, 100);
    }
    setHasConversed(true);
  };
  
  const handleCommit = (retreatId: string) => {
    if (isDirectMode && propOnCommit) {
      propOnCommit(retreatId);
    } else if (!isDirectMode) {
      hookResult.onCommit(retreatId);
    }
  };

  const handleSelect = (retreatId: string, index: number) => {
    setActiveIndex(index);
    if (isDirectMode && propOnSelect) {
      propOnSelect(retreatId);
    }
  };

  const safeIndex = Math.min(activeIndex, Math.max(0, retreats.length - 1));
  const activeRetreat = retreats[safeIndex] ?? null;

  const handleSend = () => {
    if (!input.trim() || busy) return;
    handleUserMessage(input.trim());
    setInput("");
    setActiveIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <MiraOrbProvider>
      {/* Ambient canvas - reactive gradient background */}
      <AmbientCanvas retreat={activeRetreat} />
      
      {/* Fixed conversation input - always accessible */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6 sm:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <MiraNote animate>
            {miraNote ??
              "I'm listening. Tell me what you're looking for, and I'll find something that fits."}
          </MiraNote>

          {/* Primary conversation input - hero position */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative"
          >
            <div
              className="rounded-full border-2 backdrop-blur-lg px-6 sm:px-8 py-4 sm:py-5 flex items-center gap-4 shadow-2xl"
              style={{
                background: "rgba(16,10,8,0.7)",
                borderColor: "rgba(246,239,227,0.2)",
                boxShadow: "0 0 60px rgba(168,90,58,0.15)",
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What kind of retreat are you looking for?"
                disabled={busy}
                className="flex-1 bg-transparent border-none outline-none text-[#f6efe3] placeholder:text-[#f6efe3]/50 text-lg sm:text-xl py-2"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={busy || !input.trim()}
                className="px-6 py-3 rounded-full bg-[#a85a3a] hover:bg-[#c06a48] text-[#f6efe3] text-base font-medium disabled:opacity-40 disabled:hover:bg-[#a85a3a] transition-all duration-200"
              >
                {busy ? "Thinking…" : "Send"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Commit CTA - floating above scroll when active */}
      <AnimatePresence>
        {activeRetreat && hasConversed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <button
              type="button"
              onClick={() => handleCommit(activeRetreat.id)}
              disabled={busy}
              className="px-8 py-4 rounded-full bg-[#a85a3a] hover:bg-[#c06a48] text-[#f6efe3] text-base font-medium disabled:opacity-40 transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-lg"
              style={{
                boxShadow: "0 0 40px rgba(168,90,58,0.4)",
              }}
            >
              Hold {activeRetreat.title.split(" ").slice(0, 2).join(" ")} for 48 hours
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll container - full-screen retreat images */}
      <div ref={containerRef} className="relative z-10">
        {retreats.length > 0 ? (
          retreats.map((retreat, index) => (
            <RetreatImage
              key={retreat.id}
              retreat={retreat}
              index={index}
              total={retreats.length}
              isActive={index === safeIndex}
              onSelect={() => handleSelect(retreat.id, index)}
            />
          ))
        ) : (
          !busy && (
            <div className="h-screen flex items-center justify-center">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-[#f6efe3]/40 text-lg"
              >
                {hasConversed 
                  ? "I'm still thinking. Try refining what you're looking for."
                  : "Start a conversation with me. I'll find something that fits."
                }
              </motion.p>
            </div>
          )
        )}
      </div>
    </MiraOrbProvider>
  );
}
