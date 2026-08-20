"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOperatorAuth } from "@/booking/OperatorAuth";
import MiraOrb from "@/components/MiraOrb";
import {
  ENERGY_STATES,
  BUDGET_BANDS,
  SOCIAL_COMFORT,
  TRAVEL_WINDOWS,
} from "@/calibration/schema";

type BookingDetail = {
  episode: {
    id: string;
    status: string;
    bookedAt: string;
    depositTxId?: string;
  };
  retreat: {
    rootHash: string;
    title: string;
    location: string;
    durationDays: number;
    priceUsd: number;
    bookingUrl?: string;
  };
  intentionShape: {
    energy?: string;
    budget?: string;
    social?: string;
    travelWindow?: string;
    partySize?: number;
  };
  preparationPlan: {
    title: string;
    days: {
      day: number;
      title: string;
      description: string;
      duration: string;
    }[];
  };
  booking: {
    rootHash: string;
    depositUsd: number;
    bookedAt: string;
    checkInWindowHours?: number;
  } | null;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; detail: BookingDetail };

// Cast the label maps to accept string keys — the API returns string
// values that match the enum unions, but TypeScript can't verify that
// through the JSON boundary.
const ENERGY_LABELS = new Map<string, string>(
  ENERGY_STATES.map((e) => [e.value, e.label]),
);
const BUDGET_LABELS = new Map<string, string>(
  BUDGET_BANDS.map((b) => [b.value, b.label]),
);
const SOCIAL_LABELS = new Map<string, string>(
  SOCIAL_COMFORT.map((s) => [s.value, s.label]),
);
const TRAVEL_LABELS = new Map<string, string>(
  TRAVEL_WINDOWS.map((t) => [t.value, t.label]),
);

export default function BookingDetailPage() {
  const params = useParams();
  const episodeId = params.episodeId as string;
  const { address } = useOperatorAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!address || !episodeId) return;
    let cancelled = false;
    fetch(
      `/api/operator/bookings/${episodeId}?attestor=${encodeURIComponent(address)}`,
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load booking.");
        return json as BookingDetail;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "loaded", detail: data });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not load booking.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [address, episodeId]);

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

  const { detail } = state;
  const shape = detail.intentionShape;

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <Link
        href={`/operator/${detail.retreat.rootHash}`}
        className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors mb-8 inline-block"
      >
        ← back to {detail.retreat.title}
      </Link>

      <p className="tag mb-2">booking detail</p>
      <div className="flex items-center gap-5 mb-4">
        <MiraOrb size={48} presence={{ posture: "arriving", valence: 0 }} />
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
          Someone is coming.
        </h1>
      </div>
      <p className="text-lg text-[color:var(--muted)] max-w-prose mb-12 leading-relaxed">
        Booked for {detail.retreat.title} on{" "}
        {new Date(detail.episode.bookedAt).toLocaleDateString()}.
      </p>

      {/* Intention shape — coarse constraints, never the verbatim statement */}
      <div className="border border-[color:var(--hairline)] rounded-sm p-6 mb-8">
        <p className="tag mb-4">what they&apos;re making space for</p>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {shape.energy && (
            <span>
              <span className="text-[color:var(--muted)]">energy: </span>
              {ENERGY_LABELS.get(shape.energy) ?? shape.energy}
            </span>
          )}
          {shape.budget && (
            <span>
              <span className="text-[color:var(--muted)]">budget: </span>
              {BUDGET_LABELS.get(shape.budget) ?? shape.budget}
            </span>
          )}
          {shape.social && (
            <span>
              <span className="text-[color:var(--muted)]">social: </span>
              {SOCIAL_LABELS.get(shape.social) ?? shape.social}
            </span>
          )}
          {shape.travelWindow && (
            <span>
              <span className="text-[color:var(--muted)]">window: </span>
              {TRAVEL_LABELS.get(shape.travelWindow) ?? shape.travelWindow}
            </span>
          )}
          {shape.partySize && (
            <span>
              <span className="text-[color:var(--muted)]">party: </span>
              {shape.partySize === 1 ? "solo" : `${shape.partySize} people`}
            </span>
          )}
        </div>
        <p className="text-xs text-[color:var(--muted)] mt-4 max-w-prose">
          These are coarse constraints the practitioner chose from structured
          options. The verbatim intention statement is private and is never
          shown to operators.
        </p>
      </div>

      {/* Preparation plan — Mira's voice */}
      <div className="mb-8">
        <p className="font-serif text-2xl tracking-tight mb-1">
          {detail.preparationPlan.title}
        </p>
        <p className="text-sm text-[color:var(--muted)] mb-6">
          Mira prepared them with a 5-day wind-down plan.
        </p>
        <ol className="space-y-5">
          {detail.preparationPlan.days.map((day) => (
            <li key={day.day} className="flex gap-4">
              <span className="font-serif text-3xl text-[color:var(--accent-soft)] leading-none w-10 flex-shrink-0">
                {day.day}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="font-serif text-lg tracking-tight">
                    {day.title}
                  </p>
                  <span className="tag opacity-60 flex-shrink-0">
                    {day.duration}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                  {day.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Booking details */}
      {detail.booking && (
        <div className="border-l-2 border-[color:var(--accent-soft)] pl-5 mb-8">
          <p className="tag mb-2">booking</p>
          <p className="text-sm text-[color:var(--muted)] leading-relaxed">
            Deposit: ${detail.booking.depositUsd.toLocaleString()} · booked{" "}
            {new Date(detail.booking.bookedAt).toLocaleDateString()}
            {detail.episode.depositTxId && (
              <>
                {" "}· ref {detail.episode.depositTxId.slice(0, 18)}
                {detail.episode.depositTxId.length > 18 ? "…" : ""}
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-[color:var(--hairline)]">
        <p className="text-xs text-[color:var(--muted)] max-w-prose">
          The preparation plan is Mira&apos;s voice, generated from the
          practitioner&apos;s energy signals — not their private intention.
          This is the relationship surface: you know who&apos;s coming and
          why, without reading their personal words.
        </p>
      </div>
    </section>
  );
}
