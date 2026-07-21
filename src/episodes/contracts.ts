import type {
  EpisodeCommand,
  IntentionConstraints,
} from "./model";
import type { CreateEpisodeInput } from "./service";

const ENERGY = new Set(["settled", "in-movement", "low", "sharp"]);
const BUDGET = new Set(["under-1k", "1k-2k", "2k-3k", "3k-plus"]);
const SOCIAL = new Set([
  "solo",
  "small-circle",
  "open-circle",
  "communal",
]);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, max = 800): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${name} is too long.`);
  return trimmed;
}

function revision(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error("A valid expectedRevision is required.");
  }
  return Number(value);
}

function constraints(value: unknown): Partial<IntentionConstraints> {
  if (value === undefined) return {};
  const input = object(value);
  const result: Partial<IntentionConstraints> = {};
  if (input.energy !== undefined) {
    if (!ENERGY.has(String(input.energy))) throw new Error("Invalid energy.");
    result.energy = input.energy as IntentionConstraints["energy"];
  }
  if (input.budget !== undefined) {
    if (!BUDGET.has(String(input.budget))) throw new Error("Invalid budget.");
    result.budget = input.budget as IntentionConstraints["budget"];
  }
  if (input.social !== undefined) {
    if (!SOCIAL.has(String(input.social))) throw new Error("Invalid social comfort.");
    result.social = input.social as IntentionConstraints["social"];
  }
  if (input.horizon !== undefined) {
    result.horizon = text(input.horizon, "Horizon", 120);
  }
  if (input.partySize !== undefined) {
    const partySize = Number(input.partySize);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
      throw new Error("Party size must be between 1 and 20.");
    }
    result.partySize = partySize;
  }
  return result;
}

export function parseCreateEpisode(value: unknown): CreateEpisodeInput {
  const input = object(value);
  return {
    statement: text(input.statement, "Intention"),
    desiredShift:
      input.desiredShift === undefined
        ? undefined
        : text(input.desiredShift, "Desired shift", 400),
    constraints: constraints(input.constraints),
    persistenceConsent: input.persistenceConsent === true,
  };
}

export function parseEpisodeCommand(value: unknown): EpisodeCommand {
  const input = object(value);
  const type = text(input.type, "Command type", 40);
  const expectedRevision = revision(input.expectedRevision);
  switch (type) {
    case "revise-intention":
      return {
        type,
        expectedRevision,
        statement:
          input.statement === undefined
            ? undefined
            : text(input.statement, "Intention"),
        desiredShift:
          input.desiredShift === undefined
            ? undefined
            : text(input.desiredShift, "Desired shift", 400),
        constraints: constraints(input.constraints),
        reason: text(input.reason, "Change reason", 160),
      };
    case "recommend":
    case "start-monitoring":
    case "check-monitor":
    case "create-hold":
    case "release-hold":
    case "pause":
    case "complete":
      return { type, expectedRevision };
    case "feedback": {
      const reason = String(input.reason);
      if (!["timing", "budget", "group", "place", "intention"].includes(reason)) {
        throw new Error("Invalid feedback reason.");
      }
      return {
        type,
        expectedRevision,
        reason: reason as Extract<EpisodeCommand, { type: "feedback" }>["reason"],
      };
    }
    case "create-invite":
      if (input.sharingConsent !== true) {
        throw new Error("Sharing consent is required.");
      }
      return {
        type,
        expectedRevision,
        participantName: text(input.participantName, "Participant name", 80),
        sharingConsent: true,
      };
    case "record-commitment": {
      const bookingRootHash = text(
        input.bookingRootHash,
        "Booking root hash",
        200,
      );
      const depositTxId = text(
        input.depositTxId,
        "Deposit transaction id",
        200,
      );
      const bookedAt = text(input.bookedAt, "Booked at", 40);
      return {
        type,
        expectedRevision,
        bookingRootHash,
        depositTxId,
        bookedAt,
      };
    }
    case "grant-wider-aperture-contribution":
    case "revoke-wider-aperture-contribution":
      return { type, expectedRevision };
    default:
      throw new Error("Unknown episode command.");
  }
}

export function parseInviteResponse(value: unknown): {
  decision: "yes" | "no" | "unsure";
  note?: string;
} {
  const input = object(value);
  const decision = String(input.decision);
  if (!["yes", "no", "unsure"].includes(decision)) {
    throw new Error("Invalid response.");
  }
  return {
    decision: decision as "yes" | "no" | "unsure",
    note:
      input.note === undefined || input.note === ""
        ? undefined
        : text(input.note, "Note", 400),
  };
}
