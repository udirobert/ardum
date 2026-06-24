"use client";

import type { MatchRun, ReasoningStep } from "@/matching/types";

const STORAGE_KEY = "ardum:sessions";

type StoredSession = {
  run: MatchRun;
  steps: ReasoningStep[];
  savedAt: number;
};

export function saveMatchResult(
  sessionId: string,
  run: MatchRun,
  steps: ReasoningStep[]
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, StoredSession> = raw ? JSON.parse(raw) : {};
    all[sessionId] = { run, steps, savedAt: Date.now() };
    // Keep only the last 10 sessions to avoid unbounded growth.
    const keys = Object.keys(all).sort(
      (a, b) => (all[b]?.savedAt ?? 0) - (all[a]?.savedAt ?? 0)
    );
    if (keys.length > 10) {
      for (const k of keys.slice(10)) delete all[k];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage may be full or unavailable; silently ignore.
  }
}

export function getMatchResult(
  sessionId: string
): StoredSession | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all: Record<string, StoredSession> = JSON.parse(raw);
    return all[sessionId];
  } catch {
    return;
  }
}

export function findMatchResultByRetreatId(
  retreatId: string
): StoredSession | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all: Record<string, StoredSession> = JSON.parse(raw);
    for (const s of Object.values(all)) {
      if (s.run.results.some((r) => r.id === retreatId || r.retreatRootHash === retreatId)) {
        return s;
      }
    }
  } catch {
    return;
  }
}
