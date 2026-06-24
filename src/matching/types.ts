// What the matching agent returns to the client. Reasoning is the point —
// every step is visible. The shape is Gherkin-style (Given / When / Then)
// so the agent's logic is structured, not free-form:
//
//   given  — what the agent observed (practitioner + retreat inputs to
//            this step). The precondition.
//   when   — the trigger / matching rule that fired. The condition.
//   then   — the conclusion drawn. The consequence.
//   weight — how strongly this axis contributed to the composite score
//            (0..1).
//
// The same shape is what we tell the LLM to return in buildMatchPrompt,
// so the real 0G Compute path inherits the structure natively.

export type ReasoningStep = {
  axis: string;
  given: string;
  when: string;
  then: string;
  weight: number;
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
  // Trust signal: how many wallets have attested this retreat. In demo mode
  // always 1; in production this is the indexer query that grows over time.
  attestationCount: number;
  // Wallet that wrote the first attestation.
  attestor?: string;
  // When the first attestation was written.
  attestedAt?: string;
};

export type MatchRun = {
  practitionerId: string;
  generatedAt: string;
  // The model/prompt used — useful for the judges and for iteration.
  agentTrace: {
    provider: "0g-compute" | "local" | "0g-compute-fallback";
    model?: string;
    promptVersion: string;
    attestationsConsidered: number;
  };
  results: MatchResult[];
};
