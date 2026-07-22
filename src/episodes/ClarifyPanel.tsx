"use client";

import {
  BUDGET_BANDS,
  ENERGY_STATES,
  SOCIAL_COMFORT,
  type BudgetBand,
  type EnergyState,
  type SocialComfort,
} from "@/calibration/schema";
import type { NextDecision } from "./model";

type ClarifyKind = Extract<
  NextDecision["kind"],
  "clarify-energy" | "clarify-budget" | "clarify-social"
>;

type Props = {
  kind: ClarifyKind;
  prompt: string;
  primaryLabel: string;
  busy: boolean;
  onPick: (constraints: {
    energy?: EnergyState;
    budget?: BudgetBand;
    social?: SocialComfort;
  }) => void;
};

export default function ClarifyPanel({
  kind,
  prompt,
  primaryLabel,
  busy,
  onPick,
}: Props) {
  const options =
    kind === "clarify-energy"
      ? ENERGY_STATES
      : kind === "clarify-budget"
        ? BUDGET_BANDS
        : SOCIAL_COMFORT;

  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight mb-6">{prompt}</h2>
      <div className="space-y-3" role="list">
        {options.map(({ value, label, why }) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            role="listitem"
            onClick={() => {
              if (kind === "clarify-energy") {
                onPick({ energy: value as EnergyState });
              } else if (kind === "clarify-budget") {
                onPick({ budget: value as BudgetBand });
              } else {
                onPick({ social: value as SocialComfort });
              }
            }}
            className="w-full text-left border border-[color:var(--hairline)] rounded-sm px-5 py-4 hover:border-[color:var(--accent)] disabled:opacity-40 transition-colors"
          >
            <p className="font-serif text-xl tracking-tight">{label}</p>
            <p className="text-sm text-[color:var(--muted)] mt-1">{why}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-[color:var(--muted)] mt-5">{primaryLabel}</p>
    </div>
  );
}
