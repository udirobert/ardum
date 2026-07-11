import "server-only";

import type { SemanticMemory, SemanticSnippet } from "./semantic-memory";

function configured(): boolean {
  return Boolean(process.env.COGNEE_BASE_URL && process.env.COGNEE_API_KEY);
}

function dataset(actorId: string): string {
  return `ardum-actor-${actorId.replace(/[^a-zA-Z0-9-]/g, "")}`;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const base = (process.env.COGNEE_BASE_URL ?? "").replace(/\/$/, "");
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": process.env.COGNEE_API_KEY ?? "",
      ...(init.headers ?? {}),
    },
  });
}

export const cogneeMemory: SemanticMemory = {
  async remember(actorId, text) {
    if (!configured()) return;
    const form = new FormData();
    form.append("data", new Blob([text], { type: "text/plain" }), "memory.txt");
    form.append("datasetName", dataset(actorId));
    try {
      await request("/api/v1/remember", { method: "POST", body: form });
    } catch {
      // Semantic memory is optional and never blocks an episode transition.
    }
  },

  async recall(actorId, query): Promise<SemanticSnippet[]> {
    if (!configured()) return [];
    try {
      const response = await request("/api/v1/recall", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          datasets: [dataset(actorId)],
          searchType: "CHUNKS",
          topK: 12,
        }),
      });
      if (!response.ok) return [];
      const body = await response.json();
      const items: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.results)
          ? body.results
          : [];
      return items.map((item) => {
        const value = item as Record<string, unknown>;
        return {
          text: String(
            value.text ?? value.content ?? value.chunk ?? value.answer ?? "",
          ),
          source: String(value.source ?? "semantic-memory"),
          observedAt:
            typeof value.timestamp === "string" ? value.timestamp : undefined,
        };
      });
    } catch {
      return [];
    }
  },

  async forget(actorId) {
    if (!configured()) return;
    try {
      await request("/api/v1/forget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataset: dataset(actorId) }),
      });
    } catch {
      // Episode deletion remains authoritative even if projection cleanup fails.
    }
  },
};
