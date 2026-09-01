import type { MatchResult } from "@/matching/types";
import type { BudgetBand, EnergyState } from "@/calibration/schema";
import { BUDGET_BANDS, ENERGY_STATES } from "@/calibration/schema";
import type { CounterfactualResult } from "@/episodes/counterfactual";
import {
  BudgetCounterfactualOutcome,
  EnergyCounterfactualOutcome,
} from "./CounterfactualOutcomes";
import { formatUsd } from "@/lib/format";

// Surfaces the alternatives + budget/energy counterfactuals as a single
// component. Expanded when uncertainty is high, feedback is open, or no
// hold yet; collapsed under a calm active hold (confidence check only —
// never mutates the hold). Lens factors are in the LensFactors component.
export default function ExploreOtherFits({
  alternatives,
  recommendation,
  busy,
  activeBand,
  bandData,
  bandLoading,
  onPickBand,
  activeEnergy,
  energyData,
  energyLoading,
  onPickEnergy,
  holdActive,
  expanded,
}: {
  alternatives: MatchResult[];
  recommendation: MatchResult | undefined;
  busy: boolean;
  activeBand: BudgetBand | null;
  bandData: CounterfactualResult | null;
  bandLoading: boolean;
  onPickBand: (band: BudgetBand | null) => void;
  activeEnergy: EnergyState | null;
  energyData: CounterfactualResult | null;
  energyLoading: boolean;
  onPickEnergy: (energy: EnergyState | null) => void;
  holdActive: boolean;
  expanded: boolean;
}) {
  const body = (
    <div className="space-y-4">
      {alternatives.length > 0 && (
        <div>
          <p className="tag mb-2">
            {holdActive
              ? "and one more that also qualified"
              : "other possibilities I'm weighing"}
          </p>
          <ul className="divide-y divide-[color:var(--hairline)]">
            {alternatives.map((alt, index) => (
              <li
                key={alt.retreatRootHash}
                className="py-3 first:pt-0 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[color:var(--muted)] mb-1">
                    {index === 0 ? "next in line" : `option ${index + 1}`}
                  </p>
                  <p className="font-serif text-base tracking-tight">
                    {alt.retreatTitle}
                  </p>
                  <p className="text-xs text-[color:var(--muted)] mt-0.5">
                    {alt.retreatLocation} · {alt.durationDays} days ·{" "}
                    {formatUsd(alt.priceUsd)}
                  </p>
                  {alt.reasoning.length > 0 && (
                    <p className="text-xs mt-1 italic text-[color:var(--accent-ink)]">
                      {alt.reasoning[0].then}
                    </p>
                  )}
                </div>
                {index === 0 && recommendation && (
                  <p className="text-xs text-[color:var(--muted)] text-right shrink-0 tabular-nums">
                    Scored {Math.round(alt.score * 100)} vs{" "}
                    {Math.round(recommendation.score * 100)} for{" "}
                    {recommendation.retreatTitle}.
                  </p>
                )}
              </li>
            ))}
            {!holdActive && (
              <li className="text-sm text-[color:var(--muted)] pt-3">
                Use &ldquo;Not this one&rdquo; to move to the next in line.
              </li>
            )}
          </ul>
        </div>
      )}
      <div>
        <p className="tag mb-2">what if your budget were tighter?</p>
        <div
          role="group"
          aria-label="Re-rank the fit under a hypothetical budget"
          className="flex flex-wrap gap-2"
        >
          {BUDGET_BANDS.map(({ value, label }) => {
            const isActive = activeBand === value;
            return (
              <button
                key={value}
                type="button"
                disabled={busy || bandLoading}
                onClick={() => onPickBand(isActive ? null : value)}
                className={`px-2.5 py-1.5 rounded-sm border text-sm transition-colors disabled:opacity-40 ${
                  isActive
                    ? "border-[color:var(--accent)] text-[color:var(--accent-ink)]"
                    : "border-[color:var(--hairline)] hover:border-[color:var(--accent)]"
                }`}
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          })}
        </div>
        {bandLoading && (
          <p className="text-sm text-[color:var(--muted)] mt-3 italic">
            Re-ranking under a different limit…
          </p>
        )}
        {!bandLoading && activeBand && bandData && (
          <BudgetCounterfactualOutcome
            band={activeBand}
            topRanked={bandData.topRanked}
            recommendation={recommendation}
          />
        )}
      </div>
      <div>
        <p className="tag mb-2">what if your energy were different?</p>
        <div
          role="group"
          aria-label="Re-rank the fit under a hypothetical energy"
          className="flex flex-wrap gap-2"
        >
          {ENERGY_STATES.map(({ value, label }) => {
            const isActive = activeEnergy === value;
            return (
              <button
                key={value}
                type="button"
                disabled={busy || energyLoading}
                onClick={() => onPickEnergy(isActive ? null : value)}
                className={`px-2.5 py-1.5 rounded-sm border text-sm transition-colors disabled:opacity-40 ${
                  isActive
                    ? "border-[color:var(--accent)] text-[color:var(--accent-ink)]"
                    : "border-[color:var(--hairline)] hover:border-[color:var(--accent)]"
                }`}
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          })}
        </div>
        {energyLoading && (
          <p className="text-sm text-[color:var(--muted)] mt-3 italic">
            Re-ranking under a different energy…
          </p>
        )}
        {!energyLoading && activeEnergy && energyData && (
          <EnergyCounterfactualOutcome
            energy={activeEnergy}
            topRanked={energyData.topRanked}
            recommendation={recommendation}
          />
        )}
      </div>
    </div>
  );

  if (!expanded) {
    return (
      <details className="mt-5 border-t border-[color:var(--hairline)] pt-5">
        <summary className="tag cursor-pointer">
          {holdActive
            ? "still curious what else fitted?"
            : "See other possibilities I'm weighing"}
        </summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  }

  return (
    <div className="mt-6 border-t border-[color:var(--hairline)] pt-5">
      {body}
    </div>
  );
}
