// Mira presence — journey posture projected from operational episode truth.
//
// Single source of truth for what Mira's orb expresses. Pure module: no env,
// no async, no renderer imports. MiraOrb consumes MorphParams; voice and UI
// import posture for alignment. See docs/design/mira-presence.md.

import type { EnergyState } from "@/calibration/schema";
import type { Episode, EpisodeEvent, EpisodeStatus } from "@/episodes/model";

export type MiraPosture =
  | "steady"
  | "inquiry"
  | "offering"
  | "watching"
  | "holding"
  | "gathering"
  | "resolving"
  | "arriving";

export type MiraReactionKind =
  | "setback"
  | "relief"
  | "deadline"
  | "surprise";

export type MiraPresence = {
  posture: MiraPosture;
  /** Settled (−1) through disrupted (+1). Journey tension, not user mood. */
  valence: number;
  reaction?: {
    kind: MiraReactionKind;
    eventId: string;
  };
};

export type MiraActivity = "idle" | "processing" | "speaking" | "listening" | "arriving";

export type MiraRenderTier = "hero" | "standard" | "inline";

export type MiraRingStyle = "sealed" | "open" | "radiating";

/** Shader + animation targets — derived from presence, consumed by MiraOrb. */
export type MorphParams = {
  speed: number;
  turbulence: number;
  brightness: number;
  blobCount: number;
  orbitRadius: number;
  orbitSpeed: number;
  pinch: number;
  bloom: number;
  asymmetry: number;
};

export const STEADY_PRESENCE: MiraPresence = {
  posture: "steady",
  valence: 0,
};

const POSTURE_MORPH: Record<MiraPosture, MorphParams> = {
  steady: {
    speed: 0.12,
    turbulence: 0.75,
    brightness: 0.55,
    blobCount: 1,
    orbitRadius: 0,
    orbitSpeed: 0.35,
    pinch: 0,
    bloom: 0,
    asymmetry: 0,
  },
  inquiry: {
    speed: 0.45,
    turbulence: 1.45,
    brightness: 0.78,
    blobCount: 2,
    orbitRadius: 0.09,
    orbitSpeed: 0.85,
    pinch: 0.38,
    bloom: 0,
    asymmetry: 0.12,
  },
  offering: {
    speed: 0.26,
    turbulence: 1.0,
    brightness: 1.15,
    blobCount: 1,
    orbitRadius: 0,
    orbitSpeed: 0.4,
    pinch: 0,
    bloom: 0.48,
    asymmetry: 0,
  },
  watching: {
    speed: 0.18,
    turbulence: 0.95,
    brightness: 0.68,
    blobCount: 2,
    orbitRadius: 0.13,
    orbitSpeed: 0.42,
    pinch: 0.12,
    bloom: 0,
    asymmetry: 0.38,
  },
  holding: {
    speed: 0.22,
    turbulence: 1.05,
    brightness: 0.72,
    blobCount: 1,
    orbitRadius: 0.04,
    orbitSpeed: 0.55,
    pinch: 0.28,
    bloom: 0.1,
    asymmetry: 0.05,
  },
  gathering: {
    speed: 0.24,
    turbulence: 1.1,
    brightness: 0.8,
    blobCount: 3,
    orbitRadius: 0.11,
    orbitSpeed: 0.48,
    pinch: 0.05,
    bloom: 0.22,
    asymmetry: 0.18,
  },
  resolving: {
    speed: 0.32,
    turbulence: 1.25,
    brightness: 0.85,
    blobCount: 2,
    orbitRadius: 0.07,
    orbitSpeed: 0.65,
    pinch: 0.52,
    bloom: 0.15,
    asymmetry: 0.22,
  },
  arriving: {
    speed: 0.2,
    turbulence: 0.88,
    brightness: 1.25,
    blobCount: 1,
    orbitRadius: 0,
    orbitSpeed: 0.3,
    pinch: 0,
    bloom: 0.62,
    asymmetry: 0,
  },
};

const BREATH_DURATION: Record<MiraPosture, string> = {
  steady: "4s",
  inquiry: "2s",
  offering: "3s",
  watching: "5s",
  holding: "2.8s",
  gathering: "3.5s",
  resolving: "2.4s",
  arriving: "3s",
};

const HOLD_PRESSURE_MS = 12 * 60 * 60 * 1000;

function clampValence(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function postureFromStatus(
  status: EpisodeStatus,
  episode: Episode,
): MiraPosture {
  switch (status) {
    case "capturing":
    case "paused":
    case "completed":
      return "steady";
    case "clarifying":
      return "inquiry";
    case "ready":
      return episode.recommendation ? "offering" : "inquiry";
    case "recommendation-ready":
      return "offering";
    case "monitoring":
      return "watching";
    case "held":
      return "holding";
    case "coordinating":
      return "gathering";
    case "ready-to-book":
      return "offering";
    case "booked":
      return "arriving";
    default:
      return "steady";
  }
}

function energyValence(energy: EnergyState | undefined): number {
  switch (energy) {
    case "low":
      return 0.15;
    case "sharp":
      return 0.2;
    case "in-movement":
      return 0.05;
    case "settled":
    default:
      return -0.05;
  }
}

function holdPressure(episode: Episode, now: number): number {
  const hold = episode.hold;
  if (!hold || hold.status !== "active") return 0;
  const remaining = new Date(hold.expiresAt).getTime() - now;
  if (remaining <= 0) return 0.5;
  if (remaining <= HOLD_PRESSURE_MS) {
    return 0.35 * (1 - remaining / HOLD_PRESSURE_MS);
  }
  return 0;
}

function coordinationTension(episode: Episode): number {
  const responses = episode.coordination?.responses ?? [];
  const declines = responses.filter((r) => r.decision === "no").length;
  const pending =
    episode.status === "coordinating" &&
    responses.some((r) => r.decision === "unsure");
  return Math.min(0.4, declines * 0.2 + (pending ? 0.1 : 0));
}

function monitorTension(episode: Episode): number {
  const obs = episode.monitor?.observations.at(-1);
  if (!obs) return 0;
  return obs.available ? 0 : 0.35;
}

function deriveValence(episode: Episode, now: number): number {
  const intention = episode.intentions.at(-1);
  const uncertainties = episode.recommendation?.uncertainties.length ?? 0;

  let valence =
    energyValence(intention?.constraints.energy) +
    uncertainties * 0.12 +
    holdPressure(episode, now) +
    coordinationTension(episode) +
    monitorTension(episode);

  if (episode.commitment?.status === "booked") {
    valence -= 0.25;
  }

  return clampValence(valence);
}

function reactionFromEvent(
  event: EpisodeEvent,
  episode: Episode,
): MiraReactionKind | undefined {
  switch (event.type) {
    case "hold-expired":
      return "deadline";
    case "hold-created":
    case "commitment-recorded":
      return "relief";
    case "intention-revised":
      return "surprise";
    case "monitor-observed": {
      const obs = episode.monitor?.observations.at(-1);
      return obs && !obs.available ? "surprise" : undefined;
    }
    case "participant-responded": {
      const last = episode.coordination?.responses.at(-1);
      return last?.decision === "no" ? "setback" : undefined;
    }
    default:
      return undefined;
  }
}

function deriveReaction(
  episode: Episode,
): MiraPresence["reaction"] | undefined {
  const latest = episode.events.at(-1);
  if (!latest) return undefined;
  const kind = reactionFromEvent(latest, episode);
  if (!kind) return undefined;
  return { kind, eventId: latest.id };
}

/** Project sustained posture + valence + optional reaction from an episode. */
export function projectMiraPresence(
  episode: Episode,
  now: number = Date.now(),
): MiraPresence {
  let posture = postureFromStatus(episode.status, episode);

  const reaction = deriveReaction(episode);
  if (reaction?.kind === "setback" || reaction?.kind === "deadline") {
    posture = "resolving";
  }

  return {
    posture,
    valence: deriveValence(episode, now),
    reaction,
  };
}

/** Transient UI activity when no episode context is available. */
export function presenceFromActivity(activity: MiraActivity): MiraPresence {
  switch (activity) {
    case "processing":
      return { posture: "inquiry", valence: 0.15 };
    case "speaking":
      return { posture: "offering", valence: 0 };
    case "listening":
      return { posture: "steady", valence: -0.12 };
    case "arriving":
      return { posture: "arriving", valence: -0.15 };
    case "idle":
    default:
      return STEADY_PRESENCE;
  }
}

/** Overlay transient activity onto an episode projection (e.g. busy spinner). */
export function mergePresence(
  base: MiraPresence,
  activity?: MiraActivity | null,
): MiraPresence {
  if (!activity || activity === "idle") return base;
  const overlay = presenceFromActivity(activity);
  return {
    ...base,
    posture: overlay.posture,
    valence: clampValence(Math.max(base.valence, overlay.valence)),
    reaction: base.reaction,
  };
}

export function renderTier(size: number): MiraRenderTier {
  if (size >= 96) return "hero";
  if (size >= 40) return "standard";
  return "inline";
}

export function ringStyle(posture: MiraPosture): MiraRingStyle {
  switch (posture) {
    case "inquiry":
    case "watching":
    case "resolving":
    case "gathering":
      return "open";
    case "offering":
    case "arriving":
      return "radiating";
    default:
      return "sealed";
  }
}

export function breathDuration(posture: MiraPosture): string {
  return BREATH_DURATION[posture];
}

/** Map presence to shader uniforms and animation targets. */
export function presenceToMorphParams(presence: MiraPresence): MorphParams {
  const base = POSTURE_MORPH[presence.posture];
  const v = presence.valence;
  const tension = Math.max(0, v);

  return {
    speed: base.speed + tension * 0.08,
    turbulence: base.turbulence + tension * 0.35,
    brightness: base.brightness + tension * 0.12 - Math.max(0, -v) * 0.08,
    blobCount: base.blobCount,
    orbitRadius: base.orbitRadius + tension * 0.02,
    orbitSpeed: base.orbitSpeed + tension * 0.15,
    pinch: base.pinch + tension * 0.08,
    bloom: base.bloom + Math.max(0, -v) * 0.06,
    asymmetry: base.asymmetry + tension * 0.1,
  };
}

/** Tier-adjusted morph — inline sizes cap blob complexity. */
export function morphParamsForTier(
  presence: MiraPresence,
  tier: MiraRenderTier,
): MorphParams {
  const params = presenceToMorphParams(presence);
  if (tier === "inline") {
    return {
      ...params,
      blobCount: 1,
      orbitRadius: 0,
      asymmetry: params.asymmetry * 0.4,
    };
  }
  if (tier === "standard") {
    return {
      ...params,
      blobCount: Math.min(2, params.blobCount),
      asymmetry: params.asymmetry * 0.75,
    };
  }
  return params;
}

const POSTURE_ANNOUNCEMENTS: Record<MiraPosture, string> = {
  steady: "Mira is steady.",
  inquiry: "Mira is reasoning.",
  offering: "Mira is speaking.",
  watching: "Mira is watching.",
  holding: "Mira is holding a planning window.",
  gathering: "Mira is gathering responses.",
  resolving: "Mira is adjusting to a change.",
  arriving: "Mira is arriving with you.",
};

const REACTION_ANNOUNCEMENTS: Record<MiraReactionKind, string> = {
  setback: "Mira noted a setback.",
  relief: "Mira noted progress.",
  deadline: "Mira noted a deadline.",
  surprise: "Mira noted a change.",
};

export function presenceAnnouncement(presence: MiraPresence): string {
  if (presence.reaction) {
    return REACTION_ANNOUNCEMENTS[presence.reaction.kind];
  }
  return POSTURE_ANNOUNCEMENTS[presence.posture];
}
