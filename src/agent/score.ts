// Pure scoring logic — extracted so both the synchronous runMatchAgent
// and the SSE streaming variant can share the same reasoning. No I/O,
// no env access, no globals. Pure functions only.
//
// Each reasoning step is structured as Gherkin (Given / When / Then) so
// the agent's logic is inspectable: what we observed, what rule fired,
// what we concluded.

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

function axisScore(match: boolean, hasSignal: boolean): number {
  if (!hasSignal) return 0;
  return match ? 1 : 0;
}

// Map a structured BreathCycle to a coarse "character" (extended/even/shallow)
// so it can be compared against a practitioner pose baseline.
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

type BudgetVerdict = {
  score: number;
  given: string;
  when: string;
  then: string;
};

function budgetVerdict(band: string, priceUsd: number): BudgetVerdict {
  const limits: Record<string, number> = {
    "under-1k": 1000,
    "1k-2k": 2000,
    "2k-3k": 3000,
    "3k-plus": Infinity,
  };
  const ceiling = limits[band] ?? Infinity;
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
  if (overshoot < 0.2) {
    return {
      score: 0.6,
      given,
      when: `Price exceeds ${band} ceiling by ${Math.round(overshoot * 100)}%.`,
      then: "Slightly above stated band — still workable.",
    };
  }
  if (overshoot < 0.5) {
    return {
      score: 0.3,
      given,
      when: `Price exceeds ${band} ceiling by ${Math.round(overshoot * 100)}%.`,
      then: "Notably above stated band — a real stretch.",
    };
  }
  return {
    score: 0.05,
    given,
    when: `Price exceeds ${band} ceiling by ${Math.round(overshoot * 100)}%.`,
    then: "Well outside stated band.",
  };
}

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
  a: AttestationIndex
): ScoredAttestation {
  const steps: ReasoningStep[] = [];

  // Energy alignment.
  const energyMatch = a.claims.energyFit.includes(practitioner.energy);
  steps.push({
    axis: "Energy alignment",
    given: `Practitioner energy: ${practitioner.energy}. Retreat fits: ${a.claims.energyFit.join(", ")}.`,
    when: energyMatch
      ? `Both list '${practitioner.energy}' — direct match.`
      : `'${practitioner.energy}' is not in the retreat's energy register.`,
    then: energyMatch
      ? "Strong energy fit; pulls toward this match."
      : "Energy register doesn't match; retreats will feel mis-pitched.",
    weight: 0.35,
  });
  const energyScore = axisScore(energyMatch, true);

  // Social comfort.
  const socialMatch = a.claims.socialFit.includes(practitioner.social);
  steps.push({
    axis: "Social comfort",
    given: `Practitioner comfort: ${practitioner.social}. Retreat fits: ${a.claims.socialFit.join(", ")}. Cohort: ${a.claims.capacity}.`,
    when: socialMatch
      ? "Practitioner's comfort overlaps the retreat's social register."
      : "No overlap in stated social registers.",
    then: socialMatch
      ? "Cohort shape matches stated comfort — won't feel draining or underwhelming."
      : "Cohort shape is mismatched; expect social friction.",
    weight: 0.25,
  });
  const socialScore = axisScore(socialMatch, true);

  // Budget.
  const budget = budgetVerdict(practitioner.budget, a.claims.priceUsd);
  steps.push({
    axis: "Budget",
    given: budget.given,
    when: budget.when,
    then: budget.then,
    weight: 0.15,
  });

  // Practice + breath alignment.
  let breathScore = 0;
  if (practitioner.pose) {
    const breathMatch = a.claims.breathPhase.includes(
      practitioner.pose.breathPhase
    );
    breathScore = axisScore(breathMatch, true);
    steps.push({
      axis: "Breath & practice",
      given: `Baseline breath: ${practitioner.pose.breathPhase}. Retreat breath: ${a.claims.breathPhase.join(", ")}.`,
      when: breathMatch
        ? `Both list '${practitioner.pose.breathPhase}' — direct match.`
        : `Baseline '${practitioner.pose.breathPhase}' not in the retreat's breath register.`,
      then: breathMatch
        ? "Breath phase is in this retreat's wheelhouse."
        : "Breath phase is out of register — body work may feel off.",
      weight: 0.15,
    });
  } else {
    steps.push({
      axis: "Breath & practice",
      given: `No pose baseline provided. Stated energy: ${practitioner.energy}.`,
      when: "Without a pose sample, the agent reasons from stated energy alone.",
      then: "Skipped the breath/mobility axes — match is less precise.",
      weight: 0.1,
    });
  }

  // Breath cycle alignment (only when the retreat has a structured cycle
  // AND the practitioner has a pose baseline). This is a stronger signal
  // than the breathPhase string match above — actual cycle timing, not
  // just a label.
  if (practitioner.pose && a.claims.breathCycle) {
    const cm = cycleMatch(practitioner.pose.breathPhase, a.claims.breathCycle);
    steps.push({
      axis: "Breath cycle",
      given: `Baseline breath phase: ${practitioner.pose.breathPhase}. Retreat breath cycle: ${cm.detail}.`,
      when: cm.match
        ? "Computed cycle character matches the practitioner's baseline phase."
        : "Computed cycle character doesn't match the practitioner's baseline phase.",
      then: cm.match
        ? "Actual cycle timing aligns with the practitioner's baseline."
        : "Actual cycle timing is out of register with the practitioner's baseline.",
      weight: 0.1,
    });
  }

  // Pose mobility hint (only if pose is present).
  if (practitioner.pose) {
    const hipOpen = practitioner.pose.hipMobility !== "tight";
    const shoulderOpen = practitioner.pose.shoulderMobility !== "tight";
    const flowStyle = a.claims.practiceStyle.some((p) =>
      ["vinyasa", "ashtanga", "power vinyasa"].includes(p)
    );
    const gentleStyle = a.claims.practiceStyle.some((p) =>
      ["restorative", "yin", "meditation", "pranayama"].includes(p)
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
    steps.push({
      axis: "Mobility hint",
      given: `Shoulder ${practitioner.pose.shoulderMobility}, hip ${practitioner.pose.hipMobility}. Practice style: ${a.claims.practiceStyle.join(", ")}.`,
      when,
      then,
      weight: 0.1,
    });
  }

  // Composite: weighted sum.
  const raw =
    energyScore * 0.35 +
    socialScore * 0.25 +
    budget.score * 0.15 +
    breathScore * 0.15;
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
    headline: headline(practitioner, a, energyMatch, socialMatch),
    reasoning: steps,
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

// Stream-friendly header steps.

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
    given: `Energy ${practitioner.energy}, budget ${practitioner.budget}, social ${practitioner.social}${poseLine}. Considering ${attestationCount} attestation${attestationCount === 1 ? "" : "s"}.`,
    when: "Practitioner's stated axes set the constraints.",
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
