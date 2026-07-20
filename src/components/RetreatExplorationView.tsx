"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRetreatExploration } from "@/inventory/use-retreat-exploration";
import { useMiraField } from "./MiraField";
import MiraFreeRoamOrb from "./MiraFreeRoamOrb";
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
  
  // Integrate with Mira's field - enable free-roam mode for this experience
  useMiraField({
    activity: busy ? "processing" : "idle",
    freeRoam: true, // Orb moves independently across viewport
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
    <>
      {/* Free-roaming Mira orb - moves independently across viewport */}
      <MiraFreeRoamOrb
        presence={null}
        activity={busy ? "processing" : "idle"}
        scrollProgress={scrollProgress}
        scrollVelocity={scrollVelocity}
        activeTarget={activeTarget}
        busy={busy}
      />

      {/* Content with glass transparency - orb passes behind cards */}
      <div ref={containerRef} className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 py-8 px-6 sm:px-10">
      {/* Left column: Mira + input, sticky on desktop */}
      <div className="lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto space-y-8 order-2 lg:order-1">
        <MiraNote animate>
          {miraNote ??
            "Here are a few places that match the shape of what you described. Scroll through them, and tell me what feels closer."}
        </MiraNote>

        {/* Commit CTA when a retreat is selected */}
        <AnimatePresence>
          {activeRetreat && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4"
            >
              <button
                type="button"
                onClick={() => handleCommit(activeRetreat.id)}
                disabled={busy}
                className="px-6 py-3 rounded-sm bg-[#f6efe3] text-[#0c0806] disabled:opacity-40 transition-opacity w-full sm:w-auto"
              >
                Hold {activeRetreat.title.split(" ").slice(0, 2).join(" ")} for 48 hours
              </button>
              <p className="text-sm text-[#f6efe3]/70">
                Non-binding. No charge until you confirm.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation input - part of the sticky left column on desktop */}
        <div className="pt-2">
          <div
            className="max-w-3xl mx-auto lg:mx-0 rounded-full border backdrop-blur-md px-4 sm:px-6 py-3 flex items-center gap-3"
            style={{
              background: "rgba(16,10,8,0.6)",
              borderColor: "rgba(246,239,227,0.15)",
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell Mira what feels closer…"
              disabled={busy}
              className="flex-1 bg-transparent border-none outline-none text-[#f6efe3] placeholder:text-[#f6efe3]/40 text-base py-2"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !input.trim()}
              className="px-4 py-2 rounded-full bg-[#a85a3a] text-[#f6efe3] text-sm font-medium disabled:opacity-40 transition-opacity"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>

      {/* Right column: scrollable retreat cards */}
      <div className="order-1 lg:order-2">
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="space-y-6"
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
      </div>
      </div>
    </>
  );
}
