// Cognee memory layer — SERVER ONLY. Never import from a client component;
// the API key must not leak.
//
// Mira's real memory. This replaces the localStorage-only fingerprint with a
// persistent, hybrid graph-vector knowledge store that survives across
// sessions, devices, and serverless cold-starts.
//
// The same code targets two prize tracks:
//   - COGNEE_BASE_URL=http://localhost:8000  → self-hosted Cognee (Open Source track)
//   - COGNEE_BASE_URL=https://your-tenant.aws.cognee.ai → Cognee Cloud (Cloud track)
//
// When COGNEE_BASE_URL + COGNEE_API_KEY are unset, every call is a graceful
// no-op — the app runs in demo mode exactly as before. This mirrors the
// existing adapter pattern (0G Storage, Supabase, Magic, Particle, Openfort).

import "server-only";

// ── Configuration ────────────────────────────────────────────────────────

type CogneeEnv = {
  COGNEE_BASE_URL: string;
  COGNEE_API_KEY: string;
};

function readCogneeEnv(): CogneeEnv {
  return {
    COGNEE_BASE_URL: process.env.COGNEE_BASE_URL ?? "",
    COGNEE_API_KEY: process.env.COGNEE_API_KEY ?? "",
  };
}

export function hasCognee(): boolean {
  const e = readCogneeEnv();
  return Boolean(e.COGNEE_BASE_URL && e.COGNEE_API_KEY);
}

// Per-practitioner dataset isolation. Each practitioner's memory is scoped
// to its own dataset so recall never leaks across users and forget() can
// surgically wipe one person without touching anyone else.
export function userDataset(userId: string): string {
  // Cognee dataset names allow alphanumerics, hyphens, underscores.
  return `ardum-user-${userId.replace(/[^a-zA-Z0-9-]/g, "")}`;
}

// Shared dataset for retreat knowledge — the catalog of retreats, their
// practice styles, and what past practitioners valued about them. This is
// the "world knowledge" graph that recall can traverse alongside the
// per-user graph.
export const RETREAT_DATASET = "ardum-retreats";

// ── Types ────────────────────────────────────────────────────────────────

export type MemoryEntry = {
  text: string;
  source: string;
  timestamp: string;
};

export type RecallResult = {
  text: string;
  // Optional metadata Cognee may return (source chunks, graph nodes, etc.)
  [key: string]: unknown;
};

// Structured memory context that gets fed into Mira's voice generation and
// the matching agent. Built from recall results so the downstream code
// doesn't have to parse free text.
export type MemoryContext = {
  // Has the practitioner visited before?
  isReturning: boolean;
  // Past energy states, oldest first. Lets Mira see trajectory.
  energyHistory: string[];
  // Past matches Mira has recommended (titles + locations).
  pastMatches: { title: string; location: string; score: number }[];
  // Past bookings.
  pastBookings: { title: string; location: string }[];
  // Free-text notes the practitioner has shared across sessions.
  pastNotes: string[];
  // The raw recall text, for the transparency page.
  rawRecall: RecallResult[];
  // Which provider served this recall (for the agent trace).
  provider: "cognee" | "none";
};

export const EMPTY_MEMORY: MemoryContext = {
  isReturning: false,
  energyHistory: [],
  pastMatches: [],
  pastBookings: [],
  pastNotes: [],
  rawRecall: [],
  provider: "none",
};

// ── Low-level REST client ────────────────────────────────────────────────

async function cogneeFetch(
  path: string,
  options: {
    method: string;
    body?: FormData | Record<string, unknown>;
    signal?: AbortSignal;
  },
): Promise<Response> {
  const env = readCogneeEnv();
  const base = env.COGNEE_BASE_URL.replace(/\/$/, "");
  const url = `${base}${path}`;
  const headers: Record<string, string> = {
    "X-Api-Key": env.COGNEE_API_KEY,
  };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  return fetch(url, {
    method: options.method,
    headers,
    body,
    signal: options.signal,
  });
}

// ── The four memory verbs ────────────────────────────────────────────────

/**
 * remember() — Ingest text and build the knowledge graph in one call.
 *
 * Stores a memory entry in the practitioner's dataset. Cognee extracts
 * entities and relationships automatically (e.g. "practitioner", "energy",
 * "retreat", "booking") so recall can traverse the graph later.
 *
 * Never throws. If Cognee is down, returns credits-exhausted (402), or
 * the network fails, the error is logged and the call silently no-ops.
 * The match flow does not depend on remember() succeeding — it's
 * fire-and-forget at every call site.
 */
export async function remember(
  userId: string,
  text: string,
  opts?: { dataset?: string; sessionId?: string; signal?: AbortSignal },
): Promise<void> {
  if (!hasCognee()) return;
  const dataset = opts?.dataset ?? userDataset(userId);
  const form = new FormData();
  // Cognee's /api/v1/remember expects file uploads in `data`. We wrap the
  // text in a Blob so it's treated as a text file ingestion.
  form.append("data", new Blob([text], { type: "text/plain" }), "memory.txt");
  form.append("datasetName", dataset);
  if (opts?.sessionId) form.append("session_id", opts.sessionId);
  try {
    const res = await cogneeFetch("/api/v1/remember", {
      method: "POST",
      body: form,
      signal: opts?.signal,
    });
    if (!res.ok) {
      // 402 = credits exhausted, 401/403 = bad key, 500 = server error,
      // 503 = maintenance. All degrade to a silent no-op — the app
      // works without memory, just without cross-session recall.
      const body = await res.text().catch(() => "");
      console.error(
        `[ardum] cognee.remember failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.error("[ardum] cognee.remember error:", err);
  }
}

/**
 * recall() — Query memory with auto-routing between semantic similarity
 * and deep graph traversals.
 *
 * Returns raw recall results from Cognee. Callers typically use
 * buildMemoryContext() to parse these into a structured MemoryContext.
 */
export async function recall(
  userId: string,
  query: string,
  opts?: { dataset?: string; signal?: AbortSignal },
): Promise<RecallResult[]> {
  if (!hasCognee()) return [];
  const dataset = opts?.dataset ?? userDataset(userId);
  try {
    const res = await cogneeFetch("/api/v1/recall", {
      method: "POST",
      body: {
        query,
        datasets: [dataset],
        // Use CHUNKS search type to get raw text segments from the
        // knowledge graph. GRAPH_COMPLETION (the default) returns
        // LLM-generated completions which are harder to parse into
        // structured memory. CHUNKS gives us the raw extracted text
        // which our buildMemoryContext() parser can work with.
        searchType: "CHUNKS",
        topK: 20,
      },
      signal: opts?.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[ardum] cognee.recall failed (${res.status}): ${body.slice(0, 200)}`,
      );
      return [];
    }
    const data = await res.json();
    // Cognee's recall endpoint returns an array of entries with
    // different shapes depending on the source (graph, session, trace).
    // Each entry may have `text`, `content`, `answer`, or `chunk`
    // fields. We normalize to RecallResult with a `text` field.
    const rawItems: unknown[] = Array.isArray(data)
      ? data
      : data?.results && Array.isArray(data.results)
        ? data.results
        : [];
    return rawItems.map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        text:
          (obj.text as string) ??
          (obj.content as string) ??
          (obj.answer as string) ??
          (obj.chunk as string) ??
          JSON.stringify(obj),
        source: (obj.source as string) ?? "graph",
        timestamp: (obj.timestamp as string) ?? new Date().toISOString(),
        ...obj,
      } as RecallResult;
    });
  } catch (err) {
    console.error("[ardum] cognee.recall error:", err);
    return [];
  }
}

/**
 * improve() — Run post-ingestion enrichment, prune stale nodes, and adapt
 * weights based on feedback.
 *
 * Called after a practitioner provides feedback on a match or booking, or
 * periodically to let the graph settle and surface deeper relationships.
 */
export async function improve(
  userId: string,
  opts?: { dataset?: string; signal?: AbortSignal },
): Promise<void> {
  if (!hasCognee()) return;
  const dataset = opts?.dataset ?? userDataset(userId);
  try {
    const res = await cogneeFetch("/api/v1/improve", {
      method: "POST",
      body: {
        datasetName: dataset,
        // Run enrichment asynchronously — the improve call is
        // fire-and-forget from every call site (feedback loops, the
        // memory page button). Blocking would add latency the user
        // doesn't need to wait for.
        runInBackground: true,
      },
      signal: opts?.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[ardum] cognee.improve failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.error("[ardum] cognee.improve error:", err);
  }
}

/**
 * forget() — Surgically prune or delete a dataset when it's no longer
 * needed.
 *
 * When called with a userId, deletes that practitioner's entire memory
 * (the "right to be forgotten" / "clear my memory" UX). When called with
 * everything=true, wipes all Ardum datasets — used only in tests.
 *
 * Uses the DELETE /api/v1/datasets endpoints (the canonical deletion
 * path per the Cognee API reference). The single-dataset path requires
 * a dataset UUID (not the name), so we first list datasets to find the
 * UUID by name.
 */
export async function forget(
  userId?: string,
  opts?: { everything?: boolean; signal?: AbortSignal },
): Promise<void> {
  if (!hasCognee()) return;
  try {
    if (opts?.everything) {
      // DELETE /api/v1/datasets — deletes all datasets for the user.
      const res = await cogneeFetch("/api/v1/datasets", {
        method: "DELETE",
        signal: opts?.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[ardum] cognee.forget(everything) failed (${res.status}): ${body.slice(0, 200)}`,
        );
      }
      return;
    }
    if (!userId) return;
    // Find the dataset UUID by name, then delete it.
    const datasetName = userDataset(userId);
    const datasetId = await findDatasetIdByName(datasetName, opts?.signal);
    if (!datasetId) {
      // Dataset doesn't exist — nothing to forget.
      return;
    }
    const res = await cogneeFetch(`/api/v1/datasets/${datasetId}`, {
      method: "DELETE",
      signal: opts?.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[ardum] cognee.forget(${datasetName}) failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.error("[ardum] cognee.forget error:", err);
  }
}

// ── Dataset management helpers ────────────────────────────────────────────

/**
 * DatasetInfo — the shape returned by GET /api/v1/datasets.
 * Used to find dataset UUIDs by name (needed for delete and graph endpoints).
 */
export type DatasetInfo = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * listDatasets — list all datasets accessible to the authenticated user.
 * GET /api/v1/datasets
 */
export async function listDatasets(
  opts?: { signal?: AbortSignal },
): Promise<DatasetInfo[]> {
  if (!hasCognee()) return [];
  try {
    const res = await cogneeFetch("/api/v1/datasets", {
      method: "GET",
      signal: opts?.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    // The API returns an array of dataset objects with id, name, etc.
    const items: unknown[] = Array.isArray(data) ? data : data?.datasets ?? [];
    return items.map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        id: String(obj.id ?? ""),
        name: String(obj.name ?? ""),
        createdAt: obj.created_at as string | undefined,
        updatedAt: obj.updated_at as string | undefined,
      };
    });
  } catch (err) {
    console.error("[ardum] cognee.listDatasets error:", err);
    return [];
  }
}

/**
 * findDatasetIdByName — look up a dataset UUID by name.
 * Needed because DELETE /api/v1/datasets/{id} and GET /api/v1/datasets/{id}/graph
 * require a UUID, not a name.
 */
async function findDatasetIdByName(
  name: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const datasets = await listDatasets({ signal });
  const found = datasets.find((d) => d.name === name);
  return found?.id ?? null;
}

/**
 * GraphNode — a node in the Cognee knowledge graph.
 * From GET /api/v1/datasets/{id}/graph → GraphDTO.nodes
 */
export type GraphNode = {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
};

/**
 * GraphEdge — an edge in the Cognee knowledge graph.
 * From GET /api/v1/datasets/{id}/graph → GraphDTO.edges
 */
export type GraphEdge = {
  source: string;
  target: string;
  label: string;
};

/**
 * GraphData — the full knowledge graph for a dataset.
 * From GET /api/v1/datasets/{id}/graph
 */
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/**
 * getDatasetGraph — fetch the actual Cognee knowledge graph for a
 * practitioner's dataset. Returns nodes and edges that can be rendered
 * directly in the MemoryGraph visualization.
 *
 * This is the real graph — not our synthetic approximation. When
 * Cognee has processed the practitioner's memory, this returns the
 * actual entity nodes and relationship edges that Cognee extracted.
 */
export async function getDatasetGraph(
  userId: string,
  opts?: { signal?: AbortSignal },
): Promise<GraphData | null> {
  if (!hasCognee()) return null;
  const datasetName = userDataset(userId);
  const datasetId = await findDatasetIdByName(datasetName, opts?.signal);
  if (!datasetId) return null;
  try {
    const res = await cogneeFetch(`/api/v1/datasets/${datasetId}/graph`, {
      method: "GET",
      signal: opts?.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      nodes: (data.nodes ?? []).map((n: unknown) => {
        const obj = n as Record<string, unknown>;
        return {
          id: String(obj.id ?? ""),
          label: String(obj.label ?? ""),
          type: String(obj.type ?? ""),
          properties: (obj.properties ?? {}) as Record<string, unknown>,
        };
      }),
      edges: (data.edges ?? []).map((e: unknown) => {
        const obj = e as Record<string, unknown>;
        return {
          source: String(obj.source ?? ""),
          target: String(obj.target ?? ""),
          label: String(obj.label ?? ""),
        };
      }),
    };
  } catch (err) {
    console.error("[ardum] cognee.getDatasetGraph error:", err);
    return null;
  }
}

// ── Structured memory context builder ────────────────────────────────────

/**
 * Build a structured MemoryContext from raw recall results.
 *
 * This is what gets passed into Mira's voice generation and the matching
 * agent. We do a lightweight parse of the recall text to extract known
 * entities (energy states, retreat titles, bookings, notes). The graph
 * structure in Cognee makes these relationships explicit; here we just
 * surface them in a shape the rest of the codebase can consume directly.
 */
export function buildMemoryContext(
  results: RecallResult[],
  provider: "cognee" | "none" = "cognee",
): MemoryContext {
  if (results.length === 0) {
    return { ...EMPTY_MEMORY, provider };
  }

  const fullText = results.map((r) => r.text).join("\n");
  const energyStates = ["settled", "in-movement", "low", "sharp"];
  const energyHistory: string[] = [];
  for (const state of energyStates) {
    if (fullText.toLowerCase().includes(state)) {
      energyHistory.push(state);
    }
  }

  // Extract past matches — look for retreat-title-like patterns. Cognee's
  // graph will have these as nodes; the recall text surfaces them in
  // natural language. We keep this loose on purpose.
  const pastMatches: { title: string; location: string; score: number }[] = [];
  const matchPattern = /(?:matched|recommended|retreat)[:\s]+([^,\n]+?)(?:\s+in\s+([^,\n]+?))?(?:[,.\n]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = matchPattern.exec(fullText)) !== null) {
    const title = m[1]?.trim();
    const location = m[2]?.trim() ?? "";
    if (title && title.length > 3 && title.length < 80) {
      pastMatches.push({ title, location, score: 0 });
    }
  }

  // Extract past bookings.
  const pastBookings: { title: string; location: string }[] = [];
  const bookingPattern = /(?:booked|booking)[:\s]+([^,\n]+?)(?:\s+in\s+([^,\n]+?))?(?:[,.\n]|$)/gi;
  while ((m = bookingPattern.exec(fullText)) !== null) {
    const title = m[1]?.trim();
    const location = m[2]?.trim() ?? "";
    if (title && title.length > 3 && title.length < 80) {
      pastBookings.push({ title, location });
    }
  }

  // Extract notes — quoted strings or "noted:" prefixes.
  const pastNotes: string[] = [];
  const notePattern = /(?:notes?|mentioned|said)[:\s]+"([^"]+)"/gi;
  while ((m = notePattern.exec(fullText)) !== null) {
    const note = m[1]?.trim();
    if (note) pastNotes.push(note);
  }

  return {
    isReturning: true,
    energyHistory,
    pastMatches: pastMatches.slice(0, 5),
    pastBookings: pastBookings.slice(0, 5),
    pastNotes: pastNotes.slice(0, 10),
    rawRecall: results,
    provider,
  };
}

/**
 * recallContext — the high-level helper the rest of the app uses.
 *
 * Calls recall() with a practitioner-focused query, then builds a
 * structured MemoryContext. Returns EMPTY_MEMORY when Cognee is not
 * configured, the practitioner has no history yet, OR anything goes
 * wrong (credits exhausted, network error, malformed response, etc.).
 *
 * This function must never throw — it's called from the critical match
 * path and a throw would 500 the entire flow. Every failure mode
 * degrades to EMPTY_MEMORY so the app works without memory.
 */
export async function recallContext(
  userId: string,
  opts?: { signal?: AbortSignal },
): Promise<MemoryContext> {
  if (!hasCognee()) return EMPTY_MEMORY;
  try {
    const results = await recall(
      userId,
      "What do I know about this practitioner? Their past visits, energy, matches, bookings, and notes.",
      opts,
    );
    return buildMemoryContext(results, "cognee");
  } catch (err) {
    // Defensive: recall() already has its own try/catch, but if
    // buildMemoryContext or something else throws unexpectedly, we
    // must not break the match flow.
    console.error("[ardum] cognee.recallContext error:", err);
    return EMPTY_MEMORY;
  }
}

/**
 * rememberIntake — store the practitioner's intake answers as memory.
 *
 * Called after the intake form is submitted. The text is structured so
 * Cognee's entity extraction can pull out energy, budget, social, and
 * notes as graph nodes.
 */
export async function rememberIntake(
  userId: string,
  profile: {
    energy: string;
    budget: string;
    social: string;
    notes?: string;
    pose?: { shoulderMobility: string; hipMobility: string; breathPhase: string };
  },
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const lines = [
    `Practitioner intake on ${new Date().toISOString()}.`,
    `Energy state: ${profile.energy}.`,
    `Budget band: ${profile.budget}.`,
    `Social comfort: ${profile.social}.`,
  ];
  if (profile.pose) {
    lines.push(
      `Pose baseline: shoulder mobility ${profile.pose.shoulderMobility}, hip mobility ${profile.pose.hipMobility}, breath phase ${profile.pose.breathPhase}.`,
    );
  }
  if (profile.notes) {
    lines.push(`Notes: "${profile.notes}"`);
  }
  await remember(userId, lines.join("\n"), opts);
}

/**
 * rememberMatch — store a match result as memory.
 *
 * Called after the matching agent produces a result. Lets future sessions
 * recall "what retreats has Mira recommended to this person before?"
 */
export async function rememberMatch(
  userId: string,
  match: {
    retreatTitle: string;
    retreatLocation: string;
    score: number;
    practiceStyle: string[];
  },
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const text = [
    `Match recommended on ${new Date().toISOString()}.`,
    `Retreat: ${match.retreatTitle} in ${match.retreatLocation}.`,
    `Match score: ${match.score.toFixed(2)}.`,
    `Practice style: ${match.practiceStyle.join(", ")}.`,
  ].join("\n");
  await remember(userId, text, opts);
}

/**
 * rememberBooking — store a booking as memory.
 *
 * Called after a deposit is confirmed. Lets Mira reference past bookings
 * in future sessions: "You've been to Restorative Yin in Ubud — this
 * retreat builds on that."
 */
export async function rememberBooking(
  userId: string,
  booking: {
    retreatTitle: string;
    retreatLocation: string;
    depositUsd: number;
  },
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const text = [
    `Booking confirmed on ${new Date().toISOString()}.`,
    `Retreat: ${booking.retreatTitle} in ${booking.retreatLocation}.`,
    `Deposit: $${booking.depositUsd.toLocaleString()} held in escrow.`,
  ].join("\n");
  await remember(userId, text, opts);
}
