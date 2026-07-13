import { describe, expect, it } from "vitest";
import {
  activeEpisodePresence,
  buildEpisodeActionPayload,
  buildEpisodeDetailPayload,
  buildEpisodeListPayload,
} from "./detail-payload";
import type { Episode } from "./model";

function mkEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    schemaVersion: 1,
    id: "ep",
    actorId: "actor-1",
    revision: 1,
    status: "monitoring",
    intentions: [
      {
        version: 1,
        statement: "quiet week",
        constraints: { energy: "settled", budget: "1k-2k" },
        changeReason: "Initial intention",
        createdAt: "2024-06-01T00:00:00.000Z",
      },
    ],
    monitor: {
      status: "active",
      watchFor: ["availability"],
      nextCheckAt: "2024-06-02T00:00:00.000Z",
      observations: [],
    },
    processedIdempotencyKeys: [],
    events: [],
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildEpisodeDetailPayload", () => {
  it("includes nextDecision and miraPresence derived from episode status", () => {
    const episode = mkEpisode();
    const payload = buildEpisodeDetailPayload({ episode });
    expect(payload.episode).toBe(episode);
    expect(payload.nextDecision.kind).toBeTruthy();
    expect(payload.miraPresence.posture).toBe("watching");
  });
});

describe("buildEpisodeActionPayload", () => {
  it("projects miraPresence after a command result", () => {
    const episode = mkEpisode({ status: "held" });
    const payload = buildEpisodeActionPayload({ episode });
    expect(payload.miraPresence.posture).toBe("holding");
    expect(payload.nextDecision).toBeTruthy();
  });
});

describe("buildEpisodeListPayload", () => {
  it("surfaces activeMiraPresence for the first non-completed episode", () => {
    const payload = buildEpisodeListPayload({
      episodes: [
        mkEpisode({ id: "active", status: "monitoring" }),
        mkEpisode({ id: "done", status: "completed" }),
      ],
      memory: null,
    });
    expect(payload.activeMiraPresence?.posture).toBe("watching");
  });

  it("returns null activeMiraPresence when every episode is completed", () => {
    const payload = buildEpisodeListPayload({
      episodes: [mkEpisode({ status: "completed" })],
      memory: null,
    });
    expect(payload.activeMiraPresence).toBeNull();
  });
});

describe("activeEpisodePresence", () => {
  it("ignores completed episodes", () => {
    expect(
      activeEpisodePresence([
        mkEpisode({ status: "completed" }),
        mkEpisode({ id: "b", status: "coordinating" }),
      ])?.posture,
    ).toBe("gathering");
  });
});
