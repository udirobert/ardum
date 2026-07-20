"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllRetreats } from "./catalog";
import { extractConstraints } from "@/agent/conversation-extractor";
import { mergeConstraints, type IntentionConstraints } from "@/agent/constraint-updater";
import type { Retreat } from "./retreat";

type ExplorationState = "idle" | "extracting" | "updating" | "transitioning";

export function useRetreatExploration(initialConstraints?: IntentionConstraints) {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [constraints, setConstraints] = useState<IntentionConstraints>(initialConstraints || {});
  const [miraNote, setMiraNote] = useState<string>("");
  const [state, setState] = useState<ExplorationState>("idle");

  // Load initial retreats
  useEffect(() => {
    const loadRetreats = async () => {
      const allRetreats = getAllRetreats();
      setRetreats(allRetreats);
      setMiraNote("Here are some retreats that might resonate with your intention. What stands out to you?");
    };
    loadRetreats();
  }, []);

  const onUserMessage = useCallback(async (message: string) => {
    setState("extracting");
    
    // Extract constraints from natural language
    const extracted = extractConstraints(message);
    
    if (Object.keys(extracted).length === 0) {
      setMiraNote("I'd love to understand better. Could you tell me more about what feels important to you?");
      setState("idle");
      return;
    }

    setState("updating");
    
    // Update constraints
    const newConstraints = mergeConstraints(constraints, extracted);
    setConstraints(newConstraints);
    
    // Load filtered retreats
    const filteredRetreats = getAllRetreats(); // TODO: filter by constraints
    
    setState("transitioning");
    
    // Brief delay for transition animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setRetreats(filteredRetreats);
    
    // Generate contextual note
    const noteMessages = [
      "I've found some options that might feel closer to what you're looking for.",
      "These retreats seem to align better with what you've shared.",
      "Here are some possibilities that might resonate more deeply.",
    ];
    setMiraNote(noteMessages[Math.floor(Math.random() * noteMessages.length)]);
    
    setState("idle");
  }, [constraints]);

  const onCommit = useCallback((retreatId: string) => {
    const retreat = retreats.find(r => r.id === retreatId);
    if (retreat) {
      setMiraNote(`Great choice. ${retreat.title} feels like it could be a meaningful step forward. I'll help you secure this for the next 48 hours.`);
      // TODO: Trigger actual commitment flow
      console.log("Committing to retreat:", retreatId);
    }
  }, [retreats]);

  return {
    retreats,
    miraNote,
    state,
    constraints,
    onUserMessage,
    onCommit,
  };
}
