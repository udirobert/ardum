import "server-only";

import { episodeRepository } from "@/episodes/repository";
import { evidenceRepository } from "./repository";
import { projectCohortSlices } from "./project-cohort";
import type { WiderApertureStores } from "./resolve-wider-aperture";
import {
  SEED_WIDER_APERTURE_STORES,
  widerApertureSeedEnabled,
} from "./seed-wider-aperture";

function mergeCohortSlices(
  primary: WiderApertureStores["cohortSlices"],
  seed: WiderApertureStores["cohortSlices"],
): WiderApertureStores["cohortSlices"] {
  const merged = [...(primary ?? [])];
  for (const slice of seed ?? []) {
    const exists = merged.some(
      (item) =>
        item.energy === slice.energy &&
        item.social === slice.social &&
        item.sampleSize >= slice.sampleSize,
    );
    if (!exists) merged.push(slice);
  }
  return merged;
}

function mergePublicRecords(
  primary: WiderApertureStores["publicRecords"],
  seed: WiderApertureStores["publicRecords"],
): WiderApertureStores["publicRecords"] {
  const byKey = new Map<string, NonNullable<WiderApertureStores["publicRecords"]>[number]>();
  for (const record of [...(primary ?? []), ...(seed ?? [])]) {
    for (const key of record.retreatKeys) {
      const existing = byKey.get(key);
      if (!existing || record.confidence > existing.confidence) {
        byKey.set(key, record);
      }
    }
  }
  const seen = new Set<string>();
  const merged: NonNullable<WiderApertureStores["publicRecords"]> = [];
  for (const record of [...(primary ?? []), ...(seed ?? [])]) {
    const id = record.retreatKeys.join("|");
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(record);
  }
  return merged;
}

/** Server-side store loader for tier B/C wider-aperture evidence. */
export async function loadWiderApertureStores(): Promise<WiderApertureStores> {
  const [contributionEpisodes, publicRecords] = await Promise.all([
    episodeRepository.listContributionEpisodes(),
    evidenceRepository.listPublicEvidence(),
  ]);

  const stores: WiderApertureStores = {
    cohortSlices: projectCohortSlices(contributionEpisodes),
    publicRecords,
  };

  if (!widerApertureSeedEnabled()) return stores;

  return {
    cohortSlices: mergeCohortSlices(
      stores.cohortSlices,
      SEED_WIDER_APERTURE_STORES.cohortSlices,
    ),
    publicRecords: mergePublicRecords(
      stores.publicRecords,
      SEED_WIDER_APERTURE_STORES.publicRecords,
    ),
  };
}
