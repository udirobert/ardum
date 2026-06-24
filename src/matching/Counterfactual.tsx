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

type Counterfactual = {
  preset: string;
  plain: string;
  top: MatchResult;
  steps: ReasoningStep[];
};

export default function Counterfactual({
  sessionId,
  currentTopId,
}: {
  sessionId: string;
  currentTopId: string;
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
            <p className="why max-w-prose">
              With <em>{result.plain}</em>, your top match stays the same
              &mdash; the ranking was already strong enough that this
              lens still picks <strong className="font-serif">{result.top.retreatTitle}</strong>.
            </p>
          ) : (
            <>
              <p className="tag mb-2">
                top match with {result.plain}
              </p>
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <h3 className="font-serif text-xl tracking-tight leading-tight">
                  {result.top.retreatTitle}
                </h3>
                <span className="font-serif text-2xl tabular-nums">
                  {Math.round(result.top.score * 100)}
                </span>
              </div>
              <p className="text-sm text-[color:var(--muted)] mb-3">
                {result.top.retreatLocation} &middot; {result.top.durationDays} days
                &middot; ${result.top.priceUsd.toLocaleString()} &middot; cohort of{" "}
                {result.top.capacity}
              </p>
              <p className="text-sm italic text-[color:var(--accent-ink)] max-w-prose leading-snug">
                {result.top.headline}
              </p>
              {shifted && (
                <p className="why mt-4 max-w-prose">
                  The original ranking had a different retreat at #1. The
                  axes that shifted are visible in the reasoning below.
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
