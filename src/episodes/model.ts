import type {
  BudgetBand,
  EnergyState,
  SocialComfort,
} from "@/calibration/schema";
import type { MatchResult } from "@/matching/types";

export const EPISODE_SCHEMA_VERSION = 1;
export const RANKING_POLICY_VERSION = "intention.v1";

export type EpisodeStatus =
  | "capturing"
  | "clarifying"
  | "ready"
  | "recommendation-ready"
  | "monitoring"
  | "held"
  | "coordinating"
  | "ready-to-book"
  | "booked"
  | "paused"
  | "completed";

export type IntentionConstraints = {
  energy?: EnergyState;
  budget?: BudgetBand;
  social?: SocialComfort;
  horizon?: string;
  partySize?: number;
};

export type IntentionRevision = {
  version: number;
  statement: string;
  desiredShift?: string;
  constraints: IntentionConstraints;
  changeReason: string;
  createdAt: string;
};

export type RecommendationSnapshot = {
  intentionVersion: number;
  rankingPolicyVersion: string;
  result: MatchResult;
  alternatives: MatchResult[];
  uncertainties: string[];
  generatedAt: string;
};

export type MonitorState = {
  status: "active" | "paused" | "satisfied";
  watchFor: Array<"availability" | "price" | "deadline">;
  lastCheckedAt?: string;
  nextCheckAt: string;
  observations: MonitorObservation[];
};

export type MonitorObservation = {
  id: string;
  available: boolean;
  priceUsd: number;
  observedAt: string;
  summary: string;
};

export type SoftHold = {
  id: string;
  retreatId: string;
  status: "active" | "released" | "expired" | "converted";
  expiresAt: string;
  createdAt: string;
  provider: "local";
};

export type ParticipantResponse = {
  participantId: string;
  decision: "yes" | "no" | "unsure";
  note?: string;
  respondedAt: string;
};

export type CoordinationState = {
  sharingConsent: boolean;
  participantName?: string;
  inviteCreatedAt?: string;
  inviteExpiresAt?: string;
  responses: ParticipantResponse[];
};

export type EpisodeEvent = {
  id: string;
  type:
    | "episode-created"
    | "intention-revised"
    | "recommendation-created"
    | "monitor-started"
    | "monitor-observed"
    | "hold-created"
    | "hold-released"
    | "hold-expired"
    | "invite-created"
    | "participant-responded"
    | "commitment-recorded"
    | "episode-paused"
    | "episode-completed";
  summary: string;
  createdAt: string;
};

export type Episode = {
  schemaVersion: typeof EPISODE_SCHEMA_VERSION;
  id: string;
  actorId: string;
  revision: number;
  status: EpisodeStatus;
  intentions: IntentionRevision[];
  recommendation?: RecommendationSnapshot;
  monitor?: MonitorState;
  hold?: SoftHold;
  coordination?: CoordinationState;
  commitment?: {
    status: "booked";
    bookingRootHash: string;
    depositTxId: string;
    bookedAt: string;
  };
  processedIdempotencyKeys: string[];
  events: EpisodeEvent[];
  createdAt: string;
  updatedAt: string;
};

export type NextDecision = {
  kind:
    | "describe-intention"
    | "clarify-energy"
    | "clarify-budget"
    | "clarify-social"
    | "review-recommendation"
    | "review-hold"
    | "invite-participant"
    | "await-responses"
    | "ready-to-book"
    | "resume";
  prompt: string;
  primaryLabel: string;
};

type EpisodeCommandPayload =
  | {
      type: "revise-intention";
      expectedRevision: number;
      statement?: string;
      desiredShift?: string;
      constraints?: Partial<IntentionConstraints>;
      reason: string;
    }
  | { type: "recommend"; expectedRevision: number }
  | {
      type: "feedback";
      expectedRevision: number;
      reason: "timing" | "budget" | "group" | "place" | "intention";
    }
  | { type: "start-monitoring"; expectedRevision: number }
  | { type: "check-monitor"; expectedRevision: number }
  | { type: "create-hold"; expectedRevision: number }
  | { type: "release-hold"; expectedRevision: number }
  | {
      type: "create-invite";
      expectedRevision: number;
      participantName: string;
      sharingConsent: true;
    }
  | {
      type: "record-commitment";
      expectedRevision: number;
      bookingRootHash: string;
      depositTxId: string;
      bookedAt: string;
    }
  | { type: "pause"; expectedRevision: number }
  | { type: "complete"; expectedRevision: number };

export type EpisodeCommand = EpisodeCommandPayload & {
  idempotencyKey?: string;
};

export function currentIntention(episode: Episode): IntentionRevision {
  const intention = episode.intentions.at(-1);
  if (!intention) throw new Error("Episode has no intention.");
  return intention;
}

export function nextDecision(episode: Episode): NextDecision {
  const intention = currentIntention(episode);
  if (!intention.statement.trim()) {
    return {
      kind: "describe-intention",
      prompt: "What are you trying to make space for?",
      primaryLabel: "Tell Mira what matters",
    };
  }
  if (!intention.constraints.energy) {
    return {
      kind: "clarify-energy",
      prompt: "How are you arriving right now?",
      primaryLabel: "Continue",
    };
  }
  if (!intention.constraints.budget) {
    return {
      kind: "clarify-budget",
      prompt: "What limit would let this feel responsible?",
      primaryLabel: "Continue",
    };
  }
  if (!intention.constraints.social) {
    return {
      kind: "clarify-social",
      prompt: "How much company would support this intention?",
      primaryLabel: "Find the next step",
    };
  }
  if (!episode.recommendation) {
    return {
      kind: "review-recommendation",
      prompt: "I have enough to choose one next step.",
      primaryLabel: "Show me",
    };
  }
  if (
    episode.hold?.status === "active" &&
    !episode.coordination?.inviteExpiresAt
  ) {
    return {
      kind: "invite-participant",
      prompt: "Who else needs to be part of this decision?",
      primaryLabel: "Invite someone",
    };
  }
  if (
    episode.coordination?.inviteExpiresAt &&
    episode.coordination.responses.length === 0
  ) {
    return {
      kind: "await-responses",
      prompt: "The invitation is out. I’ll keep the hold in view.",
      primaryLabel: "Check for a response",
    };
  }
  if (
    episode.hold?.status === "active" &&
    episode.coordination?.responses.some((response) => response.decision === "yes")
  ) {
    return {
      kind: "ready-to-book",
      prompt: "The important pieces now agree.",
      primaryLabel: "Review the commitment",
    };
  }
  if (episode.hold?.status === "active") {
    return {
      kind: "review-hold",
      prompt: "Your option is being held. Nothing has been charged.",
      primaryLabel: "Review the hold",
    };
  }
  return {
    kind: "review-recommendation",
    prompt: "This is the strongest current fit for your intention.",
    primaryLabel: "Hold this option",
  };
}
