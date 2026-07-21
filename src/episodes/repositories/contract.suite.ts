// Repository contract shared between all storage adapters. Run the same set
// of conformance cases against the local in-memory adapter and against a
// mocked Supabase client to prove both honor ownership, optimistic
// concurrency, hashed invite capabilities, single-response enforcement,
// expiration, and cascade deletion.
import { beforeEach, describe, expect, it } from "vitest";

import { EPISODE_SCHEMA_VERSION, type Episode } from "../model";
import type { EpisodeRepository, InviteRecord } from "../repository";

function makeEpisode(
  id: string,
  actorId: string,
  overrides: Partial<Episode> = {},
): Episode {
  const now = "2026-07-11T00:00:00.000Z";
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id,
    actorId,
    revision: 1,
    status: "clarifying",
    intentions: [
      {
        version: 1,
        statement: "Make space to recover",
        constraints: {},
        changeReason: "Initial intention",
        createdAt: now,
      },
    ],
    processedIdempotencyKeys: [],
    events: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function runRepositoryContract(
  label: string,
  factory: () => EpisodeRepository,
  reset: () => void | Promise<void>,
): void {
  describe(`${label}: episode repository contract`, () => {
    let repo: EpisodeRepository;

    beforeEach(async () => {
      await reset();
      repo = factory();
    });

    it("enforces ownership on getOwned", async () => {
      const episode = makeEpisode("ep-owner", "owner");
      await repo.create(episode);
      expect(await repo.getOwned("owner", "ep-owner")).toEqual(episode);
      expect(await repo.getOwned("someone-else", "ep-owner")).toBeUndefined();
      expect(await repo.getOwned("owner", "missing")).toBeUndefined();
    });

    it("lists only the requested actor's episodes, newest first", async () => {
      await repo.create(
        makeEpisode("alice-old", "alice", { updatedAt: "2026-01-01T00:00:00.000Z" }),
      );
      await repo.create(
        makeEpisode("alice-new", "alice", { updatedAt: "2026-07-10T00:00:00.000Z" }),
      );
      await repo.create(
        makeEpisode("bob-only", "bob", { updatedAt: "2026-07-09T00:00:00.000Z" }),
      );
      const alice = await repo.listOwned("alice");
      expect(alice.map((e) => e.id)).toEqual(["alice-new", "alice-old"]);
      const bob = await repo.listOwned("bob");
      expect(bob.map((e) => e.id)).toEqual(["bob-only"]);
    });

    it("rejects duplicate episode ids on create", async () => {
      await repo.create(makeEpisode("dup", "owner"));
      await expect(repo.create(makeEpisode("dup", "owner"))).rejects.toThrow();
    });

    it("rejects stale revisions on save with a 'changed' error", async () => {
      const episode = makeEpisode("stale", "owner");
      await repo.create(episode);
      await repo.save("owner", { ...episode, revision: 2 }, 1);
      await expect(
        repo.save("owner", { ...episode, revision: 3 }, 1),
      ).rejects.toThrow(/changed|refresh|revision/i);
    });

    it("rejects save from a non-owner", async () => {
      const episode = makeEpisode("no-owner", "owner");
      await repo.create(episode);
      await expect(
        repo.save("intruder", { ...episode, revision: 2 }, 1),
      ).rejects.toThrow();
    });

    it("returns the freshly saved state on success", async () => {
      const episode = makeEpisode("roundtrip", "owner");
      await repo.create(episode);
      const saved = await repo.save(
        "owner",
        { ...episode, revision: 2, status: "ready" },
        1,
      );
      expect(saved.revision).toBe(2);
      expect(saved.status).toBe("ready");
      expect(await repo.getOwned("owner", "roundtrip")).toEqual(saved);
    });

    it("stores invites only by tokenHash; raw tokens cannot be retrieved", async () => {
      // The referenced episode must exist before the invite's FK can be
      // satisfied against a real relational database. The local in-memory
      // and mock adapters don't enforce FKs; the suite is intentionally
      // lenient there. Pre-creating here keeps the contract consistent
      // across all adapters and matches the storage invariant real DBs
      // actually enforce.
      await repo.create(makeEpisode("roundtrip", "owner"));
      const record: InviteRecord = {
        tokenHash: "hash-only",
        episodeId: "roundtrip",
        participantName: "Sam",
        expiresAt: "2099-01-01T00:00:00.000Z",
      };
      await repo.createInvite(record);
      expect(await repo.getInvite("hash-only")).toEqual(record);
      expect(await repo.getInvite("raw-token")).toBeUndefined();
    });

    it("rejects a duplicate invite response", async () => {
      await repo.create(makeEpisode("for-invite", "owner"));
      await repo.createInvite({
        tokenHash: "single",
        episodeId: "for-invite",
        participantName: "Sam",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      const first = {
        participantId: "p1",
        decision: "yes" as const,
        respondedAt: "2026-07-11T00:00:00.000Z",
      };
      await repo.respondToInvite("single", first);
      await expect(
        repo.respondToInvite("single", {
          ...first,
          respondedAt: "2026-07-11T00:01:00.000Z",
        }),
      ).rejects.toThrow();
    });

    it("rejects a response after the invitation has expired", async () => {
      await repo.create(makeEpisode("expired-ep", "owner"));
      await repo.createInvite({
        tokenHash: "expired-token",
        episodeId: "expired-ep",
        participantName: "Sam",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });
      await expect(
        repo.respondToInvite("expired-token", {
          participantId: "p1",
          decision: "yes",
          respondedAt: "2026-07-11T00:00:00.000Z",
        }),
      ).rejects.toThrow();
    });

    it("listDue surfaces only episodes whose next action has passed", async () => {
      await repo.create(
        makeEpisode("due-past", "owner", {
          monitor: {
            status: "active",
            watchFor: ["availability"],
            nextCheckAt: "2020-01-01T00:00:00.000Z",
            observations: [],
          },
        }),
      );
      await repo.create(
        makeEpisode("due-future", "owner", {
          monitor: {
            status: "active",
            watchFor: ["availability"],
            nextCheckAt: "2999-01-01T00:00:00.000Z",
            observations: [],
          },
        }),
      );
      await repo.create(
        makeEpisode("due-satisfied", "owner", {
          monitor: {
            status: "satisfied",
            watchFor: ["availability"],
            nextCheckAt: "2000-01-01T00:00:00.000Z",
            observations: [],
          },
        }),
      );
      await repo.create(makeEpisode("due-none", "owner"));
      const due = await repo.listDue(new Date("2026-07-11T00:00:00.000Z"));
      expect(due.map((e) => e.id)).toEqual(["due-past"]);
    });

    it("deleteOwned is silent for non-owners and cascades invites for owners", async () => {
      await repo.create(makeEpisode("alice-ep", "alice"));
      await repo.create(makeEpisode("bob-ep", "bob"));
      await repo.createInvite({
        tokenHash: "alice-invite",
        episodeId: "alice-ep",
        participantName: "Sam",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      const beforeAlice = await repo.getOwned("alice", "alice-ep");
      expect(beforeAlice).toBeDefined();
      // Non-owner delete leaves the episode intact.
      await repo.deleteOwned("intruder", "alice-ep");
      expect(await repo.getOwned("alice", "alice-ep")).toBeDefined();
      // Owner delete removes the episode and its associated invites.
      await repo.deleteOwned("alice", "alice-ep");
      expect(await repo.getOwned("alice", "alice-ep")).toBeUndefined();
      expect(await repo.getInvite("alice-invite")).toBeUndefined();
      expect(await repo.getOwned("bob", "bob-ep")).toBeDefined();
    });

    it("listContributionEpisodes returns only active contribution grants", async () => {
      await repo.create(
        makeEpisode("granted", "alice", {
          widerApertureContribution: { grantedAt: "2026-07-01T00:00:00.000Z" },
        }),
      );
      await repo.create(
        makeEpisode("revoked", "alice", {
          widerApertureContribution: {
            grantedAt: "2026-07-01T00:00:00.000Z",
            revokedAt: "2026-07-02T00:00:00.000Z",
          },
        }),
      );
      await repo.create(makeEpisode("none", "alice"));
      const contribution = await repo.listContributionEpisodes();
      expect(contribution.map((episode) => episode.id)).toEqual(["granted"]);
    });
  });
}
