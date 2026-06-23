// 0G Compute Router client — SERVER ONLY. Never import from a client
// component; the API key must not leak.
//
// In demo mode (no OG_COMPUTE_* env vars) we run a deterministic local
// reasoner that produces the same shape the real agent returns. The real
// path is wired but stubbed behind a feature flag so the demo doesn't need
// the keys.

import "server-only";

import { PROMPT_VERSION, buildMatchPrompt } from "./prompts";
import type { AgentRequest, AgentResponse } from "./types";
import { has0GCompute } from "@/lib/env";
import type { Attestation, AttestationIndex } from "@/attestation/schema";
import type { MatchResult, ReasoningStep, MatchRun } from "@/matching/types";
import type { PractitionerProfile } from "@/calibration/schema";

function overlap(a: string[], b: string[]): string[] {
  return a.filter((x) => b.includes(x));
}

function axisScore(match: boolean, hasSignal: boolean): number {
  if (!hasSignal) return 0;
  return match ? 1 : 0;
}

function budgetScore(band: string, priceUsd: number): { score: number; note: string } {
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
  if (overshoot < 0.2) return { score: 0.6, note: `slightly above ${band}.` };
  if (overshoot < 0.5) return { score: 0.3, note: `notably above ${band}.` };
  return { score: 0.05, note: `well outside ${band}.` };
}

function scoreRetreat(
  practitioner: PractitionerProfile,
  a: AttestationIndex
): { result: MatchResult; steps: ReasoningStep[] } {
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
  const budgetValue = budget.score;

  // Practice + breath alignment.
  let breathScore = 0;
  let breathReasoning = "";
  if (practitioner.pose) {
    const breathMatch = a.claims.breathPhase.includes(
      practitioner.pose.breathPhase
    );
    breathScore = axisScore(breathMatch, true);
    breathReasoning = breathMatch
      ? `Breath phase (${practitioner.pose.breathPhase}) is in this retreat's wheelhouse.`
      : `This retreat's breath phase (${a.claims.breathPhase.join(", ")}) doesn't match the baseline.`;
    steps.push({
      axis: "Breath & practice",
      observation: `Baseline breath: ${practitioner.pose.breathPhase}. Retreat breath: ${a.claims.breathPhase.join(", ")}.`,
      weight: 0.15,
      reasoning: breathReasoning,
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
    const practiceHint = hipOpen && shoulderOpen
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
  const weights = steps.reduce((s, x) => s + x.weight, 0);
  const raw =
    energyScore * 0.35 +
    socialScore * 0.25 +
    budgetValue * 0.15 +
    (breathScore > 0 ? breathScore * 0.15 : 0);
  const score = Math.max(0, Math.min(1, raw / (weights > 0 ? 1 : 1)));

  // Headline.
  let headline: string;
  if (energyMatch && socialMatch) {
    headline = `Held for someone arriving ${practitioner.energy}, in a ${a.claims.capacity}-person cohort.`;
  } else if (energyMatch) {
    headline = `Matches the ${practitioner.energy} energy even if the social register differs.`;
  } else if (socialMatch) {
    headline = `The right shape of company for you, though the energy register is a stretch.`;
  } else {
    headline = `Worth seeing — the match is partial, but the practice itself is strong.`;
  }

  const fullAttestation: Attestation = {
    rootHash: a.rootHash,
    kind: a.kind,
    title: a.title,
    description: a.description,
    claims: a.claims as Attestation["claims"],
    attestor: "0x0",
    createdAt: a.createdAt,
  };

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
    headline,
    reasoning: steps,
  };
  // Reference the full attestation (reserved for future use by the match card).
  void fullAttestation;

  return { result, steps };
}

export async function runMatchAgent(
  req: AgentRequest,
  practitionerId: string
): Promise<AgentResponse> {
  if (!has0GCompute()) {
    const ranked = req.attestations
      .map((a) => scoreRetreat(req.practitioner, a).result)
      .sort((a, b) => b.score - a.score);

    const run: MatchRun = {
      practitionerId,
      generatedAt: new Date().toISOString(),
      agentTrace: {
        provider: "stub",
        model: "deterministic-local",
        promptVersion: PROMPT_VERSION,
        attestationsConsidered: req.attestations.length,
      },
      results: ranked,
    };
    return { run };
  }

  // Real 0G Compute Router call. Stubbed here — the prompt and shape are
  // already wired (see buildMatchPrompt). Uncomment + fill when keys are
  // available.
  const prompt = buildMatchPrompt(req);
  void prompt;
  throw new Error(
    "0G Compute Router integration is wired but disabled. Set OG_COMPUTE_ROUTER_URL " +
      "and OG_COMPUTE_API_KEY, then implement the call in src/agent/client.ts."
  );
}
