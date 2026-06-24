"use client";

import { useState } from "react";
import type { MatchResult, ReasoningStep } from "./types";

// Three preset weight rebalances. The names are the user-facing labels.
// The API takes the same keys; the server has the canonical weight tables.
const PRESETS = [
  { key: "energy", label: "Energy mattered more" },
  { key: "social", label: "Social comfort mattered more" },
  { key: "budget", label: "Budget mattered more" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

type RankedSummary = { id: string; retreatTitle: string; score: number };

type Counterfactual = {
  preset: string;
  plain: string;
  top: MatchResult;
  steps: ReasoningStep[];
  ranked: RankedSummary[];
};

export default function Counterfactual({
  sessionId,
  currentTopId,
  currentTopScore,
}: {
  sessionId: string;
  currentTopId: string;
  currentTopScore: number;
}) {
  const [active, setActive] = useState<PresetKey | null>(null);
  const [result, setResult] = useState<Counterfactual | null>(null);
  const [loading, setLoading] = useState<PresetKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(preset: PresetKey) {
    setLoading(preset);
    setErr(null);
    setActive(preset);
    try {
      const res = await fetch("/api/agent/match/counterfactual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, preset }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: Counterfactual = await res.json();
      setResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Counterfactual failed.");
    } finally {
      setLoading(null);
    }
  }

  const shifted = result && result.top.id !== currentTopId;
  const unchanged = result && result.top.id === currentTopId;
  // Locate the balanced top within this lens's ranking so we can show
  // exactly how much its score moved and where it now sits.
  const balancedUnderLens = result?.ranked.find((r) => r.id === currentTopId);
  const balancedRank = balancedUnderLens
    ? result!.ranked.findIndex((r) => r.id === currentTopId) + 1
    : null;
  const newTopPct = result ? Math.round(result.top.score * 100) : null;
  const balancedNewPct = balancedUnderLens
    ? Math.round(balancedUnderLens.score * 100)
    : null;
  const balancedOldPct = Math.round(currentTopScore * 100);
  const delta = balancedNewPct !== null ? balancedNewPct - balancedOldPct : null;

  return (
    <section className="mt-16">
      <p className="tag mb-2">counterfactual</p>
      <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-3">
        What if I had reasoned differently?
      </h2>
      <p className="why max-w-prose mb-6">
        The composite score is a weighted sum &mdash; if I had rebalanced the
        weights, your top match could shift. Pick a lens to see what the
        agent would have surfaced.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => load(p.key)}
            disabled={loading !== null}
            className={`text-sm px-3 py-2 rounded-sm border transition-colors ${
              active === p.key
                ? "border-[color:var(--accent)] bg-[color:var(--surface)]"
                : "border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)]"
            } disabled:opacity-50`}
          >
            {loading === p.key ? "reweighting…" : p.label}
          </button>
        ))}
      </div>

      {err && (
        <p className="text-[color:var(--accent-ink)] text-sm mb-4">{err}</p>
      )}

      {result && (
        <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 fade-in-up surface-card">
          {unchanged ? (
            <>
              <p className="why max-w-prose mb-5">
                With <em>{result.plain}</em>, your top match holds.
                {delta !== null && (
                  <>
                    {" "}Its score moved from{" "}
                    <span className="tag tabular-nums">{balancedOldPct}</span>
                    {" "}to{" "}
                    <span className="tag tabular-nums">{balancedNewPct}</span>
                    {" "}— a {delta >= 0 ? "lift" : "give"} of{" "}
                    <span className="tag tabular-nums">
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                    , so the ranking was robust enough to absorb the shift.
                  </>
                )}
              </p>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-xl tracking-tight leading-tight">
                  {result.top.retreatTitle}
                </h3>
                <span className="font-serif text-2xl tabular-nums">
                  {newTopPct}
                  <span className="text-sm text-[color:var(--muted)] tabular-nums">/100</span>
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="tag mb-2">new top under {result.plain}</p>
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <h3 className="font-serif text-xl tracking-tight leading-tight">
                  {result.top.retreatTitle}
                </h3>
                <span className="font-serif text-2xl tabular-nums">
                  {newTopPct}
                  <span className="text-sm text-[color:var(--muted)] tabular-nums">/100</span>
                </span>
              </div>
              <p className="text-sm text-[color:var(--muted)] mb-3">
                {result.top.retreatLocation}
                {" · "}
                {result.top.durationDays}&nbsp;days
                {" · $"}
                {result.top.priceUsd.toLocaleString()}
                {" · cohort of "}
                {result.top.capacity}
              </p>
              <p className="text-sm italic text-[color:var(--accent-ink)] max-w-prose leading-snug">
                {result.top.headline}
              </p>
              {shifted && balancedUnderLens && balancedRank !== null && (
                <p className="why mt-5 max-w-prose">
                  Your balanced top —{" "}
                  <strong className="font-serif">{balancedUnderLens.retreatTitle}</strong>{" "}
                  — slips to #{balancedRank} under this lens, scoring{" "}
                  <span className="tag tabular-nums">{balancedNewPct}</span>{" "}
                  (was{" "}
                  <span className="tag tabular-nums">{balancedOldPct}</span>).
                  The trade-off is visible in the reasoning below.
                </p>
              )}
            </>
          )}

          {result.steps.length > 0 && (
            <details className="mt-4">
              <summary className="tag cursor-pointer hover:text-foreground">
                reasoning under this lens
              </summary>
              <ol className="mt-4 flex flex-col gap-4">
                {result.steps
                  .filter((s) => s.weight > 0)
                  .map((s, i) => (
                    <li key={i} className="text-sm">
                      <p className="tag mb-1">
                        {s.axis} &middot; weight {s.weight.toFixed(2)}
                      </p>
                      <p className="leading-snug">
                        <span className="text-[color:var(--muted)]">Given&nbsp;</span>
                        {s.given}
                        <span className="text-[color:var(--muted)]">. When&nbsp;</span>
                        {s.when}
                        <span className="text-[color:var(--muted)]">. Then&nbsp;</span>
                        <em className="font-serif text-[color:var(--accent-ink)]">{s.then}</em>
                        <span className="text-[color:var(--muted)]">.</span>
                      </p>
                    </li>
                  ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
