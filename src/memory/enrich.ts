// Optional semantic-memory supplementation on top of the projector.
//
// matchLetter() gates recognition on `memory.isReturning` (operational)
// but gates the pastNotes weave on `provider !== "none"` (semantic).
// That division exists on purpose: the projector gives us "this
// practitioner has surfaced recommendations" reliably, while Cognee
// gives us free-form diary/recall entries when configured. This module
// is the bridge — it asks Cognee for recall, and if anything
// meaningful comes back, marks the result as semantically-supplemented.

import type { Episode } from "@/episodes/model";
import type { MemoryContext, SemanticMemory } from "./semantic-memory";
import { projectMemoryForActor } from "./projector";

// One query string for any caller that doesn't override. Kept as a
// constant so a future tweak lands in one place. Vague enough to
// recall diary entries, prior reflection notes, and recognized
// phrasing across the practitioner.
export const DEFAULT_RECOGNITION_QUERY =
  "returning practitioner summary";

export type EnrichOptions = {
  query?: string;
  // Bounded timeout for `semantic.recall()` in milliseconds. Defaults
  // to 800ms — long enough for a warm network roundtrip to a typical
  // Cognee deployment, short enough that a slow or unreachable Cognee
  // never blocks SSR. Overridable per call.
  recallTimeoutMs?: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

// Required params first, options last — putting an optional middle
// parameter ahead of a required trailing one is an API foot-gun
// (omitting it silently mis-positions the next argument). Future
// extensions (maxRecall, recallDeadline, etc.) belong inside `opts`.
export async function enrichWithSemanticMemory(
  projected: MemoryContext,
  actorId: string,
  semantic: SemanticMemory,
  opts: EnrichOptions = {},
): Promise<MemoryContext> {
  const query = opts.query ?? DEFAULT_RECOGNITION_QUERY;
  const timeoutMs = opts.recallTimeoutMs ?? 800;
  const recall = await withTimeout(semantic.recall(actorId, query), timeoutMs);
  if (!recall || recall.length === 0) return projected;
  // pastNotes keeps whitespace-only strings on purpose: the filter is
  // `.filter(Boolean)`, not `.filter((t) => t.trim())`. Whitespace-
  // only snippets are uncommon from Cognee but not invalid; pin this
  // here so a future "tightening" refactor that swaps in trim() fails
  // the lockdown test in src/memory/enrich.test.ts explicitly.
  return {
    ...projected,
    pastNotes: recall.map((item) => item.text).filter(Boolean).slice(0, 5),
    rawRecall: recall,
    provider: "cognee",
  };
}

// Single entrypoint every caller should use. Wraps the pure
// projector under a `semantic` argument so list, detail, and the
// home-page SSR all share one code path. Without `semantic`, the
// result is the projector output unchanged — and callers that
// deliberately want to skip Cognee enrichment (the home page, e.g.,
// keeps SSR strictly operational) can do so without duplicating the
// `projectMemoryForActor` invocation.
export async function projectActorMemory(
  actorId: string,
  episodes: Episode[],
  semantic?: SemanticMemory,
  opts: EnrichOptions = {},
): Promise<MemoryContext> {
  const projected = projectMemoryForActor(actorId, episodes);
  if (!semantic) return projected;
  return enrichWithSemanticMemory(projected, actorId, semantic, opts);
}
