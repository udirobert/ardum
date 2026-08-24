import type { MatchResult } from "@/matching/types";
import type { PerspectiveName } from "@/episodes/perspectives";

// Prominent lens factors — "What if we weighted this differently?"
// Surfaces the three ranking lenses (balanced/restorative/movement) in
// the main flow so the user can shape how Mira weighs what fits, not
// just accept or reject her result.
export default function LensFactors({
  activeLens,
  lensData,
  lensLoading,
  busy,
  onPickLens,
  recommendation,
}: {
  activeLens: PerspectiveName;
  lensData: Record<PerspectiveName, MatchResult | null> | null;
  lensLoading: boolean;
  busy: boolean;
  onPickLens: (lens: PerspectiveName) => void;
  recommendation: MatchResult | undefined;
}) {
  return (
    <div>
      <p className="tag mb-2">What if we weighted this differently?</p>
      <p className="text-sm text-[color:var(--muted)] mb-3 italic">
        These change how I weigh what fits. They don&apos;t change what you asked for.
      </p>
      <div
        role="group"
        aria-label="Recompute the fit under a different lens"
        className="flex flex-wrap gap-2"
      >
        {(["balanced", "restorative", "movement"] as const).map((lens) => (
          <button
            key={lens}
            type="button"
            disabled={busy || lensLoading}
            onClick={() => onPickLens(lens)}
            className={`px-3 py-2 rounded-sm border text-sm capitalize transition-colors disabled:opacity-40 ${
              activeLens === lens
                ? "border-[color:var(--accent)] text-[color:var(--accent-ink)]"
                : "border-[color:var(--hairline)] hover:border-[color:var(--accent)]"
            }`}
            aria-pressed={activeLens === lens}
          >
            {lens}
          </button>
        ))}
      </div>
      {lensLoading && (
        <p className="text-sm text-[color:var(--muted)] mt-3 italic">
          Re-ranking…
        </p>
      )}
      {!lensLoading &&
        activeLens !== "balanced" &&
        lensData &&
        lensData[activeLens] && (
          <LensOutcome
            lens={activeLens}
            pick={lensData[activeLens]!}
            sameAsMain={
              lensData[activeLens]!.retreatRootHash ===
              recommendation?.retreatRootHash
            }
          />
        )}
    </div>
  );
}

// A small panel that shows which retreat a non-balanced lens picked.
// The `sameAsMain` flag turns this into a statement (the alternative
// lens agrees) rather than a recommendation replacement — agency without
// confusion.
function LensOutcome({
  lens,
  pick,
  sameAsMain,
}: {
  lens: PerspectiveName;
  pick: MatchResult;
  sameAsMain: boolean;
}) {
  return (
    <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
      <p className="tag mb-2">
        with {lens} lens{sameAsMain ? " (same retreat)" : ""}
      </p>
      <p className="font-serif text-xl tracking-tight mb-1">
        {pick.retreatTitle}
      </p>
      <p className="text-sm text-[color:var(--muted)]">
        {pick.retreatLocation} · {pick.durationDays} days · $
        {pick.priceUsd.toLocaleString()}
      </p>
    </div>
  );
}
