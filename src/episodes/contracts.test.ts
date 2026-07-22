import { describe, expect, it } from "vitest";
import { parseEpisodeCommand } from "./contracts";

// Pinned-once, mechanical test surface. The contract parser must recognize
// every command type the EpisodeCommand union declares; if a new type is
// added to the union, applying this test to it is a fast fail.
//
// The smoke journey is what catches the inverse drift (a type the service
// handles but the parser doesn't recognize); this file is what prevents it
// from ever existing in the first place.

const baseRevision = { expectedRevision: 1 };

describe("parseEpisodeCommand", () => {
  describe("recognizes every command type", () => {
    it("revise-intention", () => {
      expect(
        parseEpisodeCommand({
          type: "revise-intention",
          ...baseRevision,
          statement: "I want a calmer pace.",
          reason: "Travel window shifted.",
        }),
      ).toEqual({
        type: "revise-intention",
        expectedRevision: 1,
        statement: "I want a calmer pace.",
        desiredShift: undefined,
        constraints: {},
        reason: "Travel window shifted.",
      });
    });

    it("revise-intention with full constraint update", () => {
      expect(
        parseEpisodeCommand({
          type: "revise-intention",
          ...baseRevision,
          statement: "I want a slower pace.",
          desiredShift: "Return rested.",
          constraints: { energy: "low", budget: "1k-2k", social: "solo" },
          reason: "I have permission to slow down.",
        }),
      ).toEqual({
        type: "revise-intention",
        expectedRevision: 1,
        statement: "I want a slower pace.",
        desiredShift: "Return rested.",
        constraints: { energy: "low", budget: "1k-2k", social: "solo" },
        reason: "I have permission to slow down.",
      });
    });

    it("recommend", () => {
      expect(parseEpisodeCommand({ type: "recommend", ...baseRevision })).toEqual({
        type: "recommend",
        expectedRevision: 1,
      });
    });

    it("start-monitoring", () => {
      expect(
        parseEpisodeCommand({ type: "start-monitoring", ...baseRevision }),
      ).toEqual({ type: "start-monitoring", expectedRevision: 1 });
    });

    it("check-monitor", () => {
      expect(
        parseEpisodeCommand({ type: "check-monitor", ...baseRevision }),
      ).toEqual({ type: "check-monitor", expectedRevision: 1 });
    });

    it("create-hold", () => {
      expect(
        parseEpisodeCommand({ type: "create-hold", ...baseRevision }),
      ).toEqual({ type: "create-hold", expectedRevision: 1 });
    });

    it("release-hold", () => {
      expect(
        parseEpisodeCommand({ type: "release-hold", ...baseRevision }),
      ).toEqual({ type: "release-hold", expectedRevision: 1 });
    });

    it("close-coordination", () => {
      expect(
        parseEpisodeCommand({ type: "close-coordination", ...baseRevision }),
      ).toEqual({ type: "close-coordination", expectedRevision: 1 });
    });

    it("pause", () => {
      expect(parseEpisodeCommand({ type: "pause", ...baseRevision })).toEqual({
        type: "pause",
        expectedRevision: 1,
      });
    });

    it("complete", () => {
      expect(
        parseEpisodeCommand({ type: "complete", ...baseRevision }),
      ).toEqual({ type: "complete", expectedRevision: 1 });
    });

    it("feedback (every allowed reason)", () => {
      for (const reason of ["timing", "budget", "group", "place", "intention"] as const) {
        expect(
          parseEpisodeCommand({ type: "feedback", ...baseRevision, reason }),
        ).toEqual({ type: "feedback", expectedRevision: 1, reason });
      }
    });

    it("create-invite with sharing consent", () => {
      expect(
        parseEpisodeCommand({
          type: "create-invite",
          ...baseRevision,
          participantName: "Alex",
          sharingConsent: true,
        }),
      ).toEqual({
        type: "create-invite",
        expectedRevision: 1,
        participantName: "Alex",
        sharingConsent: true,
      });
    });

    it("record-commitment", () => {
      expect(
        parseEpisodeCommand({
          type: "record-commitment",
          ...baseRevision,
          bookingRootHash: "0xabc1230000000000000000000000000000000000",
          depositTxId: "0xdef4560000000000000000000000000000000000",
          bookedAt: "2026-07-11T12:00:00.000Z",
        }),
      ).toEqual({
        type: "record-commitment",
        expectedRevision: 1,
        bookingRootHash: "0xabc1230000000000000000000000000000000000",
        depositTxId: "0xdef4560000000000000000000000000000000000",
        bookedAt: "2026-07-11T12:00:00.000Z",
      });
    });
  });

  describe("rejects malformed input", () => {
    it("throws on unknown command type", () => {
      expect(() =>
        parseEpisodeCommand({ type: "commit-violently", ...baseRevision }),
      ).toThrow("Unknown episode command.");
    });

    it("throws on missing type", () => {
      expect(() => parseEpisodeCommand({ ...baseRevision })).toThrow(
        "Command type is required.",
      );
    });

    it("throws on missing expectedRevision", () => {
      expect(() => parseEpisodeCommand({ type: "recommend" })).toThrow(
        "A valid expectedRevision is required.",
      );
    });

    it("throws on non-integer expectedRevision", () => {
      expect(() =>
        parseEpisodeCommand({ type: "recommend", expectedRevision: 1.5 }),
      ).toThrow("A valid expectedRevision is required.");
    });

    it("throws on zero expectedRevision", () => {
      expect(() =>
        parseEpisodeCommand({ type: "recommend", expectedRevision: 0 }),
      ).toThrow("A valid expectedRevision is required.");
    });

    it("throws on feedback with disallowed reason", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "feedback",
          ...baseRevision,
          reason: "weather",
        }),
      ).toThrow("Invalid feedback reason.");
    });

    it("throws on create-invite without sharing consent", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "create-invite",
          ...baseRevision,
          participantName: "Alex",
        }),
      ).toThrow("Sharing consent is required.");
    });

    it("throws on create-invite with explicit false sharing consent", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "create-invite",
          ...baseRevision,
          participantName: "Alex",
          sharingConsent: false,
        }),
      ).toThrow("Sharing consent is required.");
    });

    it("throws on create-invite with empty participant name", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "create-invite",
          ...baseRevision,
          participantName: "   ",
          sharingConsent: true,
        }),
      ).toThrow("Participant name is required.");
    });

    it("throws on record-commitment missing bookingRootHash", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "record-commitment",
          ...baseRevision,
          depositTxId: "0xdef4560000000000000000000000000000000000",
          bookedAt: "2026-07-11T12:00:00.000Z",
        }),
      ).toThrow("Booking root hash is required.");
    });

    it("throws on record-commitment missing depositTxId", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "record-commitment",
          ...baseRevision,
          bookingRootHash: "0xabc1230000000000000000000000000000000000",
          bookedAt: "2026-07-11T12:00:00.000Z",
        }),
      ).toThrow("Deposit transaction id is required.");
    });

    it("throws on record-commitment missing bookedAt", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "record-commitment",
          ...baseRevision,
          bookingRootHash: "0xabc1230000000000000000000000000000000000",
          depositTxId: "0xdef4560000000000000000000000000000000000",
        }),
      ).toThrow("Booked at is required.");
    });

    it("throws on revise-intention without reason", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "revise-intention",
          ...baseRevision,
          statement: "Tighter scope.",
        }),
      ).toThrow("Change reason is required.");
    });

    it("throws on revise-intention with invalid energy constraint", () => {
      expect(() =>
        parseEpisodeCommand({
          type: "revise-intention",
          ...baseRevision,
          statement: "Tighter scope.",
          reason: "Reset.",
          constraints: { energy: "very-high" },
        }),
      ).toThrow("Invalid energy.");
    });

    it("throws when root is not an object", () => {
      expect(() => parseEpisodeCommand("recommend")).toThrow(
        "Expected an object.",
      );
      expect(() => parseEpisodeCommand(null)).toThrow("Expected an object.");
      expect(() => parseEpisodeCommand([1, 2, 3])).toThrow("Expected an object.");
    });
  });
});
