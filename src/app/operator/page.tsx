"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useOperatorAuth } from "@/booking/OperatorAuth";
import OperatorWalletButton from "@/booking/OperatorWalletButton";
import MiraOrb from "@/components/MiraOrb";
import OperatorInsights from "@/components/OperatorInsights";
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

export type OperatorRetreat = AttestationIndex & {
  demand?: DemandCounts;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; retreats: OperatorRetreat[] }
  | { status: "error"; message: string };

// The page IS the notification (operator plan, Phase 3): poll, don't push.
const POLL_MS = 30_000;

export default function OperatorPage() {
  const { address } = useOperatorAuth();
  const { fire } = useMiraImpulse();
  const [state, setState] = useState<State>(
    () => (address ? { status: "loading" } : { status: "idle" }),
  );
  // Demand signature per retreat for poll-diffing — only events the
  // operator can already individually see (holds, bookings) pulse the
  // orb; match-count changes stay silent so impulse timing can never
  // leak an individual below the density gate.
  const demandSignature = useRef<Map<string, DemandCounts>>(new Map());

  const applyRetreats = useCallback(
    (retreats: OperatorRetreat[]) => {
      // Demand signature per retreat for poll-diffing — only events the
      // operator can already individually see (holds, bookings) pulse the
      // orb; match-count changes stay silent so impulse timing can never
      // leak an individual below the density gate.
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
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <div className="flex items-baseline justify-between mb-8">
        <div className="flex items-center gap-5">
          <MiraOrb size={48} presence={presence} />
          <div>
            <p className="tag mb-2">operator</p>
            <h1 className="font-serif text-4xl tracking-tight">Your retreats</h1>
          </div>
        </div>
        <Link
          href="/attest"
          className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm"
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
        <div className="border border-[color:var(--hairline)] rounded-sm p-8">
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
        <div className="space-y-4">
          {/* The morning ritual: Mira's read of the demand, above the
              data. Aggregates only — the density gate holds. */}
          {briefing && (
            <div className="flex items-start gap-4 mb-8" aria-live="polite">
              <MiraOrb
                size={48}
                presence={presence}
                className="flex-shrink-0 mt-1"
              />
              <div>
                <p className="text-lg leading-relaxed">{briefing.headline}</p>
                {briefing.lines.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {briefing.lines.map((line) => (
                      <li
                        key={line}
                        className="text-sm leading-relaxed text-[color:var(--muted)]"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {state.retreats.map((retreat) => {
            const d = retreat.demand;
            const hasDemand = d && (d.totalMatches > 0 || d.activeHolds > 0 || d.bookings > 0);
            return (
              <Link
                key={retreat.rootHash}
                href={`/operator/${retreat.rootHash}`}
                className="block border border-[color:var(--hairline)] rounded-sm p-6 hover:border-[color:var(--accent-soft)] transition-colors"
              >
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h2 className="font-serif text-2xl tracking-tight">
                    {retreat.title}
                  </h2>
                  <span className="tag flex-shrink-0">
                    {new Date(retreat.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--muted)]">
                  {retreat.claims.location} · {retreat.claims.durationDays} days ·
                  ${retreat.claims.priceUsd.toLocaleString()} · cohort of{" "}
                  {retreat.claims.capacity}
                </p>
                {hasDemand && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs">
                    {d!.totalMatches > 0 && (
                      <span className="text-[color:var(--muted)]">
                        <span className="text-foreground font-medium">
                          {d!.totalMatches}
                        </span>{" "}
                        matched
                      </span>
                    )}
                    {d!.activeHolds > 0 && (
                      <span className="text-[color:var(--accent-ink)]">
                        <span className="font-medium">{d!.activeHolds}</span>{" "}
                        holding
                      </span>
                    )}
                    {d!.bookings > 0 && (
                      <span className="text-[color:var(--accent-ink)]">
                        <span className="font-medium">{d!.bookings}</span> booked
                      </span>
                    )}
                  </div>
                )}
                {!hasDemand && (
                  <p className="text-xs text-[color:var(--muted)] mt-3">
                    Mira is watching for practitioners who fit this retreat.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {state.status === "loaded" && state.retreats.length > 0 && (
        <div className="mt-10 mb-4">
          <OperatorInsights retreats={state.retreats} />
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-[color:var(--hairline)]">
        <p className="text-xs text-[color:var(--muted)]">
          Signed in as {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      </div>
    </section>
  );
}
