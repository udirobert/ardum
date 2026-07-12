// Server-side test that pins the Cognee adapter's HTTP contract.
//
// Why this file exists: src/memory/enrich.test.ts covers the *bridge*
// (projectActorMemory, the withTimeout helper, the cap-at-5). It
// does NOT cover the Cognee adapter itself — the only place in the
// production path that talks to a third-party service with a
// try/catch that swallows ALL errors. The unit tests use an
// in-process fake (`mkSemantic`) that models delay and throw
// locally, so they don't exercise the real fetch path:
//
//   - response shape `{results: [...]}` vs bare `[]` vs unwrapped
//   - non-200 responses (401, 500, 503) returning []
//   - response.json() throwing on a malformed body
//   - fetch itself throwing (ECONNREFUSED, DNS, TLS)
//   - the X-Api-Key header actually being set
//   - the dataset name being prefixed ardum-actor- and sanitized
//
// In every row above, a regression silently breaks pastNotes
// (no throw, just an empty array) and the practitioner sees the
// projector output without ever knowing the supplement failed.
// This test pins the contract so a Cognee API change or auth
// misconfig fails the build rather than the user.
//
// vi.stubGlobal("fetch", fetchMock) is the chosen mechanism: the
// adapter calls `fetch(...)` directly, not `globalThis.fetch`, and
// Node 18+ has fetch as a real global, so the stub is observed.
// vi.unstubAllGlobals() in afterEach ensures the stub does not leak
// across test files (vitest isolates globals per file by default,
// but unstubbing is the cheap belt-and-braces).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cogneeMemory } from "./cognee";

// vi.hoisted so the fetchMock ref is available inside the beforeEach
// closure even though the top-level body runs after vitest's
// import-time setup. Returning a vi.fn() is the cheap default — each
// beforeEach mockReset()s it so the previous test's resolved/rejected
// promise does not leak.
const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

const TEST_BASE = "https://cognee.test";
const TEST_KEY = "test-key-123";

beforeEach(() => {
  process.env.COGNEE_BASE_URL = TEST_BASE;
  process.env.COGNEE_API_KEY = TEST_KEY;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  delete process.env.COGNEE_BASE_URL;
  delete process.env.COGNEE_API_KEY;
  vi.unstubAllGlobals();
});

// Helper: assert exactly one fetch call and return its first-arg
// url + second-arg init. The adapter calls fetch(url, init), so the
// destructured shape is stable.
function firstCall(): { url: string; init: RequestInit } {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  return { url: url as string, init: init as RequestInit };
}

describe("cogneeMemory — recall()", () => {
  it("is a no-op (returns []) when COGNEE_BASE_URL is not configured", async () => {
    delete process.env.COGNEE_BASE_URL;
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op (returns []) when COGNEE_API_KEY is not configured", async () => {
    delete process.env.COGNEE_API_KEY;
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to /api/v1/recall with the X-Api-Key header and JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    await cogneeMemory.recall("actor-1", "test query");
    const { url, init } = firstCall();
    expect(url).toBe(`${TEST_BASE}/api/v1/recall`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe(TEST_KEY);
    expect(headers["content-type"]).toBe("application/json");
  });

  it("uses the actor-scoped dataset name with the ardum-actor- prefix and CHUNKS topK=12", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    await cogneeMemory.recall("actor-abc-123", "test query");
    const { init } = firstCall();
    const body = JSON.parse(init.body as string);
    expect(body.datasets).toEqual(["ardum-actor-actor-abc-123"]);
    expect(body.query).toBe("test query");
    expect(body.searchType).toBe("CHUNKS");
    expect(body.topK).toBe(12);
  });

  it("sanitizes the actor id — strips everything that is not a-zA-Z0-9-", async () => {
    // Real-world: an actorId with a UUID shape is the canonical case,
    // but a misbehaving upstream could pass a path segment. The
    // dataset name MUST stay a single path-safe token; otherwise a
    // crafted id could collide with another actor's dataset. The
    // regex is `[^a-zA-Z0-9-]` — underscores are NOT in the allowed
    // set and are stripped alongside slashes, @, and !. Pin both
    // halves of the behavior: a future "loosening" refactor that
    // adds _ or . to the allowed set would change the dataset
    // shape and risk collisions.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    await cogneeMemory.recall("actor/foo@bar!123-_", "test query");
    const { init } = firstCall();
    const body = JSON.parse(init.body as string);
    expect(body.datasets).toEqual(["ardum-actor-actorfoobar123-"]);
  });

  it("maps a {results: [...]} response to SemanticSnippet[]", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { text: "first note", source: "diary" },
            // No source → defaults to "semantic-memory". Pinning the
            // default so a future "strict source" refactor that errors
            // on missing source fails here explicitly.
            { text: "second note" },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([
      { text: "first note", source: "diary", observedAt: undefined },
      {
        text: "second note",
        source: "semantic-memory",
        observedAt: undefined,
      },
    ]);
  });

  it("maps a bare [...] response (no results wrapper) to SemanticSnippet[]", async () => {
    // Cognee may return either shape; the adapter handles both.
    // Without this branch, an API change to the response envelope
    // would silently degrade pastNotes to [].
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { content: "via content field", source: "diary" },
          { chunk: "via chunk field" },
        ]),
        { status: 200 },
      ),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([
      { text: "via content field", source: "diary", observedAt: undefined },
      {
        text: "via chunk field",
        source: "semantic-memory",
        observedAt: undefined,
      },
    ]);
  });

  it("uses the answer field as a last-resort text source", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ answer: "Q: what helps?\nA: silence." }],
        }),
        { status: 200 },
      ),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result[0]?.text).toBe("Q: what helps?\nA: silence.");
  });

  it("returns [] on a 500 response (Cognee is allowed to fail)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
  });

  it("returns [] on a 401 response (API key rejected)", async () => {
    // A 401 is the most likely production failure: a key rotation
    // went out of sync. pastNotes must silently degrade, never throw,
    // because the projection layer is best-effort.
    fetchMock.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
  });

  it("returns [] when response.json() throws (malformed body)", async () => {
    // Cognee returning HTML or a truncated body would trip .json().
    // The adapter catches and returns []; pin it.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error("invalid JSON")),
    } as unknown as Response);
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
  });

  it("returns [] when fetch itself throws (ECONNREFUSED, DNS, TLS)", async () => {
    // The outter try/catch in recall() wraps the entire request.
    // A network-layer failure must not surface — pastNotes are
    // supplementary, not authoritative.
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
  });

  it("captures observedAt when the response item has a string timestamp", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              text: "note",
              source: "diary",
              timestamp: "2024-01-01T00:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result[0]?.observedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("returns [] when the body is neither an array nor has a results array", async () => {
    // Defensive: a Cognee endpoint returning a plain object must
    // not produce phantom pastNotes.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ unexpected: "shape" }), { status: 200 }),
    );
    const result = await cogneeMemory.recall("actor-1", "test query");
    expect(result).toEqual([]);
  });
});

describe("cogneeMemory — remember()", () => {
  it("is a no-op when COGNEE_BASE_URL is not configured", async () => {
    delete process.env.COGNEE_BASE_URL;
    await cogneeMemory.remember("actor-1", "a phrase to remember");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to /api/v1/remember with FormData and X-Api-Key", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await cogneeMemory.remember("actor-1", "a phrase to remember");
    const { url, init } = firstCall();
    expect(url).toBe(`${TEST_BASE}/api/v1/remember`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe(TEST_KEY);
    // Body is FormData. We can't easily inspect FormData fields
    // through vitest's deep-equality machinery, but the constructor
    // is observable: this is the regression guard for "a future
    // refactor swaps FormData for JSON and breaks the Cognee
    // upload path".
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("swallows a fetch failure (episode transitions never block on Cognee)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));
    // remember() is best-effort. The whole point is fire-and-forget
    // — a throw here would derail the episode transition that fired
    // it (recommend, record-commitment). Pin the swallow.
    await expect(
      cogneeMemory.remember("actor-1", "a phrase to remember"),
    ).resolves.toBeUndefined();
  });
});

describe("cogneeMemory — forget()", () => {
  it("is a no-op when COGNEE_BASE_URL is not configured", async () => {
    delete process.env.COGNEE_BASE_URL;
    await cogneeMemory.forget("actor-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to /api/v1/forget with the actor-scoped dataset", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await cogneeMemory.forget("actor-1");
    const { url, init } = firstCall();
    expect(url).toBe(`${TEST_BASE}/api/v1/forget`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ dataset: "ardum-actor-actor-1" });
  });

  it("swallows a fetch failure (episode deletion remains authoritative)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));
    // forget() runs from episode deletion. If Cognee rejects the
    // forget call, the episode is still deleted locally; the
    // adapter must not throw past the catch.
    await expect(cogneeMemory.forget("actor-1")).resolves.toBeUndefined();
  });
});
