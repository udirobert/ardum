// ── Race-safe fetch coordinator (client-side) ────────────────────────
//
// Three derived-view surfaces in EpisodeWorkbench (lens toggle,
// counterfactual-budget, counterfactual-energy) all trigger GET
// requests when the user spam-clicks. Naively, a slow first request
// can resolve AFTER a fast second one, after which the stale body
// stomps the newer state. This helper layers two defenses:
//
//   1. An AbortController chained across runs. Starting a new run()
//      aborts the previous in-flight fetch, which rejects with
//      AbortError and is treated as a no-op.
//   2. A monotonic epoch counter. Even if the AbortController does
//      not stop the prior fetch in time (e.g. await response.json()
//      resolved while a newer run() was already in progress), the
//      epoch comparison after the parse guarantees the returned
//      value reflects only the latest run.
//
// Belt-and-braces because either layer alone is incomplete: an abort
// after a JSON parse already returned is a no-op, and an epoch check
// alone keeps a zombie network connection alive.
//
// The helper is transport-only (no React inside). The component owns
// the setState lifecycle; the helper's job is to (a) cancel in-flight
// fetches when superseded and (b) signal staleness so the caller
// never applies a body from an older run. Every outcome variant
// echoes `epoch` so callers with additional async work after the
// await can confirm they are still the current run.
//
// Usage from a component:
//
//     const lensRunner = useMemo(() => createAbortableRunner(), []);
//     useEffect(() => () => lensRunner.dispose(), [lensRunner]);
//     const result = await lensRunner.run(url, async (r) => r.json());
//     if (result.ok) setLensData(result.value);
//     else if ("error" in result) setError(result.error.message);
//     // result.aborted / result.stale → no-op (a newer run supersedes)

export type RunOutcome<T> =
  | { ok: true; epoch: number; value: T }
  | { ok: false; epoch: number; aborted: true }
  | { ok: false; epoch: number; stale: true }
  | { ok: false; epoch: number; error: Error };

export interface AbortableRunner {
  /** True iff `epoch` still matches the runner's most recent epoch. */
  isCurrent: (epoch: number) => boolean;
  /**
   * Abort any in-flight run. The runner stays usable: the next
   * run() bumps the epoch and starts a fresh fetch.
   */
  abort: () => void;
  /**
   * Permanently dispose the runner: aborts any in-flight run and
   * causes every subsequent run() to return
   * `{ ok: false, aborted: true, epoch: -1 }` without invoking
   * fetch. The synthetic -1 epoch signals "no real run() was
   * issued"; callers passing `result.epoch` to `isCurrent()` always
   * see `false`, which is the correct caller-side behavior. Use in
   * a useEffect cleanup to protect against setState-after-unmount
   * paths.
   */
  dispose: () => void;
  /**
   * Fetch with race-safe semantics. The parse callback is
   * responsible for non-ok handling — the three Workbench
   * fetches throw an Error inside parse() when response.ok is
   * false, and the runtime routes that error to the caller's
   * "error" branch.
   */
  run: <T>(
    url: string,
    /** Receives the Response and returns Promise<T>. */
    parse: (response: Response) => Promise<T>,
  ) => Promise<RunOutcome<T>>;
}

function isAbortError(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    (value as { name: unknown }).name === "AbortError"
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function createAbortableRunner(): AbortableRunner {
  let currentEpoch = 0;
  let controller: AbortController | null = null;
  let disposed = false;

  return {
    isCurrent(epoch) {
      return epoch === currentEpoch;
    },
    abort() {
      if (controller) controller.abort();
    },
    dispose() {
      disposed = true;
      if (controller) controller.abort();
      controller = null;
    },
    // Explicit generic on the implementation so TS resolves `T`
    // inside the closure. Without it, the inferred method type
    // loses T as a parameter and the body fails typecheck.
    async run<T>(
      url: string,
      parse: (response: Response) => Promise<T>,
    ): Promise<RunOutcome<T>> {
      if (disposed) return { ok: false, aborted: true, epoch: -1 };
      const epoch = ++currentEpoch;
      if (controller) controller.abort();
      const nextController = new AbortController();
      controller = nextController;
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: nextController.signal,
        });
        let value: T;
        try {
          value = await parse(response);
        } catch (parseError) {
          // Order of checks: dispose > epoch > abort > error. If the
          // runner is dead, surface as aborted. If a newer run won
          // the race, surface as stale. Otherwise classify the abort.
          // Last is a true error.
          if (disposed) return { ok: false, aborted: true, epoch };
          if (epoch !== currentEpoch) return { ok: false, stale: true, epoch };
          if (isAbortError(parseError)) {
            return { ok: false, aborted: true, epoch };
          }
          return { ok: false, error: toError(parseError), epoch };
        }
        // Success path. Symmetric dispose check BEFORE the epoch
        // check so dispose-during-parse never leaks an ok with value
        // from an unmounted runner.
        if (disposed) return { ok: false, aborted: true, epoch };
        if (epoch !== currentEpoch) return { ok: false, stale: true, epoch };
        return { ok: true, epoch, value };
      } catch (caught) {
        // Outer catch handles network-layer aborts. Same ordering
        // as the inner catch (dispose > epoch > abort > error) so a
        // newer-run-wins race is reported as stale, not aborted.
        if (disposed) return { ok: false, aborted: true, epoch };
        if (epoch !== currentEpoch) return { ok: false, stale: true, epoch };
        if (isAbortError(caught)) {
          return { ok: false, aborted: true, epoch };
        }
        return { ok: false, error: toError(caught), epoch };
      }
    },
  };
}
