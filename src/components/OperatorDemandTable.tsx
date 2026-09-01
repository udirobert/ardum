"use client";

// OperatorDemandTable — a scalable demand surface for operators.
//
// Adapts the RecordsTable primitive (resizable columns, sortable headers,
// tag-chips for intention shapes, status badges) to Ardum's operator surface.
// Cuts the property-config popover, contentEditable prompt, and AI-calculation
// flow — those belong to a generic AI-spreadsheet, not a demand surface.
//
// Privacy contract: intention shapes only, never verbatim statements.
// Coarse enum values (energy, budget, social, travel window) with labels.
// Match status badges (matched, holding, booked) with the strength-dot pattern.
//
// Used on the retreat detail page (/operator/[retreatRootHash]) to replace
// the flat matched-practitioners list with a sortable, scannable grid.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DemandMatch, IntentionShape } from "@/episodes/operator-projection";
import type { EnergyState, BudgetBand, SocialComfort, TravelWindow } from "@/calibration/schema";
import { ENERGY_STATES, BUDGET_BANDS, SOCIAL_COMFORT, TRAVEL_WINDOWS } from "@/calibration/schema";

const ENERGY_LABELS = new Map(ENERGY_STATES.map((e) => [e.value, e.label]));
const BUDGET_LABELS = new Map(BUDGET_BANDS.map((b) => [b.value, b.label]));
const SOCIAL_LABELS = new Map(SOCIAL_COMFORT.map((s) => [s.value, s.label]));
const TRAVEL_LABELS = new Map(TRAVEL_WINDOWS.map((t) => [t.value, t.label]));

type SortKey = "status" | "score" | "energy" | "budget" | "social";

const STATUS_RANK: Record<string, number> = {
  booked: 3,
  "ready-to-book": 3,
  held: 2,
  coordinating: 2,
  "recommendation-ready": 1,
  clarifying: 0,
  capturing: 0,
};

function statusLabel(status: string): string {
  switch (status) {
    case "capturing": return "describing";
    case "clarifying": return "clarifying";
    case "recommendation-ready": return "reviewing";
    case "held": return "holding";
    case "coordinating": return "coordinating";
    case "ready-to-book": return "ready to book";
    case "booked": return "booked";
    case "monitoring": return "watching";
    default: return status;
  }
}

function statusColor(status: string): string {
  if (status === "booked" || status === "ready-to-book") return "var(--accent)";
  if (status === "held" || status === "coordinating") return "var(--accent-ink)";
  return "var(--muted)";
}

type ColumnKey = "status" | "score" | "energy" | "budget" | "social" | "window";

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  status: 140,
  score: 90,
  energy: 120,
  budget: 120,
  social: 120,
  window: 110,
};

function Tag({ label, value }: { label?: string; value?: string }) {
  if (!value || !label) return <span className="text-[color:var(--muted)]">—</span>;
  return (
    <span className="inline-flex h-5.5 items-center rounded-full border border-[color:var(--hairline)] px-2 text-[11.5px] font-medium text-[color:var(--muted)]">
      {label}
    </span>
  );
}

export default function OperatorDemandTable({
  matches,
  bookingHref,
}: {
  matches: DemandMatch[];
  /** When provided, booked rows link through to the booking detail. */
  bookingHref?: (match: DemandMatch) => string | undefined;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "status",
    dir: 1,
  });

  const sorted = useMemo(() => {
    return [...matches].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "status") {
        cmp = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
      } else if (sort.key === "score") {
        cmp = a.score - b.score;
      } else {
        const av = (a.shape as Record<string, string | undefined>)[sort.key] ?? "";
        const bv = (b.shape as Record<string, string | undefined>)[sort.key] ?? "";
        cmp = av.localeCompare(bv);
      }
      return cmp * sort.dir;
    });
  }, [matches, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <div className="overflow-x-auto" data-testid="demand-table">
      <table className="w-full text-sm" style={{ minWidth: 600 }}>
        <thead>
          <tr className="border-b border-[color:var(--hairline)]">
            {([
              { key: "status" as const, label: "Status", width: DEFAULT_WIDTHS.status },
              { key: "score" as const, label: "Fit", width: DEFAULT_WIDTHS.score },
              { key: "energy" as const, label: "Energy", width: DEFAULT_WIDTHS.energy },
              { key: "budget" as const, label: "Budget", width: DEFAULT_WIDTHS.budget },
              { key: "social" as const, label: "Social", width: DEFAULT_WIDTHS.social },
              { key: "window" as const, label: "Window", width: DEFAULT_WIDTHS.window, sortable: false },
            ]).map((col) => (
              <th
                key={col.key}
                className="text-left py-3 px-3 font-normal"
                style={{ width: col.width }}
              >
                {"sortable" in col && col.sortable === false ? (
                  <span className="tag">{col.label}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key as SortKey)}
                    className="tag hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {col.label}
                    {sort.key === col.key && (
                      <span
                        className="text-[10px]"
                        style={{ display: "inline-block", transform: sort.dir === -1 ? "rotate(180deg)" : "none" }}
                      >
                        ↓
                      </span>
                    )}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((match) => {
            const s = match.shape as IntentionShape;
            const href = match.bookedAt ? bookingHref?.(match) : undefined;
            return (
              <tr
                key={match.episodeId}
                className="border-b border-[color:var(--hairline)] hover:bg-[color:var(--surface)] transition-colors"
              >
                <td className="py-3 px-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: statusColor(match.status) }}
                      aria-hidden
                    />
                    {href ? (
                      <Link
                        href={href}
                        className="text-[12.5px] font-medium text-[color:var(--accent-ink)] hover:underline"
                      >
                        {statusLabel(match.status)} →
                      </Link>
                    ) : (
                      <span className="text-[12.5px] font-medium text-[color:var(--foreground)]">
                        {statusLabel(match.status)}
                      </span>
                    )}
                    {match.isTopPick && (
                      <span className="tag opacity-60 flex-shrink-0">top pick</span>
                    )}
                  </span>
                </td>
                <td className="py-3 px-3 tabular-nums text-[color:var(--muted)]">
                  {Math.round(match.score * 100)}
                </td>
                <td className="py-3 px-3">
                  <Tag
                    label={s.energy ? (ENERGY_LABELS.get(s.energy as EnergyState) ?? s.energy) : undefined}
                    value={s.energy}
                  />
                </td>
                <td className="py-3 px-3">
                  <Tag
                    label={s.budget ? (BUDGET_LABELS.get(s.budget as BudgetBand) ?? s.budget) : undefined}
                    value={s.budget}
                  />
                </td>
                <td className="py-3 px-3">
                  <Tag
                    label={s.social ? (SOCIAL_LABELS.get(s.social as SocialComfort) ?? s.social) : undefined}
                    value={s.social}
                  />
                </td>
                <td className="py-3 px-3">
                  <Tag
                    label={s.travelWindow ? (TRAVEL_LABELS.get(s.travelWindow as TravelWindow) ?? s.travelWindow) : undefined}
                    value={s.travelWindow}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
