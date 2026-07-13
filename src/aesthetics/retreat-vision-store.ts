// Persistent retreat vision cache — localStorage, keyed by vector fingerprint.
// Disposable client cache per architecture; avoids repeat resolution work.

import type { RetreatVisionArtifact } from "./resolve-retreat-vision";

const VISION_KEY = "ardum:retreat-vision";

type StoredVision = RetreatVisionArtifact & { cachedAt: string };

function readAll(): Record<string, StoredVision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VISION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredVision>;
  } catch {
    return {};
  }
}

function writeAll(entries: Record<string, StoredVision>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VISION_KEY, JSON.stringify(entries));
}

export function readCachedRetreatVision(
  fingerprint: string,
): RetreatVisionArtifact | null {
  const entry = readAll()[fingerprint];
  if (!entry) return null;
  const { cachedAt, ...artifact } = entry;
  void cachedAt;
  return artifact;
}

export function writeCachedRetreatVision(artifact: RetreatVisionArtifact): void {
  const entries = readAll();
  entries[artifact.fingerprint] = {
    ...artifact,
    cachedAt: new Date().toISOString(),
  };
  writeAll(entries);
}

export function readLatestRetreatVision(): RetreatVisionArtifact | null {
  const entries = Object.values(readAll());
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
  const { cachedAt, ...artifact } = entries[0];
  void cachedAt;
  return artifact;
}
