"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOperatorAuth } from "@/booking/OperatorAuth";
import MiraOrb from "@/components/MiraOrb";
import { operatorPresence } from "@/agent/operator-presence";
import OperatorDemandTable from "@/components/OperatorDemandTable";
import type { AttestationIndex } from "@/attestation/schema";
import type { DemandSummary } from "@/episodes/operator-projection";

type RetreatDetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "loaded";
      retreat: AttestationIndex;
      demand: DemandSummary;
    };

export default function RetreatDetailPage() {
  const params = useParams();
  const retreatRootHash = params.retreatRootHash as string;
  const { address } = useOperatorAuth();
  const [state, setState] = useState<RetreatDetailState>({
    status: "loading",
  });

  useEffect(() => {
    if (!address || !retreatRootHash) return;
    let cancelled = false;
    fetch(
      `/api/operator/matches?attestor=${encodeURIComponent(address)}&retreatRootHash=${encodeURIComponent(retreatRootHash)}`,
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load demand.");
        const retreat = json.retreats?.[0];
        const demand = json.demand?.[retreatRootHash];
        if (!retreat || !demand)
          throw new Error("Retreat or demand data not found.");
        return {
          retreat: retreat as AttestationIndex,
          demand: demand as DemandSummary,
        };
      })
      .then((data) => {
        if (!cancelled)
          setState({ status: "loaded", ...data });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not load demand.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [address, retreatRootHash]);

  if (state.status === "loading") {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
        <p className="text-[color:var(--muted)]">Loading…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
        <p className="text-sm text-[color:var(--accent-ink)]" role="alert">
          {state.message}
        </p>
        <Link
          href="/operator"
          className="inline-block mt-4 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          ← back to your retreats
        </Link>
      </section>
    );
  }

  const { retreat, demand } = state;

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <Link
        href="/operator"
        className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors mb-8 inline-block"
      >
        ← your retreats
      </Link>

      <div className="flex items-center gap-4 mb-3">
        <MiraOrb size={36} presence={operatorPresence(demand)} />
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight">
          {retreat.title}
        </h1>
      </div>
      <p className="text-sm text-[color:var(--muted)] mb-8">
        {retreat.claims.location} · {retreat.claims.durationDays} days ·
        ${retreat.claims.priceUsd.toLocaleString()} · cohort of{" "}
        {retreat.claims.capacity}
      </p>

      {/* Demand summary — one slim strip, always visible */}
      <div className="flex gap-6 mb-8">
        {(
          [
            [demand.totalMatches, "matched"],
            [demand.activeHolds, "holding"],
            [demand.bookings, "booked"],
          ] as const
        ).map(([value, label]) => (
          <p key={label} className="flex items-baseline gap-1.5">
            <span className="text-xl tabular-nums font-medium">{value}</span>
            <span className="text-xs text-[color:var(--muted)]">{label}</span>
          </p>
        ))}
      </div>

      {/* Matches table — sortable demand grid */}
      {demand.totalMatches === 0 ? (
        <div className="border border-[color:var(--hairline)] rounded-sm p-8">
          <MiraOrb
            size={48}
            presence={{ posture: "watching", valence: 0 }}
            className="mb-4"
          />
          <p className="text-lg leading-relaxed mb-2">
            Mira is watching for practitioners who fit this retreat.
          </p>
          <p className="text-sm text-[color:var(--muted)]">
            When a practitioner describes what they need and their intentions
            match your retreat, they&apos;ll appear here — before they inquire.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-serif text-2xl tracking-tight mb-2">
            Matched practitioners
          </h2>
          <div className="border border-[color:var(--hairline)] rounded-sm overflow-hidden">
            <OperatorDemandTable
              matches={demand.matches}
              bookingHref={(match) =>
                `/operator/${retreatRootHash}/bookings/${match.episodeId}`
              }
            />
          </div>
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-[color:var(--hairline)]">
        <p className="text-xs text-[color:var(--muted)] max-w-prose">
          Intention shapes are coarse constraints the practitioner chose
          (energy, budget, social, travel window). They are never the
          verbatim intention statement. This is the same privacy contract
          that protects practitioner data on every Ardum surface.
        </p>
      </div>
    </section>
  );
}
