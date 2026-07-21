// Pure scoring logic — extracted so both the synchronous runMatchAgent
// and the SSE streaming variant can share the same reasoning. No I/O,
// no env access, no globals. Pure functions only.
//
// Each reasoning step is structured as Gherkin (Given / When / Then) so
// the agent's logic is inspectable: what we observed, what rule fired,
// what we concluded.
//
// Axes are registered once in AXES below. scoreRetreat walks the registry
// and asks each axis to evaluate, skipping axes that don't apply to a
// given (practitioner, retreat) pair. The same registry feeds the LLM
// prompt in ./prompts.ts, so the local scorer and the model are always
// told to apply the same rules.

import type {
  AttestationIndex,
  BreathCycle,
} from "@/attestation/schema";
import type {
  MatchResult,
  ReasoningStep,
} from "@/matching/types";
import type {
  PoseBaseline,
  PractitionerProfile,
} from "@/calibration/schema";

export type ScoredAttestation = {
  result: MatchResult;
  steps: ReasoningStep[];
};

type AxisResult = {
  given: string;
  when: string;
  then: string;
  // Per-axis 0..1 score. Returned even for display-only axes so the
  // composite math can use it; display-only axes weight = 0 in the
  // composite.
  score: number;
};

type Axis = {
  name: string;
  // Contribution to the composite score. 0 means display-only.
  weight: number;
  // Plain-language description of the rule, fed to the LLM prompt so the
  // model is told exactly what the local scorer will compute.
  describe(): string;
  // Returns null if the axis doesn't apply to this (practitioner, retreat)
  // pair. Otherwise returns the Gherkin step + per-axis score.
  apply(p: PractitionerProfile, a: AttestationIndex): AxisResult | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function cycleCharacter(cycle: BreathCycle): {
  character: "extended" | "even" | "shallow";
  avgSeconds: number;
  ratio: string;
} {
  let totalLen = 0;
  let totalRepeat = 0;
  for (const seg of cycle.cycle) {
    totalLen +=
      (seg.inhale + seg.retain + seg.exhale + seg.sustain) * seg.repeat;
    totalRepeat += seg.repeat;
  }
  const avgSeconds = totalRepeat > 0 ? totalLen / totalRepeat : 0;
  const character: "extended" | "even" | "shallow" =
    avgSeconds > 10 ? "extended" : avgSeconds < 5 ? "shallow" : "even";
  return { character, avgSeconds, ratio: cycle.ratio };
}

function cycleMatch(
  practitionerBreath: PoseBaseline["breathPhase"],
  cycle: BreathCycle
): { match: boolean; detail: string } {
  const { character, avgSeconds, ratio } = cycleCharacter(cycle);
  const match = character === practitionerBreath;
  return {
    match,
    detail: `${character} (avg ${avgSeconds.toFixed(1)}s/cycle, ratio ${ratio})`,
  };
}

const BUDGET_LIMITS: Record<string, number> = {
  "under-1k": 1000,
  "1k-2k": 2000,
  "2k-3k": 3000,
  "3k-plus": Infinity,
};

function budgetVerdict(band: string, priceUsd: number): AxisResult {
  const ceiling = BUDGET_LIMITS[band] ?? Infinity;
  const given = `Retreat $${priceUsd.toLocaleString()}. Practitioner band: ${band}.`;
  if (priceUsd <= ceiling) {
    return {
      score: 1,
      given,
      when: "Price fits inside the band's ceiling.",
      then: "Budget constraint satisfied.",
    };
  }
  const overshoot = (priceUsd - ceiling) / ceiling;
  const pct = Math.round(overshoot * 100);
  if (overshoot < 0.2) {
    return {
      score: 0.6,
      given,
      when: `Price exceeds ${band} ceiling by ${pct}%.`,
      then: "Slightly above stated band — still workable.",
    };
  }
  if (overshoot < 0.5) {
    return {
      score: 0.3,
      given,
      when: `Price exceeds ${band} ceiling by ${pct}%.`,
      then: "Notably above stated band — a real stretch.",
    };
  }
  return {
    score: 0.05,
    given,
    when: `Price exceeds ${band} ceiling by ${pct}%.`,
    then: "Well outside stated band.",
  };
}

const FLOW_STYLES = ["vinyasa", "ashtanga", "power vinyasa"];
const GENTLE_STYLES = ["restorative", "yin", "meditation", "pranayama"];

// ─── Axis definitions ────────────────────────────────────────────────────

const energyAxis: Axis = {
  name: "Energy alignment",
  weight: 0.35,
  describe() {
    return "Energy alignment (weight 0.35): strong fit when the retreat's `energyFit` includes the practitioner's stated energy. Output axis name 'Energy alignment'.";
  },
  apply(p, a) {
    const match = a.claims.energyFit.includes(p.energy);
    return {
      score: match ? 1 : 0,
      given: `Practitioner energy: ${p.energy}. Retreat fits: ${a.claims.energyFit.join(", ")}.`,
      when: match
        ? `Both list '${p.energy}' — direct match.`
        : `'${p.energy}' is not in the retreat's energy register.`,
      then: match
        ? "Strong energy fit; pulls toward this match."
        : "Energy register doesn't match; retreat will feel mis-pitched.",
    };
  },
};

const socialAxis: Axis = {
  name: "Social comfort",
  weight: 0.25,
  describe() {
    return "Social comfort (weight 0.25): fit when the retreat's `socialFit` includes the practitioner's stated social comfort. Output axis name 'Social comfort'.";
  },
  apply(p, a) {
    const match = a.claims.socialFit.includes(p.social);
    return {
      score: match ? 1 : 0,
      given: `Practitioner comfort: ${p.social}. Retreat fits: ${a.claims.socialFit.join(", ")}. Cohort: ${a.claims.capacity}.`,
      when: match
        ? "Practitioner's comfort overlaps the retreat's social register."
        : "No overlap in stated social registers.",
      then: match
        ? "Cohort shape matches stated comfort — won't feel draining or underwhelming."
        : "Cohort shape is mismatched; expect social friction.",
    };
  },
};

const budgetAxis: Axis = {
  name: "Budget",
  weight: 0.15,
  describe() {
    return `Budget (weight 0.15): score 1.0 if price ≤ band ceiling, 0.6 if within 20% over, 0.3 if within 50% over, 0.05 otherwise. Bands: ${Object.entries(BUDGET_LIMITS)
      .map(([b, c]) => `${b} ≤ $${c === Infinity ? "∞" : c.toLocaleString()}`)
      .join(", ")}. Output axis name 'Budget'.`;
  },
  apply(p, a) {
    return budgetVerdict(p.budget, a.claims.priceUsd);
  },
};

const breathAxis: Axis = {
  name: "Breath & practice",
  weight: 0.15,
  describe() {
    return "Breath & practice (weight 0.15 when a pose baseline exists, else 0.10): if a pose baseline is present, score 1.0 when retreat's `breathPhase` includes the practitioner's breath phase, 0 otherwise. If no pose baseline, emit a step explaining the axis was skipped. Output axis name 'Breath & practice'.";
  },
  apply(p, a) {
    if (!p.pose) {
      return {
        score: 0,
        given: `No pose baseline provided. Stated energy: ${p.energy}.`,
        when: "Without a pose sample, the agent reasons from stated energy alone.",
        then: "Skipped the breath/mobility axes — match is less precise.",
      };
    }
    const match = a.claims.breathPhase.includes(p.pose.breathPhase);
    return {
      score: match ? 1 : 0,
      given: `Baseline breath: ${p.pose.breathPhase}. Retreat breath: ${a.claims.breathPhase.join(", ")}.`,
      when: match
        ? `Both list '${p.pose.breathPhase}' — direct match.`
        : `Baseline '${p.pose.breathPhase}' not in the retreat's breath register.`,
      then: match
        ? "Breath phase is in this retreat's wheelhouse."
        : "Breath phase is out of register — body work may feel off.",
    };
  },
};

const breathCycleAxis: Axis = {
  name: "Breath cycle",
  weight: 0,
  describe() {
    return "Breath cycle (weight 0 — display only, not part of composite): if the retreat has a structured breath cycle AND the practitioner has a pose baseline, compare the computed cycle character (avg seconds per cycle: >10s = extended, <5s = shallow, else even) to the practitioner's breath phase. Output axis name 'Breath cycle'. Skip if either side is missing.";
  },
  apply(p, a) {
    if (!p.pose || !a.claims.breathCycle) return null;
    const cm = cycleMatch(p.pose.breathPhase, a.claims.breathCycle);
    return {
      score: cm.match ? 1 : 0,
      given: `Baseline breath phase: ${p.pose.breathPhase}. Retreat breath cycle: ${cm.detail}.`,
      when: cm.match
        ? "Computed cycle character matches the practitioner's baseline phase."
        : "Computed cycle character doesn't match the practitioner's baseline phase.",
      then: cm.match
        ? "Actual cycle timing aligns with the practitioner's baseline."
        : "Actual cycle timing is out of register with the practitioner's baseline.",
    };
  },
};

const mobilityAxis: Axis = {
  name: "Mobility hint",
  weight: 0,
  describe() {
    return `Mobility hint (weight 0 — display only): if practitioner has a pose baseline, evaluate mobility against retreat's practice style. Flow styles: ${FLOW_STYLES.join(", ")}. Gentle styles: ${GENTLE_STYLES.join(", ")}. Open mobility on a flow retreat = sufficient. Open mobility on a gentle retreat = under-challenging. Tight mobility on a flow retreat = may demand too much. Tight mobility on a gentle retreat = good match. Output axis name 'Mobility hint'. Skip if no pose baseline.`;
  },
  apply(p, a) {
    if (!p.pose) return null;
    const hipOpen = p.pose.hipMobility !== "tight";
    const shoulderOpen = p.pose.shoulderMobility !== "tight";
    const flowStyle = a.claims.practiceStyle.some((s) =>
      FLOW_STYLES.includes(s)
    );
    const gentleStyle = a.claims.practiceStyle.some((s) =>
      GENTLE_STYLES.includes(s)
    );
    let when: string;
    let then: string;
    if (hipOpen && shoulderOpen) {
      when = flowStyle
        ? "Mobility baseline is open AND retreat runs a flow practice."
        : "Mobility baseline is open; retreat is gentler than the baseline.";
      then = flowStyle
        ? "Mobility is sufficient for this retreat's demands."
        : "Retreat is gentler than the body is ready for — could feel under-challenging.";
    } else {
      when = gentleStyle
        ? "Lower-mobility baseline AND retreat runs a gentler practice."
        : "Lower-mobility baseline AND retreat runs a flow practice.";
      then = gentleStyle
        ? "Retreat matches the baseline's mobility — won't over-reach."
        : "Retreat may demand more mobility than the baseline suggests.";
    }
    return {
      score: 0,
      given: `Shoulder ${p.pose.shoulderMobility}, hip ${p.pose.hipMobility}. Practice style: ${a.claims.practiceStyle.join(", ")}.`,
      when,
      then,
    };
  },
};

// ADR 0011 §4: preference fit. A soft tie-breaker that nudges rankings
// when the practitioner has set cross-episode preferences (accommodation,
// dietary). Retreats that haven't declared offerings score neutral (0.5)
// so a preference doesn't penalize retreats with unknown accommodation.
// Only retreats that explicitly declare and match/mismatch move the score.
const preferenceAxis: Axis = {
  name: "Preference fit",
  weight: 0.10,
  describe() {
    return "Preference fit (weight 0.10): soft tie-breaker for cross-episode preferences. If the practitioner prefers a specific accommodation or dietary type and the retreat explicitly declares its offerings, score 1.0 on match, 0 on mismatch. Retreats with undeclared offerings score 0.5 (neutral). Skip when the practitioner has no preferences set. Output axis name 'Preference fit'.";
  },
  apply(p, a) {
    const prefs = p.preferences;
    if (!prefs) return null;
    const hasAccommodationPref = Boolean(prefs.accommodation);
    const hasDietaryPref = Boolean(prefs.dietary);
    if (!hasAccommodationPref && !hasDietaryPref) return null;

    const parts: string[] = [];
    let total = 0;
    let count = 0;

    if (hasAccommodationPref && prefs.accommodation) {
      const offered = a.claims.accommodation;
      if (!offered || offered.length === 0) {
        parts.push(`Accommodation preference '${prefs.accommodation}' — retreat hasn't declared offerings (neutral).`);
        total += 0.5;
      } else if (offered.includes(prefs.accommodation)) {
        parts.push(`Accommodation preference '${prefs.accommodation}' — retreat offers it.`);
        total += 1;
      } else {
        parts.push(`Accommodation preference '${prefs.accommodation}' — retreat offers ${offered.join(", ")} (mismatch).`);
        total += 0;
      }
      count++;
    }

    if (hasDietaryPref && prefs.dietary) {
      const offered = a.claims.dietary;
      if (!offered || offered.length === 0) {
        parts.push(`Dietary preference '${prefs.dietary}' — retreat hasn't declared offerings (neutral).`);
        total += 0.5;
      } else if (offered.includes(prefs.dietary)) {
        parts.push(`Dietary preference '${prefs.dietary}' — retreat offers it.`);
        total += 1;
      } else {
        parts.push(`Dietary preference '${prefs.dietary}' — retreat offers ${offered.join(", ")} (mismatch).`);
        total += 0;
      }
      count++;
    }

    const score = count > 0 ? total / count : 0.5;
    return {
      score,
      given: parts.join(" "),
      when: "Cross-episode preferences are soft signals — they nudge, never override energy or social fit.",
      then: score >= 0.75
        ? "Preferences align — small pull toward this match."
        : score <= 0.25
          ? "Preferences don't align — small push away."
          : "Preferences are neutral or undeclared — no effect.",
    };
  },
};

// Composite weights: fixed subset that contributes to the numeric score.
// Display-only axes (weight 0) appear in reasoning but don't move the
// score — they're context, not rank signal.
//
// Keys are typed as a union so callers can override weights with full
// type safety. Adding a new scoreable axis requires extending both this
// union and the type in `CompositeOverrides`.
type CompositeAxis = "Energy alignment" | "Social comfort" | "Budget" | "Breath & practice" | "Preference fit";

const COMPOSITE_WEIGHTS: Record<CompositeAxis, number> = {
  "Energy alignment": 0.35,
  "Social comfort": 0.25,
  Budget: 0.15,
  "Breath & practice": 0.15,
  "Preference fit": 0.10,
};

// Single source of truth for the matching logic. Order is the order the
// reasoning steps appear in the UI.
export const AXES: readonly Axis[] = [
  energyAxis,
  socialAxis,
  budgetAxis,
  breathAxis,
  breathCycleAxis,
  mobilityAxis,
  preferenceAxis,
];

// ─── Headline + scoring ──────────────────────────────────────────────────

function headline(
  practitioner: PractitionerProfile,
  a: AttestationIndex,
  energyMatch: boolean,
  socialMatch: boolean
): string {
  if (energyMatch && socialMatch) {
    return `Held for someone arriving ${practitioner.energy}, in a ${a.claims.capacity}-person cohort.`;
  }
  if (energyMatch) {
    return `Matches the ${practitioner.energy} energy even if the social register differs.`;
  }
  if (socialMatch) {
    return `The right shape of company for you, though the energy register is a stretch.`;
  }
  return `Worth seeing — the match is partial, but the practice itself is strong.`;
}

export function scoreRetreat(
  practitioner: PractitionerProfile,
  a: AttestationIndex,
  overrides?: CompositeOverrides
): ScoredAttestation {
  const steps: ReasoningStep[] = [];
  const perAxisScore: Record<string, number> = {};

  for (const axis of AXES) {
    const result = axis.apply(practitioner, a);
    if (!result) continue;
    perAxisScore[axis.name] = result.score;
    // When the practitioner has no pose baseline, the breath axis returns
    // a step with weight 0.10 (a "skipped" explanation) — but we want the
    // displayed step weight to reflect the actual axis weight in this case.
    // Use the registry weight when present, otherwise the axis's own claim.
    const displayedWeight =
      axis.name === "Breath & practice" && !practitioner.pose
        ? 0.1
        : axis.weight;
    steps.push({
      axis: axis.name,
      given: result.given,
      when: result.when,
      then: result.then,
      weight: displayedWeight,
    });
  }

  // Composite: weighted sum over the score-contributing axes only.
  // Overrides let a caller rebalance which axis dominates — used by the
  // counterfactual ("what if I'd weighted budget more?") flow.
  const weights = { ...COMPOSITE_WEIGHTS, ...(overrides ?? {}) };
  let raw = 0;
  for (const [name, weight] of Object.entries(weights)) {
    raw += (perAxisScore[name] ?? 0) * weight;
  }
  const score = Math.max(0, Math.min(1, raw));

  const result: MatchResult = {
    id: a.rootHash,
    retreatRootHash: a.rootHash,
    retreatTitle: a.title,
    retreatDescription: a.description,
    retreatLocation: a.claims.location,
    durationDays: a.claims.durationDays,
    priceUsd: a.claims.priceUsd,
    capacity: a.claims.capacity,
    practiceStyle: a.claims.practiceStyle,
    score,
    headline: headline(
      practitioner,
      a,
      Boolean(perAxisScore["Energy alignment"]),
      Boolean(perAxisScore["Social comfort"])
    ),
    reasoning: steps,
    attestationCount: 1,
    attestor: a.attestor,
    attestedAt: a.createdAt,
  };

  return { result, steps };
}

export function scoreAll(
  practitioner: PractitionerProfile,
  attestations: AttestationIndex[]
): ScoredAttestation[] {
  return attestations
    .map((a) => scoreRetreat(practitioner, a))
    .sort((a, b) => b.result.score - a.result.score);
}

// ─── Counterfactual: re-score with a different weight balance ────────────

// Per-axis weight overrides applied on top of COMPOSITE_WEIGHTS. Use this
// to ask "what would have happened if I'd weighted X more heavily?" without
// touching the registry.
export type CompositeOverrides = Partial<Record<CompositeAxis, number>>;

// A named counterfactual perspective. The agent runs the same AXES but
// with a different composite weight balance, so the user can see how the
// ranking shifts when one axis dominates.
export type Perspective = {
  name: string;
  weight: number;
  overrides: CompositeOverrides;
  plain: string;
};

// Default perspective: what the main match uses (identity on weights).
export const DEFAULT_PERSPECTIVE: Perspective = {
  name: "Balanced",
  weight: 1,
  overrides: {},
  plain: "weighted across energy, social, budget, and breath",
};

// Two named lenses, used by the multi-perspective flow. Weights are
// rebased so the total stays near 0.90 (matching the default), just with
// one axis dominant.
export const RESTORATIVE_LENS: Perspective = {
  name: "Restorative",
  weight: 0.5,
  overrides: {
    "Energy alignment": 0.5,
    "Social comfort": 0.2,
    Budget: 0.1,
    "Breath & practice": 0.1,
  },
  plain: "weighted toward energy and breath",
};

export const MOVEMENT_LENS: Perspective = {
  name: "Movement",
  weight: 0.5,
  overrides: {
    "Energy alignment": 0.2,
    "Social comfort": 0.4,
    Budget: 0.2,
    "Breath & practice": 0.1,
  },
  plain: "weighted toward social comfort and budget",
};

export const LENSES: readonly Perspective[] = [
  RESTORATIVE_LENS,
  MOVEMENT_LENS,
];

export function scoreAllWithOverrides(
  practitioner: PractitionerProfile,
  attestations: AttestationIndex[],
  overrides: CompositeOverrides
): ScoredAttestation[] {
  return attestations
    .map((a) => scoreRetreat(practitioner, a, overrides))
    .sort((a, b) => b.result.score - a.result.score);
}

// Resolves a perspective against an attestation pool. Used by the
// counterfactual and multi-perspective endpoints.
export function scoreWithPerspective(
  practitioner: PractitionerProfile,
  attestations: AttestationIndex[],
  perspective: Perspective
): ScoredAttestation[] {
  return scoreAllWithOverrides(practitioner, attestations, perspective.overrides);
}

// Stream-friendly header steps. Kept here (not in prompts.ts) so the
// contextStep and consideringStep are guaranteed to match what the
// scorer's AXES use.

// A first step that establishes the context — what the agent is reasoning
// against. Always emitted at the start of a stream.
export function contextStep(args: {
  practitioner: PractitionerProfile;
  attestationCount: number;
}): ReasoningStep {
  const { practitioner, attestationCount } = args;
  const poseLine = practitioner.pose
    ? ` with a pose baseline (${Math.round(practitioner.pose.confidence * 100)}% confidence)`
    : "";
  return {
    axis: "Reading your profile",
    given: `Energy ${practitioner.energy}, budget ${practitioner.budget}, social ${practitioner.social}${poseLine}. Considering ${attestationCount} retreat${attestationCount === 1 ? "" : "s"} from the verified pool.`,
    when: "Your stated answers set the constraints.",
    then:
      "Everything downstream is reasoning about fit, not ranking by price or popularity.",
    weight: 0,
  };
}

// A short, attention-getting reasoning step that names the retreat the agent
// is now considering. Used as a "thinking out loud" header during streaming.
export function consideringStep(title: string): ReasoningStep {
  return {
    axis: "Considering",
    given: title,
    when: "Now scoring against the practitioner's stated axes.",
    then: "Reasoning about fit on energy, social, budget, breath, mobility.",
    weight: 0,
  };
}
