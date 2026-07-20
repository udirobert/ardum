/**
 * Retreat Response - Track A, Phase A2
 * 
 * Re-ranks retreats based on updated constraints and generates a contextual
 * miraNote explaining what changed. This bridges the conversation extractor
 * with the existing ranking service.
 */

import type { Retreat } from "@/inventory/retreat";
import { getRetreatsByConstraints } from "@/inventory/catalog";
import type { IntentionConstraints } from "./constraint-updater";
import type { ExtractedConstraints } from "./conversation-extractor";

export type RetreatResponse = {
  retreats: Retreat[];
  miraNote: string;
};

/**
 * Re-rank retreats based on new constraints and generate a miraNote.
 * 
 * Strategy:
 * 1. Use catalog's constraint-based filtering (Phase A1)
 * 2. Generate contextual note explaining what changed
 * 3. Return top 3 retreats (or fewer if catalog is small)
 * 
 * Future: Integrate with existing score.ts ranking service for more
 * sophisticated matching (breath phase, pose baseline, etc.).
 */
export function generateRetreatResponse(
  constraints: IntentionConstraints,
  extracted: ExtractedConstraints
): RetreatResponse {
  // Get retreats filtered by constraints
  const retreats = getRetreatsByConstraints({
    budget: constraints.budget,
    duration: constraints.duration ? { max: constraints.duration } : undefined,
    social: constraints.social,
    horizon: constraints.horizon || constraints.dates,
  });

  // Limit to top 3
  const topRetreats = retreats.slice(0, 3);

  // Generate contextual note
  const miraNote = generateMiraNote(extracted, topRetreats);

  return {
    retreats: topRetreats,
    miraNote,
  };
}

/**
 * Generate a contextual miraNote explaining what changed.
 * 
 * Strategy: Describe the primary constraint that was applied and how it
 * affected the results. Keep it conversational and reassuring.
 */
function generateMiraNote(
  extracted: ExtractedConstraints,
  retreats: Retreat[]
): string {
  if (retreats.length === 0) {
    return "I'm having trouble finding retreats that match what you're looking for. Let me know if you'd like to adjust what you're looking for.";
  }

  const parts: string[] = [];

  // Budget constraint
  if (extracted.budget) {
    const budgetLabels: Record<string, string> = {
      "under-1k": "under $1,000",
      "1k-2k": "between $1,000 and $2,000",
      "2k-3k": "between $2,000 and $3,000",
      "3k-plus": "$3,000 or more",
    };
    parts.push(`I've focused on retreats ${budgetLabels[extracted.budget] || "within your budget"}.`);
  }

  // Duration constraint
  if (extracted.duration) {
    if (extracted.duration <= 3) {
      parts.push("Here are some shorter options that won't take too much time away.");
    } else if (extracted.duration <= 7) {
      parts.push("These retreats fit within a week.");
    } else {
      parts.push("I've included some longer immersive experiences.");
    }
  }

  // Social constraint
  if (extracted.social) {
    const socialLabels: Record<string, string> = {
      "solo": "These are solo-friendly retreats with plenty of space for solitude.",
      "small-circle": "Here are retreats designed for intimate groups.",
      "open-circle": "These retreats welcome a broader community.",
      "communal": "I've found retreats with a strong communal focus.",
    };
    parts.push(socialLabels[extracted.social] || "");
  }

  // Dates constraint
  if (extracted.dates) {
    const monthNames: Record<string, string> = {
      "01": "January", "02": "February", "03": "March", "04": "April",
      "05": "May", "06": "June", "07": "July", "08": "August",
      "09": "September", "10": "October", "11": "November", "12": "December"
    };
    const monthCode = extracted.dates.split("-")[1];
    const monthName = monthNames[monthCode] || "that timeframe";
    parts.push(`These retreats are scheduled in ${monthName}.`);
  }

  // Energy constraint
  if (extracted.energy) {
    const energyLabels: Record<string, string> = {
      "settled": "These retreats have a calm, restorative energy.",
      "in-movement": "These retreats offer dynamic, flowing practices.",
      "low": "These retreats are designed for deep rest and recovery.",
      "sharp": "These retreats provide intense, transformative experiences.",
    };
    parts.push(energyLabels[extracted.energy] || "");
  }

  // If no specific constraints, provide a general note
  if (parts.length === 0) {
    return "Here are some retreats that might resonate with you. Let me know what feels right or what you'd like to adjust.";
  }

  // Combine parts into a cohesive note
  return parts.join(" ") + " Do any of these feel like they might work for you?";
}

/**
 * Compare old and new retreat lists to determine what changed.
 * Useful for understanding the impact of constraint updates.
 */
export function compareRetreatLists(
  oldRetreats: Retreat[],
  newRetreats: Retreat[]
): {
  added: Retreat[];
  removed: Retreat[];
  unchanged: Retreat[];
} {
  const oldIds = new Set(oldRetreats.map(r => r.id));
  const newIds = new Set(newRetreats.map(r => r.id));

  const added = newRetreats.filter(r => !oldIds.has(r.id));
  const removed = oldRetreats.filter(r => !newIds.has(r.id));
  const unchanged = newRetreats.filter(r => oldIds.has(r.id));

  return { added, removed, unchanged };
}
