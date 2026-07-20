/**
 * Conversation Extractor - Track A, Phase A2
 * 
 * Parses natural language reactions to retreats into structured constraints
 * that map to the existing episode model (IntentionConstraints).
 * 
 * This is a keyword-based implementation for the demo. Phase A4 will replace
 * with LLM-based extraction for more nuanced understanding.
 * 
 * Examples:
 * - "That's too expensive" → { budget: "under-1k" }
 * - "I need something shorter" → { duration: 4 }
 * - "I'd prefer to go alone" → { social: "solo" }
 * - "Maybe in September?" → { dates: "2026-09" }
 */

import type { EnergyState, BudgetBand, SocialComfort } from "@/calibration/schema";

export type ExtractedConstraints = {
  energy?: EnergyState;
  budget?: BudgetBand;
  social?: SocialComfort;
  duration?: number; // max days
  dates?: string; // YYYY-MM prefix
};

/**
 * Extract structured constraints from a natural language user message.
 * 
 * Strategy: Keyword matching with priority order:
 * 1. Budget (most common reaction: "too expensive", "cheaper", "budget")
 * 2. Duration ("shorter", "longer", "weekend", "week")
 * 3. Social ("alone", "solo", "group", "private")
 * 4. Dates ("September", "October", "fall", "next month")
 * 5. Energy ("quiet", "calm", "intense", "restorative")
 * 
 * Returns empty object if no constraints extracted (fallback to clarification).
 */
export function extractConstraints(message: string): ExtractedConstraints {
  const lower = message.toLowerCase();
  const constraints: ExtractedConstraints = {};

  // Budget extraction
  if (matchesAny(lower, ["expensive", "cheap", "affordable", "budget", "cost", "price", "money"])) {
    if (matchesAny(lower, ["too expensive", "cheaper", "less", "lower", "more affordable", "under 1000", "under $1000"])) {
      constraints.budget = "under-1k";
    } else if (matchesAny(lower, ["1000", "1k", "thousand"])) {
      constraints.budget = "1k-2k";
    } else if (matchesAny(lower, ["2000", "2k", "two thousand"])) {
      constraints.budget = "2k-3k";
    } else if (matchesAny(lower, ["3000", "3k", "three thousand", "premium", "luxury", "splurge"])) {
      constraints.budget = "3k-plus";
    }
  }

  // Duration extraction
  if (matchesAny(lower, ["shorter", "short", "less time", "fewer days", "quick"])) {
    if (matchesAny(lower, ["weekend", "2 days", "two days", "couple days"])) {
      constraints.duration = 2;
    } else if (matchesAny(lower, ["3 days", "three days", "long weekend"])) {
      constraints.duration = 3;
    } else if (matchesAny(lower, ["4 days", "four days", "less than a week"])) {
      constraints.duration = 4;
    } else {
      constraints.duration = 5; // default "shorter" to 5 days
    }
  } else if (matchesAny(lower, ["longer", "more time", "extended", "week"])) {
    if (matchesAny(lower, ["2 weeks", "two weeks", "14 days"])) {
      constraints.duration = 14;
    } else {
      constraints.duration = 7; // default "longer" to 1 week
    }
  }

  // Social extraction
  if (matchesAny(lower, ["alone", "solo", "by myself", "private", "just me"])) {
    constraints.social = "solo";
  } else if (matchesAny(lower, ["with someone", "partner", "friend", "couple"])) {
    constraints.social = "small-circle";
  } else if (matchesAny(lower, ["group", "community", "others", "people"])) {
    constraints.social = "open-circle";
  }

  // Dates extraction
  const monthMatch = extractMonth(lower);
  if (monthMatch) {
    constraints.dates = monthMatch;
  }

  // Energy extraction (less common, but included for completeness)
  if (matchesAny(lower, ["quiet", "calm", "peaceful", "rest", "restore", "gentle"])) {
    constraints.energy = "settled";
  } else if (matchesAny(lower, ["intense", "deep", "transformative", "challenging"])) {
    constraints.energy = "sharp";
  } else if (matchesAny(lower, ["active", "movement", "flow", "dynamic"])) {
    constraints.energy = "in-movement";
  } else if (matchesAny(lower, ["tired", "exhausted", "recover", "healing"])) {
    constraints.energy = "low";
  }

  return constraints;
}

/**
 * Check if text matches any of the keywords.
 */
function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Extract month from text and return as YYYY-MM prefix.
 * 
 * Handles:
 * - Month names: "September", "October", "November"
 * - Relative: "next month", "this fall"
 * - Defaults to 2026 for demo purposes
 */
function extractMonth(text: string): string | null {
  const months: Record<string, string> = {
    "january": "01",
    "february": "02",
    "march": "03",
    "april": "04",
    "may": "05",
    "june": "06",
    "july": "07",
    "august": "08",
    "september": "09",
    "october": "10",
    "november": "11",
    "december": "12",
  };

  for (const [month, code] of Object.entries(months)) {
    if (text.includes(month)) {
      return `2026-${code}`;
    }
  }

  // Relative months
  if (text.includes("next month")) {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  }

  if (text.includes("fall") || text.includes("autumn")) {
    return "2026-10"; // October as default fall month
  }

  return null;
}

/**
 * Check if extraction produced any constraints.
 * Used to determine if we need to ask for clarification.
 */
export function hasConstraints(constraints: ExtractedConstraints): boolean {
  return Object.keys(constraints).length > 0;
}
