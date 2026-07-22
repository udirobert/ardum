import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  cryptoIds,
  systemClock,
  type Clock,
  type IdFactory,
} from "@/automation/contracts";
import {
  localCoordinationProvider,
  localHoldProvider,
  localMonitoringProvider,
} from "@/automation/local";
import {
  EPISODE_SCHEMA_VERSION,
  currentIntention,
  type Episode,
  type EpisodeCommand,
  type EpisodeEvent,
  type IntentionConstraints,
} from "./model";
import { fireSemanticRemember } from "@/memory/observe";
import { recommendForEpisode } from "./recommendation";
import { episodeRepository } from "./repository";
import { actorProfileRepository } from "@/identity/actor-profile";
import type { PractitionerProfile } from "@/calibration/schema";

const DAY = 24 * 60 * 60 * 1000;

export type CreateEpisodeInput = {
  statement: string;
  desiredShift?: string;
  constraints?: IntentionConstraints;
  persistenceConsent: boolean;
};

export type ActionResult = {
  episode: Episode;
  shareToken?: string;
};

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function event(
  ids: IdFactory,
  now: Date,
  type: EpisodeEvent["type"],
  summary: string,
): EpisodeEvent {
  return { id: ids.create(), type, summary, createdAt: now.toISOString() };
}

export async function createEpisode(
  actorId: string,
  input: CreateEpisodeInput,
  dependencies: { clock?: Clock; ids?: IdFactory } = {},
): Promise<Episode> {
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? cryptoIds;
  const now = clock.now();
  const statement = input.statement.trim();
  if (!statement) throw new Error("Tell Mira what you are making space for.");
  if (!input.persistenceConsent) {
    throw new Error("Persistence consent is required to create an episode.");
  }

  const episode: Episode = {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: ids.create(),
    actorId,
    revision: 1,
    status: input.constraints?.energy ? "clarifying" : "capturing",
    intentions: [
      {
        version: 1,
        statement,
        desiredShift: input.desiredShift?.trim() || undefined,
        constraints: input.constraints ?? {},
        changeReason: "Initial intention",
        createdAt: now.toISOString(),
      },
    ],
    processedIdempotencyKeys: [],
    events: [
      event(ids, now, "episode-created", "You gave this intention a place to live."),
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return episodeRepository.create(episode);
}

function withExpiredHold(
  episode: Episode,
  now: Date,
  ids: IdFactory,
): Episode {
  if (
    episode.hold?.status === "active" &&
    new Date(episode.hold.expiresAt).getTime() <= now.getTime()
  ) {
    return {
      ...episode,
      status: episode.monitor ? "monitoring" : "recommendation-ready",
      hold: { ...episode.hold, status: "expired" },
      events: [
        ...episode.events,
        event(ids, now, "hold-expired", "The planning hold expired."),
      ],
    };
  }
  return episode;
}

/**
 * Load cross-episode preferences from the actor profile (ADR 0011 §4).
 * Fire-and-forget on failure — preferences are soft signals, never hard
 * constraints. Used by both `recommend` and `reject-recommendation`.
 */
async function loadPreferences(
  actorId: string,
): Promise<PractitionerProfile["preferences"]> {
  try {
    const profile = await actorProfileRepository.get(actorId);
    const p = profile.profile as Record<string, unknown>;
    return {
      accommodation: typeof p.accommodation === "string" ? p.accommodation : undefined,
      dietary: typeof p.dietary === "string" ? p.dietary : undefined,
      practiceStyle: typeof p.practiceStyle === "string" ? p.practiceStyle : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function applyEpisodeCommand(
  actorId: string,
  episodeId: string,
  command: EpisodeCommand,
  dependencies: { clock?: Clock; ids?: IdFactory; skipOwnershipCheck?: boolean } = {},
): Promise<ActionResult> {
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? cryptoIds;
  const now = clock.now();
  const stored = dependencies.skipOwnershipCheck
    ? await episodeRepository.get(episodeId)
    : await episodeRepository.getOwned(actorId, episodeId);
  if (!stored) throw new Error("Episode not found.");
  if (
    command.idempotencyKey &&
    (stored.processedIdempotencyKeys ?? []).includes(command.idempotencyKey)
  ) {
    return { episode: stored };
  }
  if (stored.revision !== command.expectedRevision) {
    throw new Error("This intention changed. Refresh before trying again.");
  }
  let episode = withExpiredHold(stored, now, ids);
  let shareToken: string | undefined;

  switch (command.type) {
    case "revise-intention": {
      const current = currentIntention(episode);
      const nextConstraints = {
        ...current.constraints,
        ...(command.constraints ?? {}),
      };
      const statement = command.statement?.trim() || current.statement;
      const nextVersion = current.version + 1;
      const ready =
        nextConstraints.energy && nextConstraints.budget && nextConstraints.social;
      episode = {
        ...episode,
        status: ready ? "ready" : "clarifying",
        intentions: [
          ...episode.intentions,
          {
            version: nextVersion,
            statement,
            desiredShift:
              command.desiredShift?.trim() || current.desiredShift,
            constraints: nextConstraints,
            changeReason: command.reason,
            createdAt: now.toISOString(),
          },
        ],
        recommendation: undefined,
        hold: undefined,
        monitor: undefined,
        coordination: undefined,
        events: [
          ...episode.events,
          event(ids, now, "intention-revised", command.reason),
        ],
      };
      break;
    }
    case "recommend": {
      // ADR 0011 §4: load cross-episode preferences so the ranking
      // policy can apply the preference-fit tie-breaker. Fire-and-forget
      // on failure — preferences are soft signals, never hard constraints.
      const preferences = await loadPreferences(actorId);
      episode = {
        ...episode,
        status: "recommendation-ready",
        recommendation: recommendForEpisode(episode, now, preferences),
        events: [
          ...episode.events,
          event(ids, now, "recommendation-created", "Mira chose one next step."),
        ],
      };
      // Semantic memory — fire-and-forget. recall() will surface the
      // recommendation on the practitioner's next visit. Never blocks
      // the response. Cognee is silent when unconfigured.
      fireSemanticRemember(
        episode.actorId,
        `recommendation:${episode.recommendation!.result.retreatRootHash}`,
      );
      break;
    }
    case "feedback": {
      episode = {
        ...episode,
        status: "clarifying",
        recommendation: undefined,
        hold: undefined,
        coordination: undefined,
        events: [
          ...episode.events,
          event(
            ids,
            now,
            "intention-revised",
            `The recommendation missed on ${command.reason}.`,
          ),
        ],
      };
      break;
    }
    case "reject-recommendation": {
      // "Not this one" — the practitioner rejects a specific retreat,
      // not a constraint dimension. We add it to rejectedRetreats and
      // re-recommend with it excluded, so the user gets a different top
      // pick without being sent back to clarification.
      if (!episode.recommendation) {
        throw new Error("Nothing to reject yet.");
      }
      const rejected = [
        ...(episode.rejectedRetreats ?? []),
        command.retreatRootHash,
      ];
      const preferences = await loadPreferences(actorId);
      try {
        const next = recommendForEpisode(episode, now, preferences, rejected);
        episode = {
          ...episode,
          status: "recommendation-ready",
          recommendation: next,
          rejectedRetreats: rejected,
          hold: undefined,
          coordination: undefined,
          events: [
            ...episode.events,
            event(
              ids,
              now,
              "recommendation-rejected",
              `Mira set aside ${command.retreatRootHash.slice(0, 8)} and chose another.`,
            ),
            event(ids, now, "recommendation-created", "Mira chose one next step."),
          ],
        };
      } catch {
        // All retreats exhausted — go back to clarification so the
        // practitioner can widen their constraints.
        episode = {
          ...episode,
          status: "clarifying",
          recommendation: undefined,
          rejectedRetreats: rejected,
          hold: undefined,
          coordination: undefined,
          events: [
            ...episode.events,
            event(
              ids,
              now,
              "recommendation-rejected",
              `Mira set aside ${command.retreatRootHash.slice(0, 8)}. Nothing else fits yet — let's revisit what matters.`,
            ),
          ],
        };
      }
      break;
    }
    case "start-monitoring": {
      if (!episode.recommendation) throw new Error("Nothing to monitor yet.");
      episode = {
        ...episode,
        status: "monitoring",
        monitor: {
          status: "active",
          watchFor: ["availability", "price", "deadline"],
          nextCheckAt: now.toISOString(),
          observations: episode.monitor?.observations ?? [],
        },
        events: [
          ...episode.events,
          event(ids, now, "monitor-started", "Mira started watching this option."),
        ],
      };
      break;
    }
    case "check-monitor": {
      if (!episode.recommendation || !episode.monitor) {
        throw new Error("Monitoring is not active.");
      }
      const observation = await localMonitoringProvider.observe({
        retreatId: episode.recommendation.result.retreatRootHash,
        listedPriceUsd: episode.recommendation.result.priceUsd,
        checkedAt: now,
        observationId: ids.create(),
      });
      episode = {
        ...episode,
        monitor: {
          ...episode.monitor,
          status: observation.available ? "satisfied" : "active",
          lastCheckedAt: now.toISOString(),
          nextCheckAt: new Date(now.getTime() + DAY).toISOString(),
          observations: [...episode.monitor.observations, observation].slice(-12),
        },
        events: [
          ...episode.events,
          event(ids, now, "monitor-observed", observation.summary),
        ],
      };
      break;
    }
    case "create-hold": {
      if (!episode.recommendation) throw new Error("Nothing to hold yet.");
      const hold = await localHoldProvider.create({
        retreatId: episode.recommendation.result.retreatRootHash,
        now,
        holdId: ids.create(),
      });
      episode = {
        ...episode,
        status: "held",
        hold,
        events: [
          ...episode.events,
          event(
            ids,
            now,
            "hold-created",
            "A non-binding 48-hour planning hold was created.",
          ),
        ],
      };
      break;
    }
    case "release-hold": {
      if (!episode.hold) throw new Error("No hold is active.");
      const hold = await localHoldProvider.release(episode.hold, now);
      episode = {
        ...episode,
        status: episode.monitor ? "monitoring" : "recommendation-ready",
        hold,
        coordination: undefined,
        events: [
          ...episode.events,
          event(ids, now, "hold-released", "The planning hold was released."),
        ],
      };
      break;
    }
    case "close-coordination": {
      if (!episode.coordination) {
        throw new Error("No coordination branch is open.");
      }
      if (episode.hold?.status !== "active") {
        throw new Error("No hold is active.");
      }
      episode = {
        ...episode,
        status: "held",
        coordination: undefined,
        events: [
          ...episode.events,
          event(
            ids,
            now,
            "coordination-closed",
            "The optional coordination branch was closed — you can continue solo.",
          ),
        ],
      };
      break;
    }
    case "create-invite": {
      if (episode.hold?.status !== "active") {
        throw new Error("Create a hold before inviting someone.");
      }
      if (!command.sharingConsent || !command.participantName.trim()) {
        throw new Error("A participant name and sharing consent are required.");
      }
      shareToken = randomBytes(24).toString("base64url");
      const invite = await localCoordinationProvider.createInvite({
        episodeId,
        participantName: command.participantName.trim(),
        token: shareToken,
        now,
      });
      await episodeRepository.createInvite({
        tokenHash: hashInviteToken(shareToken),
        episodeId,
        participantName: command.participantName.trim(),
        expiresAt: invite.expiresAt,
      });
      episode = {
        ...episode,
        status: "coordinating",
        coordination: {
          sharingConsent: true,
          participantName: command.participantName.trim(),
          inviteCreatedAt: now.toISOString(),
          inviteExpiresAt: invite.expiresAt,
          responses: [],
        },
        events: [
          ...episode.events,
          event(ids, now, "invite-created", "A private invitation was created."),
        ],
      };
      break;
    }
    case "record-commitment":
      episode = {
        ...episode,
        status: "booked",
        hold: episode.hold
          ? { ...episode.hold, status: "converted" }
          : episode.hold,
        commitment: {
          status: "booked",
          bookingRootHash: command.bookingRootHash,
          depositTxId: command.depositTxId,
          bookedAt: command.bookedAt,
        },
        events: [
          ...episode.events,
          event(ids, now, "commitment-recorded", "The booking was confirmed."),
        ],
      };
      // Semantic memory on commitment so the next-returning visit can
      // weave "the last place you booked" into the recognition line.
      fireSemanticRemember(
        episode.actorId,
        `commitment:${command.bookingRootHash}`,
      );
      break;
    case "grant-wider-aperture-contribution": {
      if (episode.commitment?.status !== "booked") {
        throw new Error(
          "Contribution is available after booking, to help Mira learn from completed journeys.",
        );
      }
      if (
        episode.widerApertureContribution?.grantedAt &&
        !episode.widerApertureContribution.revokedAt
      ) {
        break;
      }
      episode = {
        ...episode,
        widerApertureContribution: { grantedAt: now.toISOString() },
        events: [
          ...episode.events,
          event(
            ids,
            now,
            "wider-aperture-granted",
            "Anonymized patterns from this journey may be shared to help others.",
          ),
        ],
      };
      break;
    }
    case "revoke-wider-aperture-contribution": {
      if (!episode.widerApertureContribution?.grantedAt) break;
      episode = {
        ...episode,
        widerApertureContribution: {
          grantedAt: episode.widerApertureContribution.grantedAt,
          revokedAt: now.toISOString(),
        },
        events: [
          ...episode.events,
          event(
            ids,
            now,
            "wider-aperture-revoked",
            "Anonymized contribution from this journey was withdrawn.",
          ),
        ],
      };
      break;
    }
    case "pause":
      episode = {
        ...episode,
        status: "paused",
        events: [
          ...episode.events,
          event(ids, now, "episode-paused", "The intention was paused."),
        ],
      };
      break;
    case "complete":
      episode = {
        ...episode,
        status: "completed",
        events: [
          ...episode.events,
          event(ids, now, "episode-completed", "The intention was completed."),
        ],
      };
      break;
  }

  const updated: Episode = {
    ...episode,
    revision: stored.revision + 1,
    processedIdempotencyKeys: command.idempotencyKey
      ? [...(stored.processedIdempotencyKeys ?? []), command.idempotencyKey].slice(-100)
      : (stored.processedIdempotencyKeys ?? []),
    updatedAt: now.toISOString(),
  };
  return {
    episode: await episodeRepository.save(
      dependencies.skipOwnershipCheck ? stored.actorId : actorId,
      updated,
      command.expectedRevision,
    ),
    shareToken,
  };
}
