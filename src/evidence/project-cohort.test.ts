import { describe, expect, it } from "vitest";
import { EPISODE_SCHEMA_VERSION, type Episode } from "@/episodes/model";
import { projectCohortSlices } from "./project-cohort";
import { MIN_COHORT_SAMPLE_SIZE } from "./wider-aperture";

function mkEpisode(
  id: string,
  constraints: Episode["intentions"][0]["constraints"],
): Episode {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id,
    actorId: `actor-${id}`,
    revision: 1,
    status: "booked",
    intentions: [
      {
        version: 1,
        statement: "quiet recovery",
        constraints,
        changeReason: "Initial intention",
        createdAt: now,
      },
    ],
    commitment: {
      status: "booked",
      bookingRootHash: "hash",
      depositTxId: "tx",
      bookedAt: now,
    },
    widerApertureContribution: { grantedAt: now },
    processedIdempotencyKeys: [],
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("projectCohortSlices", () => {
  it("returns no slices below the minimum sample size", () => {
    const episodes = Array.from({ length: MIN_COHORT_SAMPLE_SIZE - 1 }, (_, i) =>
      mkEpisode(String(i), { energy: "low", social: "solo" }),
    );
    expect(projectCohortSlices(episodes)).toEqual([]);
  });

  it("projects a slice when enough contributors share a shape", () => {
    const episodes = Array.from({ length: MIN_COHORT_SAMPLE_SIZE }, (_, i) =>
      mkEpisode(String(i), { energy: "low", social: "solo" }),
    );
    const slices = projectCohortSlices(episodes);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.sampleSize).toBe(MIN_COHORT_SAMPLE_SIZE);
    expect(slices[0]?.energy).toBe("low");
    expect(slices[0]?.social).toBe("solo");
  });

  it("ignores episodes without an active contribution grant", () => {
    const episodes = Array.from({ length: MIN_COHORT_SAMPLE_SIZE }, (_, i) => {
      const episode = mkEpisode(String(i), { energy: "low", social: "solo" });
      return { ...episode, widerApertureContribution: undefined };
    });
    expect(projectCohortSlices(episodes)).toEqual([]);
  });

  it("ignores revoked contribution grants", () => {
    const episodes = Array.from({ length: MIN_COHORT_SAMPLE_SIZE }, (_, i) => {
      const episode = mkEpisode(String(i), { energy: "low", social: "solo" });
      return {
        ...episode,
        widerApertureContribution: {
          grantedAt: "2026-07-01T00:00:00.000Z",
          revokedAt: "2026-07-02T00:00:00.000Z",
        },
      };
    });
    expect(projectCohortSlices(episodes)).toEqual([]);
  });
});
