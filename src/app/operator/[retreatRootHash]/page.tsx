"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOperatorAuth } from "@/booking/OperatorAuth";
import type { AttestationIndex } from "@/attestation/schema";
import type { DemandSummary } from "@/episodes/operator-projection";
import {
  ENERGY_STATES,
  BUDGET_BANDS,
  SOCIAL_COMFORT,
  TRAVEL_WINDOWS,
} from "@/calibration/schema";

type RetreatDetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "loaded";
      retreat: AttestationIndex;
      demand: DemandSummary;
    };

const ENERGY_LABELS = new Map(ENERGY_STATES.map((e) => [e.value, e.label]));
const BUDGET_LABELS = new Map(BUDGET_BANDS.map((b) => [b.value, b.label]));
const SOCIAL_LABELS = new Map(SOCIAL_COMFORT.map((s) => [s.value, s.label]));
const TRAVEL_LABELS = new Map(TRAVEL_WINDOWS.map((t) => [t.value, t.label]));

function statusLabel(status: string): string {
  switch (status) {
    case "capturing":
      return "describing what they need";
    case "clarifying":
      return "clarifying constraints";
    case "recommendation-ready":
      return "reviewing your retreat";
    case "held":
      return "holding your retreat";
    case "ready-to-book":
      return "ready to book";
    case "booked":
      return "booked";
    case "monitoring":
      return "watching your retreat";
    default:
      return status;
  }
}

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

      <p className="tag mb-2">retreat detail</p>
      <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-4">
        {retreat.title}
      </h1>
      <p className="text-[color:var(--muted)] mb-12">
        {retreat.claims.location} · {retreat.claims.durationDays} days ·
        ${retreat.claims.priceUsd.toLocaleString()} · cohort of{" "}
        {retreat.claims.capacity}
      </p>

      {/* Demand summary */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        <div>
          <p className="font-serif text-3xl tracking-tight">
            {demand.totalMatches}
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            practitioners matched
          </p>
        </div>
        <div>
          <p className="font-serif text-3xl tracking-tight">
            {demand.activeHolds}
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            holding spots
          </p>
        </div>
        <div>
          <p className="font-serif text-3xl tracking-tight">
            {demand.bookings}
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-1">booked</p>
        </div>
      </div>

      {/* Matches list */}
      {demand.totalMatches === 0 ? (
        <div className="border border-[color:var(--hairline)] rounded-sm p-8">
          <p className="text-lg leading-relaxed mb-2">
            Mira is watching for practitioners who fit this retreat.
          </p>
          <p className="text-sm text-[color:var(--muted)]">
            When a practitioner describes what they need and their intentions
            match your retreat, they&apos;ll appear here — before they inquire.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight mb-4">
            Matched practitioners
          </h2>
          {demand.matches.map((match) => (
            <div
              key={match.episodeId}
              className="border border-[color:var(--hairline)] rounded-sm p-5"
            >
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <span className="tag">
                  {match.isTopPick ? "top pick" : "alternative"}
                </span>
                <span className="text-xs text-[color:var(--muted)]">
                  {statusLabel(match.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {match.shape.energy && (
                  <span>
                    <span className="text-[color:var(--muted)]">energy: </span>
                    {ENERGY_LABELS.get(match.shape.energy) ?? match.shape.energy}
                  </span>
                )}
                {match.shape.budget && (
                  <span>
                    <span className="text-[color:var(--muted)]">budget: </span>
                    {BUDGET_LABELS.get(match.shape.budget) ?? match.shape.budget}
                  </span>
                )}
                {match.shape.social && (
                  <span>
                    <span className="text-[color:var(--muted)]">social: </span>
                    {SOCIAL_LABELS.get(match.shape.social) ?? match.shape.social}
                  </span>
                )}
                {match.shape.travelWindow && (
                  <span>
                    <span className="text-[color:var(--muted)]">window: </span>
                    {TRAVEL_LABELS.get(match.shape.travelWindow) ??
                      match.shape.travelWindow}
                  </span>
                )}
                {match.shape.partySize && (
                  <span>
                    <span className="text-[color:var(--muted)]">
                      party:{" "}
                    </span>
                    {match.shape.partySize === 1
                      ? "solo"
                      : `${match.shape.partySize} people`}
                  </span>
                )}
              </div>
              {match.holdExpiresAt && (
                <p className="text-xs text-[color:var(--accent-ink)] mt-3">
                  Holding — expires{" "}
                  {new Date(match.holdExpiresAt).toLocaleString()}
                </p>
              )}
              {match.bookedAt && (
                <p className="text-xs text-[color:var(--accent-ink)] mt-3">
                  Booked{" "}
                  {new Date(match.bookedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
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
