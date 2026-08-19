"use client";

import { useEffect, useState } from "react";
import { useOperatorAuth } from "@/booking/OperatorAuth";
import OperatorWalletButton from "@/booking/OperatorWalletButton";
import type { AttestationIndex } from "@/attestation/schema";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; retreats: AttestationIndex[] }
  | { status: "error"; message: string };

export default function OperatorPage() {
  const { address } = useOperatorAuth();
  const [state, setState] = useState<State>(
    () => (address ? { status: "loading" } : { status: "idle" }),
  );

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch(`/api/operator/retreats?attestor=${encodeURIComponent(address)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load retreats.");
        return json.retreats as AttestationIndex[];
      })
      .then((data) => {
        if (!cancelled) setState({ status: "loaded", retreats: data });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Could not load retreats.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) {
    return (
      <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-12 pb-24">
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
        <div>
          <p className="tag mb-2">operator</p>
          <h1 className="font-serif text-4xl tracking-tight">Your retreats</h1>
        </div>
        <a
          href="/attest"
          className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm"
        >
          List another →
        </a>
      </div>

      {state.status === "loading" && (
        <p className="text-[color:var(--muted)]">Loading your retreats…</p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-[color:var(--accent-ink)]" role="alert">
          {state.message}
        </p>
      )}

      {state.status === "idle" && null}

      {state.status === "loaded" && state.retreats.length === 0 && (
        <div className="border border-[color:var(--hairline)] rounded-sm p-8">
          <p className="text-lg leading-relaxed mb-2">
            You haven&apos;t listed any retreats yet.
          </p>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            Once you publish a retreat, Mira will match practitioners whose
            intentions fit — and you&apos;ll see them here before they inquire.
          </p>
          <a
            href="/attest"
            className="inline-block px-6 py-3 rounded-sm bg-foreground text-background text-sm"
          >
            List your first retreat →
          </a>
        </div>
      )}

      {state.status === "loaded" && state.retreats.length > 0 && (
        <div className="space-y-4">
          {state.retreats.map((retreat) => (
            <a
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
            </a>
          ))}
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
