"use client";

import { useEffect, useState } from "react";
import type { LensesResponse } from "@/app/api/agent/match/perspectives/route";

// Two named lenses — Restorative and Movement — applied to the same
// attestation pool. Shows the top match from each, side by side, plus
// a one-line note about agreement or disagreement.
//
// Loads on mount. Single fetch; deterministic server-side. No LLM calls.

export default function LensComparison({
  sessionId,
  currentTopId,
}: {
  sessionId: string;
  currentTopId: string;
}) {
  const [data, setData] = useState<LensesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/agent/match/perspectives?session=${encodeURIComponent(sessionId)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as LensesResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Lens comparison failed.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (err) {
    return (
      <section className="mt-16">
        <p className="tag mb-2">two perspectives</p>
        <p className="text-[color:var(--accent-ink)] text-sm">{err}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="mt-16">
        <p className="tag mb-2">two perspectives</p>
        <p className="why pulse-soft">running both lenses…</p>
      </section>
    );
  }

  return (
    <section className="mt-16">
      <p className="tag mb-2">two perspectives</p>
      <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-3">
        What the two lenses would have surfaced.
      </h2>
      <p className="why max-w-prose mb-6">
        The matching logic has two reasonable ways to weight your
        practice. Each lens runs the same axes &mdash; the disagreement
        is in the balance, not the rules.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {data.lenses.map(({ lens, top }) => {
          const sameAsMain = top.id === currentTopId;
          return (
            <article
              key={lens.name}
              className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 fade-in-up surface-card"
            >
              <p className="tag mb-2">{lens.name} lens</p>
              <p className="text-sm text-[color:var(--muted)] mb-3">
                {lens.plain}
              </p>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h3 className="font-serif text-lg tracking-tight leading-tight">
                  {top.retreatTitle}
                </h3>
                <span className="font-serif text-xl tabular-nums">
                  {Math.round(top.score * 100)}
                </span>
              </div>
              <p className="text-xs text-[color:var(--muted)] mb-3">
                {top.retreatLocation} &middot; {top.durationDays} days &middot; $
                {top.priceUsd.toLocaleString()}
              </p>
              <p className="text-sm italic text-[color:var(--accent-ink)] leading-snug">
                {top.headline}
              </p>
              {sameAsMain && (
                <p className="tag mt-3 opacity-70">
                  agrees with the balanced ranking
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p className="why mt-6 max-w-prose">
        {data.agreement
          ? "Both lenses converged on the same retreat. The match is robust — even with a different weight balance, the ranking holds."
          : "The lenses disagreed. The retreat above is what each lens would have recommended in isolation — the balanced match above sits between them."}
      </p>
    </section>
  );
}
