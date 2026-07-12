// Unit tests for the race-safe fetch helper at
// src/lib/abortableFetch.ts. Three derived-view surfaces in
// EpisodeWorkbench (lens toggle, counterfactual-budget,
// counterfactual-energy) use it to defend against spam-click races.
// Each test names the layer of defense it exercises (abort chain vs
// epoch sentinel vs error path) so a future contributor who weakens
// one without realising can't silently drift away from the contract.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createAbortableRunner, type RunOutcome } from "./abortableFetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createAbortableRunner", () => {
  it("returns ok with the parsed body on a clean run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true })),
    );

    const runner = createAbortableRunner();
    const result = await runner.run(
      "/x",
      async (r) => (await r.json()) as { ok: boolean },
    );

    expect(result).toEqual({ ok: true, epoch: 1, value: { ok: true } });
    runner.dispose();
  });

  it("aborts an in-flight fetch when a newer run begins (abort-chain defense)", async () => {
    // The slow fetch honors the abort signal by rejecting with
    // DOMException("AbortError"). The fast fetch resolves immediately.
    const slow = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const fast = vi.fn().mockResolvedValue(jsonResponse({ v: "fast" }));
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        call += 1;
        return call === 1 ? slow(url, init) : fast(url, init);
      }),
    );

    const runner = createAbortableRunner();
    const firstPromise = runner.run(
      "/slow",
      async (r) => (await r.json()) as { v: string },
    );
    const second = await runner.run(
      "/fast",
      async (r) => (await r.json()) as { v: string },
    );

    expect(second).toEqual({ ok: true, epoch: 2, value: { v: "fast" } });

    // The first run's controller was aborted by the second; the
    // helper detects the newer-epoch FIRST (the catch ordering is
    // [disposed, epoch, isAbortError, error] so a newer-run-wins
    // race is reported as `stale`, not `aborted`). The AbortError
    // is the MECHANISM; the OUTCOME — for the caller's purposes —
    // is that a newer run superseded this one. Behaviorally identical
    // from the caller's POV (no setState either way), but the
    // discriminator surfaces the root cause for debugging.
    const first = await firstPromise;
    expect(first).toEqual({ ok: false, epoch: 1, stale: true });
    runner.dispose();
  });

  it("returns stale when a newer run completes before this one parsed (epoch defense)", async () => {
    // Both fetches resolve immediately. The first run's parse step
    // artificially delays so a second run() has time to complete and
    // bump the epoch mid-await. This proves the second layer of
    // defense — the parsed body must NOT be returned even though no
    // abort fired (parse never sees the signal).
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ v: "x" }))));

    const runner = createAbortableRunner();
    const first = runner.run("/first", async (response) => {
      // Yield to the macrotask queue so the next run() can settle.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return (await response.json()) as { v: string };
    });
    const second = await runner.run(
      "/second",
      async (response) => (await response.json()) as { v: string },
    );

    expect(second).toEqual({ ok: true, epoch: 2, value: { v: "x" } });

    // Once the first parse finally resolves, its epoch no longer
    // matches the runner's current epoch — the helper returns stale
    // so the caller never applies a body from the older run.
    const firstResult = await first;
    expect(firstResult).toEqual({ ok: false, epoch: 1, stale: true });
    runner.dispose();
  });

  it("dispose() called before any run() returns aborted without invoking fetch", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchSpy);

    const runner = createAbortableRunner();
    runner.dispose();

    const result = await runner.run("/y", async () => ({}));
    // The runner never issues a fetch on a disposed path, so epoch
    // stays at the synthetic -1 (no real run() increment happened).
    expect(result).toEqual({ ok: false, epoch: -1, aborted: true });
    // The contract is that dispose is terminal — no fetch may fire
    // after dispose even on a fresh run() call.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dispose() aborts in-flight and causes subsequent runs to return aborted without invoking fetch", async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const runner = createAbortableRunner();
    const inFlight = runner.run("/x", async () => ({}));
    runner.dispose();

    const afterDispose: RunOutcome<Record<string, never>> = await inFlight;
    // inFlight started before dispose(), so its epoch increments
    // to 1; dispose() then aborts the controller. Final value echoes
    // that epoch so callers can verify "current-ness" externally.
    expect(afterDispose).toEqual({ ok: false, epoch: 1, aborted: true });

    // Subsequent runs after dispose return aborted and must NOT touch
    // fetch again — the contract is that dispose is terminal.
    const post = await runner.run("/y", async () => ({}));
    // post happens AFTER dispose() — early return path, synthetic
    // epoch -1 because no run() was ever issued.
    expect(post).toEqual({ ok: false, epoch: -1, aborted: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns error when the underlying fetch fails for a non-abort reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const runner = createAbortableRunner();
    const result = await runner.run("/x", async () => ({}));
    expect(result.ok).toBe(false);
    if ("error" in result) {
      expect(result.error.message).toBe("network down");
    } else {
      throw new Error(
        `expected error outcome, got ${JSON.stringify(result)}`,
      );
    }
    runner.dispose();
  });

  it("returns error when the parse callback throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "bad band" }, 400)));

    const runner = createAbortableRunner();
    const result = await runner.run("/x", async (response) => {
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "bad response");
      return json;
    });
    expect(result.ok).toBe(false);
    if ("error" in result) {
      expect(result.error.message).toBe("bad band");
    } else {
      throw new Error(
        `expected error outcome, got ${JSON.stringify(result)}`,
      );
    }
    runner.dispose();
  });

  it("isCurrent tracks the most recent epoch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    const runner = createAbortableRunner();
    const first = await runner.run("/a", async () => ({}));
    const second = await runner.run("/b", async () => ({}));
    expect(runner.isCurrent(second.epoch)).toBe(true);
    expect(runner.isCurrent(first.epoch)).toBe(false);
    runner.dispose();
  });
});
