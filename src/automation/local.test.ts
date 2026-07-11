import { describe, expect, it } from "vitest";
import {
  localCoordinationProvider,
  localHoldProvider,
  localMonitoringProvider,
} from "./local";

describe("local automation providers", () => {
  it("returns deterministic observations for the same check window", async () => {
    const input = {
      retreatId: "retreat-1",
      listedPriceUsd: 1200,
      checkedAt: new Date("2026-07-11T10:00:00.000Z"),
      observationId: "observation-1",
    };
    expect(await localMonitoringProvider.observe(input)).toEqual(
      await localMonitoringProvider.observe(input),
    );
  });

  it("creates a clearly bounded 48-hour hold", async () => {
    const now = new Date("2026-07-11T10:00:00.000Z");
    const hold = await localHoldProvider.create({
      retreatId: "retreat-1",
      now,
      holdId: "hold-1",
    });
    expect(hold.status).toBe("active");
    expect(new Date(hold.expiresAt).getTime() - now.getTime()).toBe(
      48 * 60 * 60 * 1000,
    );
  });

  it("creates expiring invitations without adding private content", async () => {
    const invite = await localCoordinationProvider.createInvite({
      episodeId: "episode-1",
      participantName: "Sam",
      token: "opaque",
      now: new Date("2026-07-11T10:00:00.000Z"),
    });
    expect(invite.token).toBe("opaque");
    expect(Object.keys(invite)).toEqual(["token", "expiresAt"]);
  });
});
