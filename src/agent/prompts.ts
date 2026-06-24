// The matching prompt — what the agent is told about the practitioner and the
// attestation pool, and the shape we want the response in.
//
// The rules section is built from the AXES registry in ./score.ts so the
// LLM and the local scorer are always told to apply the same logic. If
// you add or change an axis, update the registry — the prompt follows.

import type { AgentRequest } from "./types";
import { AXES } from "./score";

export const PROMPT_VERSION = "match.v0.2";

export function buildMatchPrompt({
  practitioner,
  attestations,
}: AgentRequest): string {
  const attestationsBlock = attestations
    .map((a, i) => {
      const claims = a.claims;
      return `### ${i + 1}. ${a.title}
Location: ${claims.location}  ·  ${claims.durationDays} days  ·  $${claims.priceUsd}  ·  cohort of ${claims.capacity}
Practice: ${claims.practiceStyle.join(", ")}
Energy fit: ${claims.energyFit.join(", ")}
Social fit: ${claims.socialFit.join(", ")}
Breath phase: ${claims.breathPhase.join(", ")}
${a.description}`;
    })
    .join("\n\n");

  const poseLine = practitioner.pose
    ? `Pose baseline (from in-browser MediaPipe sample, ${Math.round(
        practitioner.pose.confidence * 100
      )}% confidence): shoulder ${practitioner.pose.shoulderMobility}, hip ${practitioner.pose.hipMobility}, breath ${practitioner.pose.breathPhase}.`
    : "Pose baseline: skipped.";

  const rulesBlock = AXES.map((a) => `- ${a.describe()}`).join("\n");

  return `
You are Ardum's matching agent. You rank yoga retreats against a
practitioner's stated energy, budget, social comfort, and (when present) an
in-browser pose/breath baseline. You explain every step of your reasoning —
the reasoning itself is part of the product.

## Reasoning format (Gherkin)

Every reasoning step you emit must be structured as Given / When / Then:

- **Given**: the inputs to this step (practitioner + retreat facts).
- **When**: the trigger condition — what about the Given would lead to this conclusion (the matching rule that fired).
- **Then**: the conclusion drawn.

This is the same shape the local scorer and the UI use. Honesty here matters
more than persuasion: a step that's not supported by the inputs should say so
in its Then.

## Practitioner
Energy: ${practitioner.energy}
Budget band: ${practitioner.budget}
Social comfort: ${practitioner.social}
${poseLine}
${practitioner.notes ? `Notes from practitioner: ${practitioner.notes}` : ""}

## Attestation pool (${attestations.length} verified retreats)
${attestationsBlock}

## Matching rules

The local scorer applies these axes with the weights shown. Apply the same
rules so your reasoning aligns with the deterministic fallback when it runs.

${rulesBlock}

## Task
Return ONLY the top 3 retreats, ranked by composite fit. The UI shows
detailed reasoning for the #1 match only — #2 and #3 are compact cards
that need just a score and headline. So write detailed Gherkin reasoning
ONLY for the top match. Keep it tight.

Return a JSON object (no prose, no markdown fence) matching this shape:
{
  "results": [
    {
      "retreatRootHash": "<from attestation>",
      "score": <0..1>,
      "headline": "<one short sentence, ≤ 18 words>",
      "reasoning": [
        {
          "axis": "<axis name from the rules above>",
          "given": "<inputs observed, ≤ 20 words>",
          "when": "<trigger / matching rule, ≤ 15 words>",
          "then": "<conclusion, ≤ 18 words>",
          "weight": <0..1>
        }
      ]
    },
    { "retreatRootHash": "<from attestation>", "score": <0..1>, "headline": "<one short sentence>" },
    { "retreatRootHash": "<from attestation>", "score": <0..1>, "headline": "<one short sentence>" }
  ]
}

Rules:
- Exactly 3 results. The first has full reasoning; the other two omit the
  reasoning field entirely.
- Rank by composite fit, not by price or popularity.
- For the #1 match: one reasoning step per axis you considered (skip
  axes with no signal). Up to 6 steps total. Be terse — the UI renders
  these one per line, long copy crowds it.
- Weight reflects how strongly this axis pulled toward the match.
- Headline is the single most honest sentence about why this retreat fits.
- Never invent retreats or attestations that aren't in the pool.
- If a step is uncertain, the Then must say so. Don't paper over weak matches.
`;
}
