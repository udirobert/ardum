"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRetreatExploration } from "@/inventory/use-retreat-exploration";
import { useMiraField } from "./MiraField";
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
  busy?: boolean;
}

export default function RetreatExplorationView({
  initialConstraints,
  onConstraintChange,
  retreats: propRetreats,
  miraNote: propMiraNote,
  onUserMessage: propOnUserMessage,
  onCommit: propOnCommit,
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
  const state = isDirectMode ? (propBusy ? "idle" : "idle") : hookResult.state;
  const busy = isDirectMode ? (propBusy ?? false) : (hookResult.state !== "idle");
  
  // Integrate with Mira's field - tell the orb what's happening
  useMiraField({
    activity: busy ? "processing" : "idle",
    veil: 0.2, // Subtle veil for readability without covering the orb
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
    <div className="relative z-10 space-y-8 py-8">
      {/* Mira note */}
      <MiraNote animate>
        {miraNote ??
          "Here are a few places that match the shape of what you described. Scroll through them, and tell me what feels closer."}
      </MiraNote>

      {/* Retreat cards with animated transitions */}
      <AnimatePresence mode="popLayout">
        <motion.div 
          layout
          className="space-y-6"
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          {retreats.map((retreat, index) => (
            <RetreatCard
              key={retreat.id}
              retreat={retreat}
              isActive={index === safeIndex}
              onSelect={() => setActiveIndex(index)}
              className="cursor-pointer"
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Commit CTA when a retreat is selected */}
      <AnimatePresence>
        {activeRetreat && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4"
          >
            <button
              type="button"
              onClick={() => handleCommit(activeRetreat.id)}
              disabled={busy}
              className="px-6 py-3 rounded-sm bg-[#f6efe3] text-[#0c0806] disabled:opacity-40 transition-opacity"
            >
              Hold {activeRetreat.title.split(" ").slice(0, 2).join(" ")} for 48 hours
            </button>
            <p className="text-sm text-[#f6efe3]/70">
              Non-binding. No charge until you confirm.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation input - not sticky, flows naturally */}
      <div className="pt-6">
        <div
          className="max-w-3xl mx-auto rounded-full border backdrop-blur-md px-4 sm:px-6 py-3 flex items-center gap-3"
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
  );
}
