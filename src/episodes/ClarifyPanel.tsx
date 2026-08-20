"use client";

import {
  BUDGET_BANDS,
  ENERGY_STATES,
  PARTY_SIZE_OPTIONS,
  SOCIAL_COMFORT,
  TRAVEL_WINDOWS,
  type BudgetBand,
  type EnergyState,
  type SocialComfort,
  type TravelWindow,
} from "@/calibration/schema";
import type { NextDecision } from "./model";
import { useMiraImpulse } from "@/components/MiraImpulse";

type ClarifyKind = Extract<
  NextDecision["kind"],
  | "clarify-energy"
  | "clarify-budget"
  | "clarify-social"
  | "clarify-party-size"
  | "clarify-horizon"
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
    travelWindow?: TravelWindow;
    partySize?: number;
  }) => void;
};

export default function ClarifyPanel({
  kind,
  prompt,
  primaryLabel,
  busy,
  onPick,
}: Props) {
  const { fire } = useMiraImpulse();
  const options =
    kind === "clarify-energy"
      ? ENERGY_STATES
      : kind === "clarify-budget"
        ? BUDGET_BANDS
        : kind === "clarify-social"
          ? SOCIAL_COMFORT
          : kind === "clarify-party-size"
            ? PARTY_SIZE_OPTIONS
            : TRAVEL_WINDOWS;

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
            onMouseEnter={() => fire("lean")}
            onClick={() => {
              fire("commit");
              if (kind === "clarify-energy") {
                onPick({ energy: value as EnergyState });
              } else if (kind === "clarify-budget") {
                onPick({ budget: value as BudgetBand });
              } else if (kind === "clarify-social") {
                onPick({ social: value as SocialComfort });
              } else if (kind === "clarify-party-size") {
                onPick({ partySize: value as number });
              } else {
                onPick({ travelWindow: value as TravelWindow });
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
