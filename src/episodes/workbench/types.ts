// Shared types and small presentational primitives for the episode
// workbench. These are used across every state-specific view component so
// the view layer stays consistent without duplicating definitions.

import type { MatchResult } from "@/matching/types";
import type { BudgetBand, EnergyState } from "@/calibration/schema";
import type { CounterfactualResult } from "@/episodes/counterfactual";
import type { PerspectiveName } from "@/episodes/perspectives";
import type {
  Episode,
  EpisodeCommand,
  NextDecision,
} from "@/episodes/model";
import type { EpisodeDetailPayload } from "@/episodes/detail-payload";
import type { MemoryContext } from "@/memory/semantic-memory";
import type { MiraPresence } from "@/agent/mira-presence";
import type { AestheticVector } from "@/aesthetics/image-pool";
import type { IntentionConstraints } from "@/episodes/model";
import type { ImpulseKind } from "@/components/MiraImpulse";

// The full payload the workbench operates on.
export type WorkbenchPayload = EpisodeDetailPayload & {
  shareToken?: string;
  error?: string;
};

export type { PerspectiveName };

// A snapshot of derived-view state (lenses, counterfactuals) threaded into
// the recommendation and hold views.
export type DerivedViews = {
  activeLens: PerspectiveName;
  lensData: Record<PerspectiveName, MatchResult | null> | null;
  lensLoading: boolean;
  activeBand: BudgetBand | null;
  bandData: CounterfactualResult | null;
  bandLoading: boolean;
  activeEnergy: EnergyState | null;
  energyData: CounterfactualResult | null;
  energyLoading: boolean;
};

export type WorkbenchState = {
  episodeId: string;
  episode: Episode;
  nextDecision: NextDecision;
  memory: MemoryContext | undefined;
  miraPresence: MiraPresence | null;
  aestheticVector: AestheticVector | null;
  busy: boolean;
  isAuthenticated: boolean;
  shareUrl: string | null;
  voiceInput: string;
  voiceResponse: string | null;
  commitmentOpen: boolean;
  participant: string;
  derived: DerivedViews;
};

// Distributive Omit — when T is a union, Omit<T, K> doesn't distribute
// by default, producing a single type with all fields. This distributes
// so each union member is omitted independently, matching the act()
// call sites that pass specific command shapes.
type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never;

export type WorkbenchActions = {
  act: (command: DistributiveOmit<EpisodeCommand, "expectedRevision">) => Promise<WorkbenchPayload | null>;
  load: () => Promise<void>;
  setVoiceInput: (value: string) => void;
  setVoiceResponse: (value: string | null) => void;
  setCommitmentOpen: (value: boolean) => void;
  setParticipant: (value: string) => void;
  recomputeWithPerspective: (lens: PerspectiveName) => Promise<void>;
  runCounterfactualBudget: (band: BudgetBand | null) => Promise<void>;
  runCounterfactualEnergy: (energy: EnergyState | null) => Promise<void>;
  submitVoiceFeedback: () => Promise<void>;
  fire: (impulse: ImpulseKind) => void;
};

// Re-export common types for convenience
export type {
  Episode,
  NextDecision,
  MatchResult,
  BudgetBand,
  EnergyState,
  CounterfactualResult,
  MemoryContext,
  MiraPresence,
  AestheticVector,
  IntentionConstraints,
  EpisodeDetailPayload,
};
