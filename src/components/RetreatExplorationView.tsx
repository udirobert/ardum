"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRetreatExploration } from "@/inventory/use-retreat-exploration";
import { useMiraField } from "./MiraField";
import { MiraOrbProvider } from "./MiraOrbContext";
import type { IntentionConstraints } from "@/agent/constraint-updater";
import type { Retreat } from "@/inventory/retreat";
import RetreatCard from "./RetreatCard";
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
    const velocity = Math.abs(value - prevValue) * 1000; // Scale up for sensitivity
    setScrollVelocity(velocity);
  });
  
  // Track active retreat position for orb attraction
  const [activeTarget, setActiveTarget] = useState<{ x: number; y: number } | null>(null);
  const [hasConversed, setHasConversed] = useState(false);
  
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
    
    // Track the selected retreat's position for orb attraction
    const card = document.querySelector(`[data-retreat-id="${retreatId}"]`);
    if (card) {
      const rect = card.getBoundingClientRect();
      setActiveTarget({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  };
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [input, setInput] = useState("");

  const safeIndex = Math.min(activeIndex, Math.max(0, retreats.length - 1));
  const activeRetreat = retreats[safeIndex] ?? null;

  const handleSend = () => {
    if (!input.trim() || busy) return;
    handleUserMessage(input.trim());
    setInput("");
    setActiveIndex(0); // Reset to first card when results change
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <MiraOrbProvider>
      {/* Conversation-first layout: Mira leads, cards respond */}
      <div ref={containerRef} className="relative z-10 max-w-4xl mx-auto py-12 px-6 sm:px-10">
        
        {/* Hero section: Mira's presence + conversation input */}
        <div className="space-y-8 mb-16">
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

        {/* Response section: Cards appear as Mira's curated response */}
        {retreats.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="space-y-6"
          >
            {/* Response header - subtle, not commanding */}
            <div className="flex items-baseline justify-between mb-6">
              <p className="text-[#f6efe3]/60 text-sm">
                {hasConversed ? "Here's what I found for you:" : "Some possibilities I've been considering:"}
              </p>
              {hasConversed && (
                <button
                  type="button"
                  onClick={() => setHasConversed(false)}
                  className="text-[#a85a3a] hover:text-[#c06a48] text-sm transition-colors"
                >
                  Refine search
                </button>
              )}
            </div>

            {/* Cards as response - list style, less pick-a-card emphasis */}
            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                className="space-y-4"
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                {retreats.map((retreat, index) => (
                  <RetreatCard
                    key={retreat.id}
                    retreat={retreat}
                    isActive={index === safeIndex}
                    onSelect={() => handleSelect(retreat.id, index)}
                    className="cursor-pointer"
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Commit CTA - appears after engagement, not immediately */}
            <AnimatePresence>
              {activeRetreat && hasConversed && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="mt-8 pt-8 border-t border-[#f6efe3]/10"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleCommit(activeRetreat.id)}
                      disabled={busy}
                      className="px-8 py-4 rounded-full bg-[#a85a3a] hover:bg-[#c06a48] text-[#f6efe3] text-base font-medium disabled:opacity-40 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Hold {activeRetreat.title.split(" ").slice(0, 2).join(" ")} for 48 hours
                    </button>
                    <p className="text-sm text-[#f6efe3]/60">
                      Non-binding. No charge until you confirm.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty state: encourage conversation when no retreats */}
        {retreats.length === 0 && !busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center py-16"
          >
            <p className="text-[#f6efe3]/40 text-lg">
              {hasConversed 
                ? "I'm still thinking. Try refining what you're looking for."
                : "Start a conversation with me. I'll find something that fits."
              }
            </p>
          </motion.div>
        )}
      </div>
    </MiraOrbProvider>
  );
}
