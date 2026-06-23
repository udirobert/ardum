// Pure scoring logic — extracted so both the synchronous runMatchAgent
// and the SSE streaming variant can share the same reasoning. No I/O,
// no env access, no globals. Pure functions only.

import type {
  AttestationIndex,
} from "@/attestation/schema";
import type {
  MatchResult,
  ReasoningStep,
} from "@/matching/types";
import type {
  PractitionerProfile,
} from "@/calibration/schema";

export type ScoredAttestation = {
  result: MatchResult;
  steps: ReasoningStep[];
};

function overlap(a: string[], b: string[]): string[] {
  return a.filter((x) => b.includes(x));
}

function axisScore(match: boolean, hasSignal: boolean): number {
  if (!hasSignal) return 0;
  return match ? 1 : 0;
}

function budgetScore(
  band: string,
  priceUsd: number
): { score: number; note: string } {
  // The band is the practitioner's stated upper bound; we score how well the
  // retreat fits inside it.
  const limits: Record<string, number> = {
    "under-1k": 1000,
    "1k-2k": 2000,
    "2k-3k": 3000,
    "3k-plus": Infinity,
  };
  const ceiling = limits[band] ?? Infinity;
  if (priceUsd <= ceiling) return { score: 1, note: `fits inside ${band}.` };
  const overshoot = (priceUsd - ceiling) / ceiling;
  if (overshoot < 0.2)
    return { score: 0.6, note: `slightly above ${band}.` };
  if (overshoot < 0.5)
    return { score: 0.3, note: `notably above ${band}.` };
  return { score: 0.05, note: `well outside ${band}.` };
}

// Composite headline — a single honest sentence about why this retreat fits.
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
    observation: `Practitioner energy: ${practitioner.energy}. Retreat fits: ${a.claims.energyFit.join(", ")}.`,
    weight: 0.35,
    reasoning: energyMatch
      ? `This retreat is held for someone arriving in a ${practitioner.energy} state.`
      : `The retreat doesn't list ${practitioner.energy} as a fit — its energy register is different.`,
  });
  const energyScore = axisScore(energyMatch, true);

  // Social comfort.
  const socialMatch = a.claims.socialFit.includes(practitioner.social);
  steps.push({
    axis: "Social comfort",
    observation: `Practitioner social comfort: ${practitioner.social}. Retreat fits: ${a.claims.socialFit.join(", ")}.`,
    weight: 0.25,
    reasoning: socialMatch
      ? `Cohort size (${a.claims.capacity}) and the social register match the practitioner's stated comfort.`
      : `The cohort shape here doesn't match the practitioner's stated social comfort.`,
  });
  const socialScore = axisScore(socialMatch, true);

  // Budget.
  const budget = budgetScore(practitioner.budget, a.claims.priceUsd);
  steps.push({
    axis: "Budget",
    observation: `Retreat price $${a.claims.priceUsd}. Practitioner band: ${practitioner.budget}.`,
    weight: 0.15,
    reasoning: budget.note,
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
      observation: `Baseline breath: ${practitioner.pose.breathPhase}. Retreat breath: ${a.claims.breathPhase.join(", ")}.`,
      weight: 0.15,
      reasoning: breathMatch
        ? `Breath phase (${practitioner.pose.breathPhase}) is in this retreat's wheelhouse.`
        : `This retreat's breath phase (${a.claims.breathPhase.join(", ")}) doesn't match the baseline.`,
    });
  } else {
    steps.push({
      axis: "Breath & practice",
      observation: `No pose baseline provided. Inferring from stated energy (${practitioner.energy}).`,
      weight: 0.1,
      reasoning: `Without a pose baseline, the agent leans on the energy axis and the retreat's practice style.`,
    });
  }

  // Pose mobility hint (only if pose is present).
  if (practitioner.pose) {
    const hipOpen = practitioner.pose.hipMobility !== "tight";
    const shoulderOpen = practitioner.pose.shoulderMobility !== "tight";
    const practiceHint =
      hipOpen && shoulderOpen
        ? a.claims.practiceStyle.some((p) =>
            ["vinyasa", "ashtanga", "power vinyasa"].includes(p)
          )
          ? "Mobility baseline is open enough for this retreat's flow style."
          : "Mobility baseline is open; this retreat is gentler than the baseline suggests."
        : a.claims.practiceStyle.some((p) =>
            ["restorative", "yin", "meditation", "pranayama"].includes(p)
          )
        ? "Lower-mobility retreat matches a tighter baseline."
        : "This retreat may demand more mobility than the baseline suggests.";
    steps.push({
      axis: "Mobility hint",
      observation: `Shoulder ${practitioner.pose.shoulderMobility}, hip ${practitioner.pose.hipMobility}.`,
      weight: 0.1,
      reasoning: practiceHint,
    });
  }

  // Composite: weighted sum, renormalised.
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

// A short, attention-getting reasoning step that names the retreat the agent
// is now considering. Used as a "thinking out loud" header during streaming.
export function consideringStep(title: string): ReasoningStep {
  return {
    axis: "Considering",
    observation: `Looking at ${title}.`,
    weight: 0,
    reasoning: "Comparing against the practitioner's stated axes.",
  };
}

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
    observation: `Energy ${practitioner.energy}, budget ${practitioner.budget}, social ${practitioner.social}${poseLine}. Considering ${attestationCount} attestation${attestationCount === 1 ? "" : "s"}.`,
    weight: 0,
    reasoning:
      "Holding the practitioner's axes as the fixed constraints; everything downstream is reasoning about fit, not ranking by price or popularity.",
  };
}
