export type SemanticSnippet = {
  text: string;
  source: string;
  observedAt?: string;
};

// Compatibility shape used only by optional voice generation. Operational
// episode history is built from the episode repository, never reconstructed
// from these fields.
export type MemoryContext = {
  isReturning: boolean;
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
  priorCheckIns: {
    retreat: string;
    day: number;
    answer: string;
    answeredAt: string;
  }[];
  rawRecall: SemanticSnippet[];
  provider: "cognee" | "none";
};

export const EMPTY_MEMORY: MemoryContext = {
  isReturning: false,
  energyHistory: [],
  pastMatches: [],
  pastBookings: [],
  pastNotes: [],
  priorCheckIns: [],
  rawRecall: [],
  provider: "none",
};

export interface SemanticMemory {
  remember(actorId: string, text: string): Promise<void>;
  recall(actorId: string, query: string): Promise<SemanticSnippet[]>;
  forget(actorId: string): Promise<void>;
}
