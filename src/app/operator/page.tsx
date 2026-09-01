"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useOperatorAuth } from "@/booking/OperatorAuth";
import OperatorWalletButton from "@/booking/OperatorWalletButton";
import MiraOrb from "@/components/MiraOrb";
import { useMiraImpulse } from "@/components/MiraImpulse";
import { operatorPresence } from "@/agent/operator-presence";
import { operatorBriefing } from "@/agent/operator-briefing";
import { providerFailureLine } from "@/agent/mira-voice";
import { STEADY_PRESENCE } from "@/agent/mira-presence";
import type { AttestationIndex } from "@/attestation/schema";

type DemandCounts = {
  totalMatches: number;
  activeHolds: number;
  bookings: number;
};

type OperatorRetreat = AttestationIndex & {
  demand?: DemandCounts;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; retreats: OperatorRetreat[] }
  | { status: "error"; message: string };

type SortMode = "activity" | "recent";

function activityOf(retreat: OperatorRetreat): number {
  const d = retreat.demand;
  return (d?.totalMatches ?? 0) + (d?.activeHolds ?? 0) + (d?.bookings ?? 0);
}

// The page IS the notification (operator plan, Phase 3): poll, don't push.
const POLL_MS = 30_000;

const ROW_GRID =
  "grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] sm:items-baseline gap-x-4";

export default function OperatorPage() {
  const { address } = useOperatorAuth();
  const { fire } = useMiraImpulse();
  const [state, setState] = useState<State>(
    () => (address ? { status: "loading" } : { status: "idle" }),
  );
  const [sort, setSort] = useState<SortMode>("activity");
  // Demand signature per retreat for poll-diffing — only events the
  // operator can already individually see (holds, bookings) pulse the
  // orb; match-count changes stay silent so impulse timing can never
  // leak an individual below the density gate.
  const demandSignature = useRef<Map<string, DemandCounts>>(new Map());

  const applyRetreats = useCallback(
    (retreats: OperatorRetreat[]) => {
      const prev = demandSignature.current;
      const next = new Map(
        retreats.map((r) => [r.rootHash, r.demand ?? {
          totalMatches: 0,
          activeHolds: 0,
          bookings: 0,
        }]),
      );
      for (const [hash, demand] of next) {
        const before = prev.get(hash);
        if (!before) continue;
        if (demand.bookings > before.bookings) fire("commit");
        else if (demand.activeHolds > before.activeHolds) fire("resonate");
      }
      demandSignature.current = next;
      setState({ status: "loaded", retreats });
    },
    [fire],
  );

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/operator/retreats?attestor=${encodeURIComponent(address)}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Could not load retreats.");
          return json.retreats as OperatorRetreat[];
        })
        .then((retreats) => {
          if (!cancelled) applyRetreats(retreats);
        })
        .catch((err) => {
          if (!cancelled)
            setState({
              status: "error",
              message:
                err instanceof Error ? err.message : "Could not load retreats.",
            });
        });
    };
    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [address, applyRetreats]);

  // Aggregate demand across all retreats drives Mira's posture here.
  const presence = useMemo(() => {
    if (state.status !== "loaded") return STEADY_PRESENCE;
    const totals = state.retreats.reduce(
      (acc, r) => ({
        totalMatches: acc.totalMatches + (r.demand?.totalMatches ?? 0),
        activeHolds: acc.activeHolds + (r.demand?.activeHolds ?? 0),
        bookings: acc.bookings + (r.demand?.bookings ?? 0),
      }),
      { totalMatches: 0, activeHolds: 0, bookings: 0 },
    );
    return operatorPresence(totals);
  }, [state]);

  // Mira's authored read of the demand — the "morning ritual" (ADR 0012:
  // this is the demand-visibility surface operators pay for).
  const briefing = useMemo(() => {
    if (state.status !== "loaded") return null;
    return operatorBriefing(state.retreats);
  }, [state]);

  const totals = useMemo(() => {
    if (state.status !== "loaded")
      return { totalMatches: 0, activeHolds: 0, bookings: 0 };
    return state.retreats.reduce(
      (acc, r) => ({
        totalMatches: acc.totalMatches + (r.demand?.totalMatches ?? 0),
        activeHolds: acc.activeHolds + (r.demand?.activeHolds ?? 0),
        bookings: acc.bookings + (r.demand?.bookings ?? 0),
      }),
      { totalMatches: 0, activeHolds: 0, bookings: 0 },
    );
  }, [state]);

  const sortedRetreats = useMemo(() => {
    if (state.status !== "loaded") return [];
    const list = [...state.retreats];
    if (sort === "activity") {
      list.sort(
        (a, b) =>
          activityOf(b) - activityOf(a) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list;
  }, [state, sort]);

  if (!address) {
    return (
      <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-12 pb-24">
        <MiraOrb size={48} presence={STEADY_PRESENCE} className="mb-6" />
        <p className="tag mb-4">operator</p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-6">
          Your retreats.
        </h1>
        <p className="text-lg text-[color:var(--muted)] max-w-prose mb-8 leading-relaxed">
          Sign in to see your listed retreats, who Mira is matching to them,
          and who&apos;s holding or booked.
        </p>
        <OperatorWalletButton onConnect={() => {}} />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <MiraOrb size={48} presence={presence} />
          <div>
            <p className="tag mb-1">operator</p>
            <h1 className="font-serif text-2xl sm:text-3xl tracking-tight">
              Your retreats
            </h1>
          </div>
        </div>
        <Link
          href="/attest"
          className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          List another →
        </Link>
      </div>

      {state.status === "loading" && (
        <p className="text-[color:var(--muted)]">Loading your retreats…</p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-[color:var(--accent-ink)]" role="alert">
          {providerFailureLine("Loading your retreats")}
        </p>
      )}

      {state.status === "idle" && null}

      {state.status === "loaded" && state.retreats.length === 0 && (
        <div className="border border-[color:var(--hairline)] rounded-sm p-6">
          <MiraOrb size={48} presence={STEADY_PRESENCE} className="mb-4" />
          <p className="text-lg leading-relaxed mb-2">
            You haven&apos;t listed any retreats yet.
          </p>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            Once you publish a retreat, Mira will match practitioners whose
            intentions fit — and you&apos;ll see them here before they inquire.
          </p>
          <Link
            href="/attest"
            className="inline-block px-6 py-3 rounded-sm bg-foreground text-background text-sm"
          >
            List your first retreat →
          </Link>
        </div>
      )}

      {state.status === "loaded" && state.retreats.length > 0 && (
        <>
          {/* The morning ritual: Mira's read of the demand, above the
              data. Aggregates only — the density gate holds. The header
              orb carries presence; no second orb here. */}
          {briefing && (
            <div aria-live="polite" className="mb-5">
              <p className="text-base leading-snug">{briefing.headline}</p>
              {briefing.lines.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {briefing.lines.map((line) => (
                    <li
                      key={line}
                      className="text-xs leading-relaxed text-[color:var(--muted)]"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="border-t border-[color:var(--hairline)] pt-3 mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
            <p>
              <span className="tabular-nums font-medium">
                {state.retreats.length}
              </span>{" "}
              retreats ·{" "}
              <span className="tabular-nums font-medium">
                {totals.totalMatches}
              </span>{" "}
              matched ·{" "}
              <span className="tabular-nums font-medium text-[color:var(--accent-ink)]">
                {totals.activeHolds}
              </span>{" "}
              holding ·{" "}
              <span className="tabular-nums font-medium text-[color:var(--accent-ink)]">
                {totals.bookings}
              </span>{" "}
              booked
            </p>
            <p className="text-[color:var(--muted)]">
              Sort:{" "}
              {(["activity", "recent"] as const).map((mode, i) => (
                <span key={mode}>
                  {i > 0 && " · "}
                  <button
                    type="button"
                    onClick={() => setSort(mode)}
                    aria-pressed={sort === mode}
                    className={
                      sort === mode
                        ? "text-foreground transition-colors"
                        : "hover:text-foreground transition-colors"
                    }
                  >
                    {mode}
                  </button>
                </span>
              ))}
            </p>
          </div>

          <div className={`${ROW_GRID} hidden sm:grid pb-2`}>
            <span className="tag">retreat</span>
            <span className="tag text-right">matched</span>
            <span className="tag text-right">holding</span>
            <span className="tag text-right">booked</span>
          </div>

          <div className="border-t border-[color:var(--hairline)]">
            {sortedRetreats.map((retreat) => {
              const d = retreat.demand;
              const matches = d?.totalMatches ?? 0;
              const holds = d?.activeHolds ?? 0;
              const booked = d?.bookings ?? 0;
              const quiet = matches === 0 && holds === 0 && booked === 0;
              return (
                <Link
                  key={retreat.rootHash}
                  href={`/operator/${retreat.rootHash}`}
                  className={`${ROW_GRID} py-3 border-b border-[color:var(--hairline)] hover:bg-[color:var(--surface)] transition-colors`}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-medium truncate">
                      {retreat.title}
                    </span>
                    <span className="block text-xs text-[color:var(--muted)] truncate">
                      {retreat.claims.location} · {retreat.claims.durationDays}{" "}
                      days · ${retreat.claims.priceUsd.toLocaleString()} ·
                      cohort of {retreat.claims.capacity}
                    </span>
                  </span>
                  {quiet ? (
                    <span className="mt-1 sm:mt-0 sm:col-span-3">
                      <span className="tag">watching</span>
                    </span>
                  ) : (
                    <>
                      <span className="hidden sm:block text-right text-sm tabular-nums">
                        {matches}
                      </span>
                      <span className="hidden sm:block text-right text-sm tabular-nums text-[color:var(--accent-ink)]">
                        {holds}
                      </span>
                      <span className="hidden sm:block text-right text-sm tabular-nums text-[color:var(--accent-ink)]">
                        {booked}
                      </span>
                      <span className="mt-1 sm:hidden flex flex-wrap gap-x-3 text-xs text-[color:var(--muted)]">
                        <span>
                          <span className="tabular-nums font-medium text-foreground">
                            {matches}
                          </span>{" "}
                          matched
                        </span>
                        {holds > 0 && (
                          <span className="text-[color:var(--accent-ink)]">
                            <span className="tabular-nums font-medium">
                              {holds}
                            </span>{" "}
                            holding
                          </span>
                        )}
                        {booked > 0 && (
                          <span className="text-[color:var(--accent-ink)]">
                            <span className="tabular-nums font-medium">
                              {booked}
                            </span>{" "}
                            booked
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-12 pt-8 border-t border-[color:var(--hairline)]">
        <p className="text-xs text-[color:var(--muted)]">
          Signed in as {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      </div>
    </section>
  );
}
