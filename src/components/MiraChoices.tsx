"use client";

// Dimension-specific choice beats — not form buttons.

import type { BudgetBand, EnergyState, SocialComfort } from "@/calibration/schema";
import { useMiraImpulse } from "@/components/MiraImpulse";

type ChoiceProps<T extends string> = {
  disabled: boolean;
  onChoose: (value: T) => void;
};

function useChoiceImpulse() {
  const { fire } = useMiraImpulse();
  return {
    onLean: () => fire("lean"),
    onCommit: () => fire("commit"),
  };
}

const ENERGY_VISUALS: Record<
  EnergyState,
  { label: string; hint: string; motion: string }
> = {
  settled: {
    label: "Settled",
    hint: "Arriving calm. Room for depth.",
    motion: "mira-choice-still",
  },
  "in-movement": {
    label: "In movement",
    hint: "Transition energy. Something active fits.",
    motion: "mira-choice-flow",
  },
  low: {
    label: "Low",
    hint: "Depleted. Protect the recovery.",
    motion: "mira-choice-sink",
  },
  sharp: {
    label: "Sharp",
    hint: "Edges on. Clarity over comfort.",
    motion: "mira-choice-pulse",
  },
};

export function EnergyChoice({
  disabled,
  onChoose,
}: ChoiceProps<EnergyState>) {
  const { onLean, onCommit } = useChoiceImpulse();

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {(Object.keys(ENERGY_VISUALS) as EnergyState[]).map((key, i) => {
        const item = ENERGY_VISUALS[key];
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onMouseEnter={onLean}
            onFocus={onLean}
            onClick={() => {
              onCommit();
              onChoose(key);
            }}
            className={`mira-choice-card t-stagger-line t-stagger-line--${Math.min(i + 1, 4)} group text-left p-5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent)] disabled:opacity-40 transition-colors`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div
              className={`mira-choice-orb ${item.motion} mb-4`}
              aria-hidden
            />
            <p className="font-serif text-xl tracking-tight mb-1">
              {item.label}
            </p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed">
              {item.hint}
            </p>
          </button>
        );
      })}
    </div>
  );
}

const BUDGET_VISUALS: Record<
  BudgetBand,
  { label: string; width: string }
> = {
  "under-1k": { label: "Under $1,000", width: "25%" },
  "1k-2k": { label: "$1,000 – $2,000", width: "45%" },
  "2k-3k": { label: "$2,000 – $3,000", width: "68%" },
  "3k-plus": { label: "$3,000+", width: "92%" },
};

export function BudgetChoice({
  disabled,
  onChoose,
}: ChoiceProps<BudgetBand>) {
  const { onLean, onCommit } = useChoiceImpulse();

  return (
    <div className="space-y-3">
      <div className="h-2 rounded-full bg-[color:var(--hairline)] overflow-hidden mb-6">
        <div className="h-full w-full bg-gradient-to-r from-[color:var(--accent-soft)] to-[color:var(--accent)] opacity-30" />
      </div>
      {(Object.keys(BUDGET_VISUALS) as BudgetBand[]).map((key) => {
        const item = BUDGET_VISUALS[key];
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onMouseEnter={onLean}
            onFocus={onLean}
            onClick={() => {
              onCommit();
              onChoose(key);
            }}
            className="mira-choice-card w-full text-left p-4 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent)] disabled:opacity-40 transition-all hover:translate-x-1"
          >
            <div className="flex items-center gap-4">
              <div
                className="h-3 rounded-full bg-[color:var(--accent)] transition-all group-hover:opacity-100 opacity-70"
                style={{ width: item.width }}
              />
              <span className="font-serif text-lg tracking-tight">
                {item.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const SOCIAL_VISUALS: Record<
  SocialComfort,
  { label: string; dots: number; spread: number }
> = {
  solo: { label: "Mostly alone", dots: 1, spread: 0 },
  "small-circle": { label: "Small circle", dots: 3, spread: 14 },
  "open-circle": { label: "Open circle", dots: 5, spread: 22 },
  communal: { label: "Communal", dots: 8, spread: 28 },
};

export function SocialChoice({
  disabled,
  onChoose,
}: ChoiceProps<SocialComfort>) {
  const { onLean, onCommit } = useChoiceImpulse();

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {(Object.keys(SOCIAL_VISUALS) as SocialComfort[]).map((key) => {
        const item = SOCIAL_VISUALS[key];
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onMouseEnter={onLean}
            onFocus={onLean}
            onClick={() => {
              onCommit();
              onChoose(key);
            }}
            className="mira-choice-card text-left p-5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent)] disabled:opacity-40"
          >
            <div
              className="relative h-16 mb-4 flex items-center justify-center"
              aria-hidden
            >
              {Array.from({ length: item.dots }).map((_, i) => {
                const angle = (i / item.dots) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * item.spread;
                const y = Math.sin(angle) * item.spread * 0.6;
                return (
                  <span
                    key={i}
                    className="absolute w-2.5 h-2.5 rounded-full bg-[color:var(--accent)]"
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                  />
                );
              })}
            </div>
            <p className="font-serif text-xl tracking-tight">{item.label}</p>
          </button>
        );
      })}
    </div>
  );
}
