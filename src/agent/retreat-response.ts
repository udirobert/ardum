/**
 * Retreat Response — recommendation letter source.
 *
 * Produces the singular Mira letter for Beat 2 (recommendation reveal)
 * and the one-line differentiating reasons for Beat 3 (alternatives).
 * See docs/design/recommendation-reveal.md and refinement-alternatives.md
 * for the copy contract.
 *
 * Contract for the Beat 2 letter:
 * - singular, never plural ("this one", not "these retreats");
 * - names ≥1 constraint the practitioner articulated;
 * - names 1 specific reason Mira chose this over alternatives;
 * - ≤40 words;
 * - never "what stands out to you?" or "might resonate" — ranking is
 *   Mira's job, not handed back to the user.
 */

import type { Retreat } from "@/inventory/retreat";
import { getRetreatsByConstraints } from "@/inventory/catalog";
import { mergeConstraints, type IntentionConstraints } from "./constraint-updater";
import type { ExtractedConstraints } from "./conversation-extractor";

export type Recommendation = {
  /** The single retreat Mira is presenting as her strongest current fit. */
  retreat: Retreat;
  /** The Beat 2 letter — why this one, for this intention. */
  letter: string;
  /** The ranked alternatives Mira is weighing (Beat 3 set), excluding the top pick. */
  alternatives: Array<{ retreat: Retreat; reason: string }>;
};

/**
 * Build the recommendation for the current episode constraints.
 *
 * Returns the top-ranked retreat, its letter, and a bounded set of
 * alternatives with one-line differentiating reasons. This replaces the
 * legacy `generateRetreatResponse` which returned a plural list and a
 * generic note.
 */
export function buildRecommendation(
  constraints: IntentionConstraints,
  extracted?: ExtractedConstraints
): Recommendation | null {
  // Rank against the merged constraints so the top pick reflects what the
  // user just said, not just the cumulative episode state. The letter
  // still echoes `extracted` distinctly so "what just changed" reads first.
  const merged = extracted ? mergeConstraints(constraints, extracted) : constraints;

  const ranked = getRetreatsByConstraints({
    budget: merged.budget,
    duration: merged.duration ? { max: merged.duration } : undefined,
    social: merged.social,
    horizon: merged.horizon || merged.dates,
  });

  if (ranked.length === 0) {
    return null;
  }

  const [top, ...rest] = ranked;
  const letter = generateRecommendationLetter(top, merged, extracted);
  const alternatives = rest.slice(0, 4).map((retreat) => ({
    retreat,
    reason: generateAlternativeReason(retreat, top),
  }));

  return { retreat: top, letter, alternatives };
}

/**
 * Generate the Beat 2 letter for a single retreat.
 *
 * Structure: "[constraint echo]. [reason over alternatives]."
 * Both clauses are required; the letter is incomplete without a reason.
 */
export function generateRecommendationLetter(
  retreat: Retreat,
  constraints: IntentionConstraints,
  extracted?: ExtractedConstraints
): string {
  const constraintPhrase = buildConstraintPhrase(constraints, extracted);
  const reasonPhrase = buildReasonPhrase(retreat, constraints);

  if (!constraintPhrase && !reasonPhrase) {
    // No constraints and no differentiating reason — fall back to a
    // specific retreat attribute rather than a generic "might resonate."
    return `This one sits close. ${retreat.operator.name} has held this kind of space before — ${shorten(retreat.operator.bio)}.`;
  }

  if (!constraintPhrase) {
    return `This one sits close. ${terminate(capitalize(reasonPhrase))}`;
  }

  if (!reasonPhrase) {
    return `${constraintPhrase}. ${retreat.title} fits that.`;
  }

  return `${constraintPhrase}. ${terminate(capitalize(reasonPhrase))}`;
}

/** Add a closing period only if the clause doesn't already end with punctuation. */
function terminate(clause: string): string {
  return /[.!?…]$/.test(clause.trim()) ? clause : `${clause}.`;
}

/**
 * Generate a one-line differentiating reason for an alternative.
 *
 * Names how this retreat differs from the current top pick — never a
 * brochure sentence, never generic. Used on Beat 3 cards.
 */
export function generateAlternativeReason(
  retreat: Retreat,
  topPick: Retreat
): string {
  if (retreat.id === topPick.id) {
    return "The one I'm presenting.";
  }

  const diffs: string[] = [];

  // Duration difference
  const durDelta = retreat.dates.duration - topPick.dates.duration;
  if (durDelta <= -2) diffs.push("shorter");
  else if (durDelta >= 2) diffs.push("longer container");

  // Price difference
  const priceDelta = retreat.price.amount - topPick.price.amount;
  if (priceDelta <= -300) diffs.push("less costly");
  else if (priceDelta >= 300) diffs.push("higher investment");

  // Social difference
  if (retreat.fit?.social && retreat.fit.social !== topPick.fit?.social) {
    diffs.push(socialLabel(retreat.fit.social));
  }

  // Energy difference
  if (retreat.fit?.energy && retreat.fit.energy !== topPick.fit?.energy) {
    diffs.push(energyLabel(retreat.fit.energy));
  }

  // Location character as a final differentiator
  if (diffs.length === 0) {
    return `${locationCharacter(retreat)} — ${retreat.location.split(",")[0]}.`;
  }

  // Compose: lead with the strongest diff, anchor with location character
  const lead = diffs[0];
  const anchor = locationCharacter(retreat);
  return `${capitalize(lead)}, ${anchor}.`;
}

// ──────────────────────────────────────────────────────────────────────
// Constraint phrase — echoes what the practitioner named.
// Uses `extracted` (what just changed) when available, falls back to
// cumulative `constraints`.
// ──────────────────────────────────────────────────────────────────────

function buildConstraintPhrase(
  constraints: IntentionConstraints,
  extracted?: ExtractedConstraints
): string {
  const parts: string[] = [];

  const budget = extracted?.budget ?? constraints.budget;
  if (budget) parts.push(budgetPhrase(budget));

  const duration = extracted?.duration ?? constraints.duration;
  if (duration) parts.push(durationPhrase(duration));

  const social = extracted?.social ?? constraints.social;
  if (social) parts.push(socialPhrase(social));

  const horizon = extracted?.dates ?? constraints.horizon ?? constraints.dates;
  if (horizon) parts.push(horizonPhrase(horizon));

  const energy = extracted?.energy ?? constraints.energy;
  if (energy) parts.push(energyPhrase(energy));

  if (parts.length === 0) return "";

  // Lead with the most recently articulated constraint when available.
  if (extracted) {
    const lead = leadFromExtracted(extracted);
    if (lead) {
      const rest = parts.filter((p) => p !== lead);
      return rest.length > 0 ? `${lead}, ${lower(rest.join(", "))}` : lead;
    }
  }

  return parts.join(", ");
}

function leadFromExtracted(extracted: ExtractedConstraints): string | null {
  if (extracted.budget) return budgetPhrase(extracted.budget);
  if (extracted.duration) return durationPhrase(extracted.duration);
  if (extracted.social) return socialPhrase(extracted.social);
  if (extracted.dates) return horizonPhrase(extracted.dates);
  if (extracted.energy) return energyPhrase(extracted.energy);
  return null;
}

function budgetPhrase(budget: string): string {
  switch (budget) {
    case "under-1k": return "under $1,000";
    case "1k-2k": return "around $1,000–2,000";
    case "2k-3k": return "around $2,000–3,000";
    case "3k-plus": return "without a hard ceiling on cost";
    default: return "within your budget";
  }
}

function durationPhrase(days: number): string {
  if (days <= 3) return "a long weekend";
  if (days <= 5) return "a few days";
  if (days <= 7) return "about a week";
  return "a longer immersion";
}

function socialPhrase(social: string): string {
  switch (social) {
    case "solo": return "on your own";
    case "small-circle": return "with a small circle";
    case "open-circle": return "in a wider group";
    case "communal": return "in community";
    default: return "";
  }
}

function horizonPhrase(horizon: string): string {
  const monthNames: Record<string, string> = {
    "01": "January", "02": "February", "03": "March", "04": "April",
    "05": "May", "06": "June", "07": "July", "08": "August",
    "09": "September", "10": "October", "11": "November", "12": "December",
  };
  const monthCode = horizon.split("-")[1];
  const monthName = monthNames[monthCode];
  return monthName ? `in ${monthName}` : "in that timeframe";
}

function energyPhrase(energy: string): string {
  switch (energy) {
    case "settled": return "a settled energy";
    case "in-movement": return "something in movement";
    case "low": return "deep rest";
    case "sharp": return "something sharp and transformative";
    default: return "";
  }
}

// ──────────────────────────────────────────────────────────────────────
// Reason phrase — why this retreat, over the alternatives.
// Pulls a specific attribute from the retreat that ties to a constraint.
// ──────────────────────────────────────────────────────────────────────

function buildReasonPhrase(
  retreat: Retreat,
  constraints: IntentionConstraints
): string {
  // Solo: capacity.min === 1 is the strongest signal
  if (constraints.social === "solo" && retreat.capacity.min === 1) {
    return `${retreat.title} is built for one — ${lower(shorten(retreat.description))}`;
  }

  // Energy match via fit tag
  if (constraints.energy && retreat.fit?.energy === constraints.energy) {
    const energyWord = energyLabel(constraints.energy);
    return `${retreat.operator.name} works specifically with ${energyWord} practice`;
  }

  // Budget match: retreat sits comfortably under the band ceiling
  if (constraints.budget) {
    const ceiling = budgetCeiling(constraints.budget);
    if (ceiling && retreat.price.amount <= ceiling * 0.85) {
      return `${retreat.title} sits well under your ceiling at $${retreat.price.amount.toLocaleString()}`;
    }
  }

  // Duration match
  if (constraints.duration && retreat.dates.duration <= constraints.duration) {
    return `${retreat.dates.duration} days — the right length for what you named`;
  }

  // Horizon match — only as a supporting clause, never the sole reason.
  // A horizon match alone just restates the constraint; it is not a
  // reason *over alternatives*. Combine with operator track record, or
  // fall through to operator track record alone.
  if (constraints.horizon && retreat.dates.start.startsWith(constraints.horizon)) {
    if (retreat.operator.bio) {
      return `${retreat.operator.name} runs this in the window you named — ${shorten(retreat.operator.bio)}`;
    }
    return `${retreat.title} runs in the window you named`;
  }

  // Fallback: operator track record as the differentiator
  if (retreat.operator.bio) {
    return `${retreat.operator.name} has held this kind of space before`;
  }

  return "";
}

function budgetCeiling(budget: string): number | null {
  switch (budget) {
    case "under-1k": return 1000;
    case "1k-2k": return 2000;
    case "2k-3k": return 3000;
    case "3k-plus": return null;
    default: return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Shared labels for alternative reasons
// ──────────────────────────────────────────────────────────────────────

function socialLabel(social: string): string {
  switch (social) {
    case "solo": return "solo";
    case "small-circle": return "small circle";
    case "open-circle": return "wider group";
    case "communal": return "communal";
    default: return "";
  }
}

function energyLabel(energy: string): string {
  switch (energy) {
    case "settled": return "settled";
    case "in-movement": return "in movement";
    case "low": return "deep rest";
    case "sharp": return "sharp";
    default: return "";
  }
}

function locationCharacter(retreat: Retreat): string {
  const loc = retreat.location.toLowerCase();
  if (loc.includes("forest") || loc.includes("pacific northwest")) return "forest solitude";
  if (loc.includes("ocean") || loc.includes("bali") || loc.includes("algarve") || loc.includes("coast")) return "ocean";
  if (loc.includes("mountain") || loc.includes("himalayan")) return "mountain silence";
  if (loc.includes("desert") || loc.includes("sedona")) return "desert";
  return retreat.location.split(",")[0].toLowerCase();
}

// ──────────────────────────────────────────────────────────────────────
// Small text helpers
// ──────────────────────────────────────────────────────────────────────

/** Trim a long passage to a clause that fits the letter's word budget.
 * Prefers cutting at a sentence boundary; falls back to a word cut with
 * an ellipsis so the result never ends mid-sentence. */
function shorten(text: string, maxWords = 12): string {
  const trimmed = text.trim().replace(/\.$/, "");
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;

  const candidate = words.slice(0, maxWords).join(" ");
  // If the candidate contains a sentence boundary, cut there.
  const sentenceBreak = candidate.match(/.*[.!?]/);
  if (sentenceBreak && sentenceBreak[0].split(/\s+/).length >= 4) {
    return sentenceBreak[0].replace(/[.!?]$/, "");
  }
  // Otherwise cut at the last comma if it's deep enough, else ellipsis.
  const commaBreak = candidate.match(/.*,/);
  if (commaBreak && commaBreak[0].split(/\s+/).length >= 6) {
    return commaBreak[0].replace(/,$/, "");
  }
  return `${candidate}…`;
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ──────────────────────────────────────────────────────────────────────
// Legacy exports — kept for backward compatibility while callers migrate.
// `generateRetreatResponse` and `generateMiraNote` are superseded by
// `buildRecommendation` and `generateRecommendationLetter`. Do not add
// new callers of the legacy exports.
// ──────────────────────────────────────────────────────────────────────

/** @deprecated Use buildRecommendation. */
export function generateRetreatResponse(
  constraints: IntentionConstraints,
  extracted: ExtractedConstraints
): { retreats: Retreat[]; miraNote: string } {
  const rec = buildRecommendation(constraints, extracted);
  if (!rec) {
    return {
      retreats: [],
      miraNote: "I'm having trouble finding retreats that match what you're looking for. Let me know if you'd like to adjust what you're looking for.",
    };
  }
  return {
    retreats: [rec.retreat, ...rec.alternatives.map((a) => a.retreat)],
    miraNote: rec.letter,
  };
}

/** @deprecated Use generateRecommendationLetter. */
export function generateMiraNote(
  _extracted: ExtractedConstraints,
  retreats: Retreat[]
): string {
  if (retreats.length === 0) {
    return "I'm having trouble finding retreats that match what you're looking for. Let me know if you'd like to adjust what you're looking for.";
  }
  return generateRecommendationLetter(retreats[0], {});
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
