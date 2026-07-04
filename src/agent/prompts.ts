// The matching prompt — what the agent is told about the practitioner and the
// attestation pool, and the shape we want the response in.
//
// The rules section is built from the AXES registry in ./score.ts so the
// LLM and the local scorer are always told to apply the same logic. If
// you add or change an axis, update the registry — the prompt follows.

import type { AgentRequest } from "./types";
import type { MemoryContext } from "@/lib/cognee";
import { AXES } from "./score";

export const PROMPT_VERSION = "match.v0.2";

export function buildMatchPrompt({
  practitioner,
  attestations,
  memory,
}: AgentRequest): string {
  const attestationsBlock = attestations
    .map((a, i) => {
      const claims = a.claims;
      return `### ${i + 1}. ${a.title}
retreatRootHash: ${a.rootHash}
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

  // ── Memory section ──────────────────────────────────────────────────
  // When Mira has memory of this practitioner (from Cognee's hybrid
  // graph-vector store), inject it into the prompt so the agent can
  // reason about their history. This is what makes memory actually
  // change the recommendation — not just the UI.
  //
  // The agent is instructed to:
  //   1. Notice trajectory (energy shifts across visits)
  //   2. Avoid repeating past mismatches
  //   3. Build on past bookings (deeper practice, return visits)
  //   4. Honor past notes as durable preferences
  const memoryBlock =
    memory?.isReturning && memory.provider !== "none"
      ? buildMemorySection(memory)
      : "";

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
${memoryBlock}
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
- For each result, copy the retreatRootHash VERBATIM from the matching
  retreat block above (e.g. "bali-ubud-stillness-0001"). Never use the
  list number ("1", "2", "3") — those are headings, not identifiers.
- Rank by composite fit, not by price or popularity.
- For the #1 match: one reasoning step per axis you considered (skip
  axes with no signal). Up to 6 steps total. Be terse — the UI renders
  these one per line, long copy crowds it.
- Weight reflects how strongly this axis pulled toward the match.
- Headline is the single most honest sentence about why this retreat fits.
- Never invent retreats or attestations that aren't in the pool.
- If a step is uncertain, the Then must say so. Don't paper over weak matches.
- When a memory section is present, you MAY add a reasoning step with
  axis "memory" that references the practitioner's history. This step
  should explain how their trajectory influenced the ranking. Weight it
  honestly — memory is context, not a trump card.
`;
}

// ── Memory section builder ───────────────────────────────────────────────
// Formats the MemoryContext into a prompt section that the LLM can reason
// about. Kept terse — the prompt has a token budget and the memory section
// must not crowd out the attestation pool.
function buildMemorySection(memory: MemoryContext): string {
  const lines: string[] = [];

  // Energy trajectory — the most actionable signal
  if (memory.energyHistory.length > 0) {
    const trajectory = memory.energyHistory.join(" → ");
    const current = memory.energyHistory[memory.energyHistory.length - 1];
    lines.push(`Energy trajectory across visits: ${trajectory}`);
    if (memory.energyHistory.length > 1) {
      lines.push(
        `Their energy has shifted over time. The current state is "${current}". ` +
          `Consider whether a retreat matching the current state or one that ` +
          `gently stretches them is more appropriate.`,
      );
    }
  }

  // Past matches — avoid repeating, build on
  if (memory.pastMatches.length > 0) {
    const matchList = memory.pastMatches
      .map((m) => `${m.title} (${m.location}, score ${m.score.toFixed(2)})`)
      .join("; ");
    lines.push(`Past recommendations: ${matchList}`);
    lines.push(
      `Avoid recommending the same retreat twice unless it's clearly the ` +
        `best fit. If a past match was booked, a follow-up retreat should ` +
        `build on that experience (deeper practice, complementary style).`,
    );
  }

  // Past bookings — the strongest commitment signal
  if (memory.pastBookings.length > 0) {
    const bookingList = memory.pastBookings
      .map((b) => `${b.title} (${b.location})`)
      .join("; ");
    lines.push(`Past bookings: ${bookingList}`);
    lines.push(
      `These are retreats the practitioner committed to. Their next retreat ` +
        `should complement, not duplicate, these experiences.`,
    );
  }

  // Past notes — durable preferences
  if (memory.pastNotes.length > 0) {
    const noteList = memory.pastNotes.map((n) => `"${n}"`).join("; ");
    lines.push(`Notes from past visits: ${noteList}`);
    lines.push(
      `Treat these as durable preferences unless contradicted by the ` +
        `current profile.`,
    );
  }

  if (lines.length === 0) return "";

  return `
## Mira's memory of this practitioner
This practitioner has visited before. Use their history to inform the
ranking — but the current profile is the primary signal. Memory provides
trajectory and context, not override authority.

${lines.join("\n")}
`;
}
