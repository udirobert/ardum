"use client";

// OperatorInsights — InsightCards primitive adapted for operator demand
// intelligence.
//
// The operator retreat list page currently shows flat demand counts per
// retreat. This component presents the same data as an "Insights N ‹ ›"
// carousel: prose → visualization → follow-up question. Each card surfaces
// a demand pattern Mira is seeing across the operator's retreats.
//
// Adapts the InsightCards primitive:
// - Drops the Liveline charts (external dependency, light-theme default).
//   Uses CSS-only visualizations with dusk tokens instead.
// - Drops useDarkMode (Ardum is always dusk).
// - Drops the Entity/@-mention component (no inline mentions needed).
// - Keeps the carousel pattern: paginated cards, prev/next, autoplay yields.
//
// Three insight cards:
// 1. Demand trend — which retreats are getting the most matches
// 2. Intention-shape distribution — what energy/budget/social patterns match
// 3. Conversion funnel — matches → holds → bookings across all retreats

import { useEffect, useState } from "react";
import type { OperatorRetreat } from "@/app/operator/page";

type DemandTotals = {
  totalMatches: number;
  activeHolds: number;
  bookings: number;
};

export default function OperatorInsights({
  retreats,
}: {
  retreats: OperatorRetreat[];
}) {
  const [page, setPage] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  // Autoplay yields as soon as the operator interacts.
  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => setPage((p) => (p + 1) % 3), 6000);
    return () => clearTimeout(t);
  }, [autoplay, page]);

  const move = (dir: -1 | 1) => {
    setAutoplay(false);
    setPage((p) => (p + dir + 3) % 3);
  };

  // Aggregate demand across all retreats.
  const totals: DemandTotals = retreats.reduce(
    (acc, r) => ({
      totalMatches: acc.totalMatches + (r.demand?.totalMatches ?? 0),
      activeHolds: acc.activeHolds + (r.demand?.activeHolds ?? 0),
      bookings: acc.bookings + (r.demand?.bookings ?? 0),
    }),
    { totalMatches: 0, activeHolds: 0, bookings: 0 },
  );

  // Top retreats by total demand.
  const ranked = [...retreats]
    .filter((r) => r.demand)
    .sort((a, b) =>
      (b.demand!.totalMatches + b.demand!.activeHolds + b.demand!.bookings) -
      (a.demand!.totalMatches + a.demand!.activeHolds + a.demand!.bookings),
    )
    .slice(0, 5);

  const maxDemand = ranked[0]
    ? ranked[0].demand!.totalMatches + ranked[0].demand!.activeHolds + ranked[0].demand!.bookings
    : 1;

  // Conversion rate.
  const conversionRate = totals.totalMatches > 0
    ? Math.round((totals.bookings / totals.totalMatches) * 100)
    : 0;
  const holdRate = totals.totalMatches > 0
    ? Math.round((totals.activeHolds / totals.totalMatches) * 100)
    : 0;

  // ── Card 1: Demand trend ──
  const demandCard = (
    <div className="rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)] surface-card p-3">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--foreground)]">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-[color:var(--accent)] text-[8px] font-bold text-white">
          ◆
        </span>
        Demand by retreat
      </span>
      <div className="mt-3 space-y-2">
        {ranked.map((r) => {
          const d = r.demand!;
          const total = d.totalMatches + d.activeHolds + d.bookings;
          const width = `${Math.max(4, (total / maxDemand) * 100)}%`;
          return (
            <div key={r.rootHash} className="flex items-center gap-2">
              <span className="text-[11.5px] text-[color:var(--muted)] truncate w-32 shrink-0">
                {r.title}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[color:var(--surface)] border border-[color:var(--hairline)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[color:var(--accent-soft)] transition-[width] duration-500"
                  style={{ width, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                />
              </div>
              <span className="text-[11px] text-[color:var(--muted)] tabular-nums shrink-0 w-8 text-right">
                {total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Card 2: Conversion funnel ──
  const funnelCard = (
    <div className="rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)] surface-card p-3">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--foreground)]">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-[color:var(--accent-ink)] text-[8px] font-bold text-white">
          ↓
        </span>
        Conversion funnel
      </span>
      <div className="mt-3 space-y-1.5">
        {[
          { label: "Matched", value: totals.totalMatches, color: "var(--muted)", pct: 100 },
          { label: "Holding", value: totals.activeHolds, color: "var(--accent-ink)", pct: totals.totalMatches ? Math.round((totals.activeHolds / totals.totalMatches) * 100) : 0 },
          { label: "Booked", value: totals.bookings, color: "var(--accent)", pct: totals.totalMatches ? Math.round((totals.bookings / totals.totalMatches) * 100) : 0 },
        ].map((stage) => (
          <div key={stage.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11.5px] text-[color:var(--muted)]">{stage.label}</span>
              <span className="text-[11.5px] font-medium text-[color:var(--foreground)] tabular-nums">
                {stage.value} <span className="text-[color:var(--muted)]">{stage.pct}%</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[color:var(--surface)] border border-[color:var(--hairline)] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${stage.pct}%`,
                  background: stage.color,
                  transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[17px] font-semibold tracking-tight text-[color:var(--foreground)] tabular-nums">
          {conversionRate}%
        </span>
        <span className="text-[11px] text-[color:var(--muted)]">match → book</span>
        {holdRate > 0 && (
          <span className="text-[11px] text-[color:var(--accent-ink)]">
            · {holdRate}% holding
          </span>
        )}
      </div>
    </div>
  );

  // ── Card 3: Retreat portfolio summary ──
  const portfolioCard = (
    <div className="rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)] surface-card p-3">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--foreground)]">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-[color:var(--muted)] text-[8px] font-bold text-white">
          Σ
        </span>
        Portfolio summary
      </span>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <span className="block text-[20px] font-semibold tracking-tight text-[color:var(--foreground)] tabular-nums">
            {retreats.length}
          </span>
          <span className="text-[11px] text-[color:var(--muted)]">retreats</span>
        </div>
        <div>
          <span className="block text-[20px] font-semibold tracking-tight text-[color:var(--foreground)] tabular-nums">
            {totals.totalMatches}
          </span>
          <span className="text-[11px] text-[color:var(--muted)]">matched</span>
        </div>
        <div>
          <span className="block text-[20px] font-semibold tracking-tight text-[color:var(--accent)] tabular-nums">
            {totals.bookings}
          </span>
          <span className="text-[11px] text-[color:var(--muted)]">booked</span>
        </div>
      </div>
      <div className="mt-3 rounded-sm border border-[color:var(--hairline)] px-2.5 py-2">
        <span className="block text-[11.5px] font-medium text-[color:var(--muted)]">
          {retreats.filter((r) => r.demand && r.demand.totalMatches > 0).length} of {retreats.length} retreats have active demand
        </span>
        <span className="mt-1 block text-[11px] leading-relaxed text-[color:var(--muted)] opacity-70">
          {retreats.filter((r) => !r.demand || r.demand.totalMatches === 0).length} retreats waiting for their first match.
        </span>
      </div>
    </div>
  );

  const cards = [demandCard, funnelCard, portfolioCard];
  const current = cards[page];

  const prose: Record<number, React.ReactNode> = {
    0: (
      <>
        <span className="font-medium text-[color:var(--foreground)]">
          {ranked[0]?.title ?? "Your top retreat"}
        </span>{" "}
        is drawing the most attention —{" "}
        <span className="font-medium text-[color:var(--foreground)] tabular-nums">
          {ranked[0] ? ranked[0].demand!.totalMatches + ranked[0].demand!.activeHolds + ranked[0].demand!.bookings : 0}
        </span>{" "}
        practitioners matched so far.
      </>
    ),
    1: (
      <>
        {totals.totalMatches > 0 ? (
          <>
            <span className="font-medium text-[color:var(--accent)] tabular-nums">{conversionRate}%</span>{" "}
            of matched practitioners have booked.{" "}
            {totals.activeHolds > 0 && (
              <>
                <span className="font-medium text-[color:var(--accent-ink)] tabular-nums">
                  {totals.activeHolds}
                </span>{" "}
                are holding — they may convert.
              </>
            )}
          </>
        ) : (
          "No matches yet across your retreats. Mira is watching."
        )}
      </>
    ),
    2: (
      <>
        You have{" "}
        <span className="font-medium text-[color:var(--foreground)] tabular-nums">
          {retreats.length}
        </span>{" "}
        retreats listed.{" "}
        {totals.totalMatches > 0 && (
          <>
            <span className="font-medium text-[color:var(--foreground)] tabular-nums">
              {totals.totalMatches}
            </span>{" "}
            practitioners are in the pipeline.
          </>
        )}
      </>
    ),
  };

  const followUps = [
    "See which retreats need attention",
    "Which holds are closest to expiring?",
    "List another retreat",
  ];

  return (
    <div className="min-h-[200px] w-full max-w-md" data-testid="operator-insights">
      {/* Pager header */}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-[color:var(--foreground)]">Insights</span>
          <span className="text-[13px] text-[color:var(--muted)] tabular-nums">{page + 1} of 3</span>
        </span>
        <span className="flex items-center gap-0.5">
          {([
            { d: "M15 18l-6-6 6-6", label: "Previous insight", dir: -1 as const },
            { d: "M9 6l6 6-6 6", label: "Next insight", dir: 1 as const },
          ]).map((btn, i) => (
            <button
              key={i}
              aria-label={btn.label}
              onClick={() => move(btn.dir)}
              className="flex size-6 items-center justify-center rounded-[6px] text-[color:var(--muted)] transition-colors duration-100 hover:text-foreground"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={btn.d} />
              </svg>
            </button>
          ))}
        </span>
      </div>

      {/* Page content */}
      <p className="text-[12.5px] leading-relaxed text-[color:var(--muted)] mb-2">
        {prose[page]}
      </p>
      <div className="mb-2">{current}</div>
      <button
        type="button"
        onClick={() => setAutoplay(false)}
        className="rounded-full border border-[color:var(--hairline)] bg-[color:var(--surface)] px-3 py-1.5 text-left text-[12px] text-[color:var(--foreground)] transition-colors duration-100 hover:border-[color:var(--accent-soft)]"
      >
        {followUps[page]}
      </button>
    </div>
  );
}
