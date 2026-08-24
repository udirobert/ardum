import type { MatchResult } from "@/matching/types";
import type { BudgetBand, EnergyState } from "@/calibration/schema";
import { BUDGET_BANDS, ENERGY_STATES } from "@/calibration/schema";

// A small panel that shows which retreat a hypothetical budget band picks.
// The `sameAsMain` flag turns this into a statement (the override agrees
// with the surfaced recommendation) rather than a recommendation
// replacement — agency without confusion.
export function BudgetCounterfactualOutcome({
  band,
  topRanked,
  recommendation,
}: {
  band: BudgetBand;
  topRanked: MatchResult | null;
  recommendation: MatchResult | undefined;
}) {
  const bandLabel =
    BUDGET_BANDS.find((b) => b.value === band)?.label ?? band;
  const sameAsMain =
    topRanked !== null &&
    recommendation !== undefined &&
    topRanked.retreatRootHash === recommendation.retreatRootHash;
  if (!topRanked) {
    return (
      <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
        <p className="tag mb-2">if budget were {bandLabel}</p>
        <p className="text-sm text-[color:var(--muted)]">
          Nothing in the verified pool satisfies that limit — and that
          is information too.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
      <p className="tag mb-2">
        if budget were {bandLabel}
        {sameAsMain ? " (same retreat)" : ""}
      </p>
      <p className="font-serif text-xl tracking-tight mb-1">
        {topRanked.retreatTitle}
      </p>
      <p className="text-sm text-[color:var(--muted)]">
        {topRanked.retreatLocation} · {topRanked.durationDays} days · $
        {topRanked.priceUsd.toLocaleString()}
      </p>
    </div>
  );
}

// A small panel that shows which retreat a hypothetical energy state picks.
// Mirrors the budget counterpart's structure.
export function EnergyCounterfactualOutcome({
  energy,
  topRanked,
  recommendation,
}: {
  energy: EnergyState;
  topRanked: MatchResult | null;
  recommendation: MatchResult | undefined;
}) {
  const energyLabel =
    ENERGY_STATES.find((e) => e.value === energy)?.label ?? energy;
  const sameAsMain =
    topRanked !== null &&
    recommendation !== undefined &&
    topRanked.retreatRootHash === recommendation.retreatRootHash;
  if (!topRanked) {
    return (
      <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
        <p className="tag mb-2">if energy were {energyLabel}</p>
        <p className="text-sm text-[color:var(--muted)]">
          Nothing in the verified pool fits that register — and that
          is information too.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
      <p className="tag mb-2">
        if energy were {energyLabel}
        {sameAsMain ? " (same retreat)" : ""}
      </p>
      <p className="font-serif text-xl tracking-tight mb-1">
        {topRanked.retreatTitle}
      </p>
      <p className="text-sm text-[color:var(--muted)]">
        {topRanked.retreatLocation} · {topRanked.durationDays} days · $
        {topRanked.priceUsd.toLocaleString()}
      </p>
    </div>
  );
}
