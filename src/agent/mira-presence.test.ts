import { describe, expect, it } from "vitest";
import {
  mergePresence,
  morphParamsForTier,
  presenceFromActivity,
  projectMiraPresence,
  ringStyle,
  STEADY_PRESENCE,
} from "./mira-presence";
import type { Episode } from "@/episodes/model";

const baseIntention = {
  version: 1,
  statement: "find a quiet week",
  constraints: { energy: "settled" as const, budget: "1k-2k" as const },
  changeReason: "Initial intention",
  createdAt: "2024-06-01T00:00:00.000Z",
};

function mkEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    schemaVersion: 1,
    id: "ep",
    actorId: "actor-1",
    revision: 1,
    status: "ready",
    intentions: [baseIntention],
    processedIdempotencyKeys: [],
    events: [],
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectMiraPresence", () => {
  it("returns steady posture for capturing episodes", () => {
    const presence = projectMiraPresence(
      mkEpisode({ status: "capturing" }),
    );
    expect(presence.posture).toBe("steady");
    expect(presence.valence).toBeLessThanOrEqual(1);
    expect(presence.valence).toBeGreaterThanOrEqual(-1);
  });

  it("maps monitoring status to watching", () => {
    const presence = projectMiraPresence(
      mkEpisode({
        status: "monitoring",
        monitor: {
          status: "active",
          watchFor: ["availability"],
          nextCheckAt: "2024-06-02T00:00:00.000Z",
          observations: [],
        },
      }),
    );
    expect(presence.posture).toBe("watching");
    expect(ringStyle(presence.posture)).toBe("open");
  });

  it("raises valence when hold is near expiry", () => {
    const now = Date.parse("2024-06-02T12:00:00.000Z");
    const presence = projectMiraPresence(
      mkEpisode({
        status: "held",
        hold: {
          id: "hold-1",
          retreatId: "r1",
          status: "active",
          expiresAt: "2024-06-02T13:00:00.000Z",
          createdAt: "2024-06-01T12:00:00.000Z",
          provider: "local",
        },
      }),
      now,
    );
    expect(presence.posture).toBe("holding");
    expect(presence.valence).toBeGreaterThan(0.1);
  });

  it("derives setback reaction and resolving posture from participant decline", () => {
    const presence = projectMiraPresence(
      mkEpisode({
        status: "coordinating",
        coordination: {
          sharingConsent: true,
          responses: [
            {
              participantId: "p1",
              decision: "no",
              respondedAt: "2024-06-02T00:00:00.000Z",
            },
          ],
        },
        events: [
          {
            id: "evt-1",
            type: "participant-responded",
            summary: "A participant declined.",
            createdAt: "2024-06-02T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(presence.reaction).toEqual({
      kind: "setback",
      eventId: "evt-1",
    });
    expect(presence.posture).toBe("resolving");
  });

  it("maps booked episodes to arriving with lower valence", () => {
    const presence = projectMiraPresence(
      mkEpisode({
        status: "booked",
        commitment: {
          status: "booked",
          bookingRootHash: "0x1",
          depositTxId: "0x2",
          bookedAt: "2024-06-03T00:00:00.000Z",
        },
      }),
    );
    expect(presence.posture).toBe("arriving");
    expect(presence.valence).toBeLessThan(0);
    expect(ringStyle(presence.posture)).toBe("radiating");
  });
});

describe("presenceFromActivity", () => {
  it("maps processing to inquiry", () => {
    expect(presenceFromActivity("processing").posture).toBe("inquiry");
  });

  it("maps idle to steady", () => {
    expect(presenceFromActivity("idle")).toEqual(STEADY_PRESENCE);
  });

  it("maps listening to steady with attentive valence", () => {
    const p = presenceFromActivity("listening");
    expect(p.posture).toBe("steady");
    expect(p.valence).toBeLessThan(0);
  });
});

describe("mergePresence", () => {
  it("overlays processing onto episode posture", () => {
    const base = projectMiraPresence(mkEpisode({ status: "held" }));
    const merged = mergePresence(base, "processing");
    expect(merged.posture).toBe("inquiry");
    expect(merged.reaction).toEqual(base.reaction);
  });
});

describe("morphParamsForTier", () => {
  it("caps blob count for inline tier", () => {
    const presence = projectMiraPresence(
      mkEpisode({ status: "coordinating" }),
    );
    const params = morphParamsForTier(presence, "inline");
    expect(params.blobCount).toBe(1);
    expect(params.orbitRadius).toBe(0);
  });
});
