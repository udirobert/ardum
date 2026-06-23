// What the matching agent returns to the client. Reasoning is the point —
// every step is visible.

export type ReasoningStep = {
  // A short label, e.g. "Energy alignment".
  axis: string;
  // What the agent observed about the practitioner/retreat pair.
  observation: string;
  // How strongly this axis pulled toward the match (0..1).
  weight: number;
  // Plain-language reasoning trace.
  reasoning: string;
};

export type MatchResult = {
  id: string;
  retreatRootHash: string;
  retreatTitle: string;
  retreatDescription: string;
  retreatLocation: string;
  durationDays: number;
  priceUsd: number;
  capacity: number;
  practiceStyle: string[];
  // 0..1 composite score.
  score: number;
  // A single-sentence headline shown above the card.
  headline: string;
  // Ordered reasoning — the user sees these stream in during the reveal.
  reasoning: ReasoningStep[];
};

export type MatchRun = {
  practitionerId: string;
  generatedAt: string;
  // The model/prompt used — useful for the judges and for iteration.
  agentTrace: {
    provider: string;
    model: string;
    promptVersion: string;
    attestationsConsidered: number;
  };
  results: MatchResult[];
};
