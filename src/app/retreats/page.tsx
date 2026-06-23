import Link from "next/link";

import { listAttestations } from "@/lib/og-storage";

// /retreats — a transparent browse of the attestation pool. Anyone can see
// what the matching agent is reasoning against, and click through to the
// full attestation detail. This page exists so the system has nothing
// hidden — the "why" is the product.

export const dynamic = "force-dynamic";

export default async function RetreatsPage() {
  const attestations = await listAttestations();

  return (
    <section className="mx-auto w-full max-w-4xl px-6 sm:px-10 pt-12 pb-24">
      <p className="tag mb-4">attestation pool</p>
      <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
        What we&apos;re matching against.
      </h1>
      <p className="text-lg text-[color:var(--muted)] max-w-prose mb-12 leading-relaxed">
        Every retreat below is a verified attestation. The matching agent
        reasons against this pool — nothing else. {attestations.length}{" "}
        {attestations.length === 1 ? "attestation" : "attestations"} loaded
        from 0G Storage (or the seed when no 0G credentials are configured).
      </p>

      <ul className="grid sm:grid-cols-2 gap-4">
        {attestations.map((a) => (
          <li key={a.rootHash}>
            <Link
              href={`/match/${a.rootHash}`}
              className="block h-full border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 hover:border-[color:var(--accent-soft)] transition-colors"
            >
              <p className="tag mb-2">{a.claims.location}</p>
              <h2 className="font-serif text-2xl tracking-tight leading-tight mb-2">
                {a.title}
              </h2>
              <p className="text-[color:var(--muted)] text-sm mb-4">
                {a.claims.durationDays} days · $
                {a.claims.priceUsd.toLocaleString()} · cohort of{" "}
                {a.claims.capacity}
              </p>
              <p className="text-sm max-w-prose mb-4">{a.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {a.claims.practiceStyle.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded-sm border border-[color:var(--hairline)] text-[color:var(--muted)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="why mt-12 max-w-prose">
        These are the seed retreats. New ones land via{" "}
        <Link
          href="/attest"
          className="underline underline-offset-4 decoration-[color:var(--hairline)] hover:decoration-[color:var(--accent)]"
        >
          writing an attestation
        </Link>{" "}
        — the pool is open.
      </p>
    </section>
  );
}
