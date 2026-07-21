import "server-only";

// Optional tier-C fetch adapter. When EVIDENCE_FETCH_ENDPOINT is set,
// operators can plug Exa / Firecrawl / Tinyfish Fetch behind this URL.
// The adapter returns normalized page text; the evidence repository
// turns it into PublicEvidenceRecord rows.

import { readServerEnv, hasEvidenceFetch as envHasEvidenceFetch } from "@/lib/env";

export type FetchedPage = {
  url: string;
  title: string;
  text: string;
  fetchedAt: string;
};

export function hasEvidenceFetch(): boolean {
  return envHasEvidenceFetch();
}

export async function fetchPublicPage(url: string): Promise<FetchedPage | null> {
  const endpoint = readServerEnv().EVIDENCE_FETCH_ENDPOINT;
  const apiKey = readServerEnv().EVIDENCE_FETCH_API_KEY;
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      url?: string;
      title?: string;
      text?: string;
      fetchedAt?: string;
    };
    if (!json.text?.trim()) return null;
    return {
      url: json.url ?? url,
      title: json.title ?? url,
      text: json.text.trim(),
      fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
