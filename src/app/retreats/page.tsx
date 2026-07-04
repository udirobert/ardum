import Link from "next/link";

import { listAttestations } from "@/lib/og-storage";
import { RETREAT_PHOTOS, FALLBACK_GRADIENT } from "@/lib/retreat-photos";
import SectionDivider from "@/components/SectionDivider";
import ProgressiveBlurImage from "@/components/ProgressiveBlurImage";
import MaskReveal from "@/components/MaskReveal";
import MiraOrb from "@/components/MiraOrb";
import RetreatCarousel from "@/components/RetreatCarousel";

// /retreats — a transparent browse of the attestation pool. Anyone can see
// what the matching agent is reasoning against, and click through to the
// full attestation detail. This page exists so the system has nothing
// hidden — the "why" is the product.

export const dynamic = "force-dynamic";

export default async function RetreatsPage() {
  const attestations = await listAttestations();

  return (
    <section className="mx-auto w-full max-w-4xl px-6 sm:px-10 pt-12 pb-24">
      <p className="tag mb-4">attestation pool · 0G Storage</p>
      <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
        What we&apos;re matching against.
      </h1>
      <p className="text-lg text-[color:var(--muted)] max-w-prose mb-6 leading-relaxed">
        Every retreat below is a wallet-signed attestation stored on{" "}
        <span className="text-foreground">0G Storage</span>. The matching
        agent reasons against this pool — nothing else. {attestations.length}{" "}
        {attestations.length === 1 ? "attestation" : "attestations"} loaded.
      </p>
      <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-[color:var(--hairline)] rounded-sm px-3 py-2 bg-[color:var(--surface)] mb-12">
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"
        />
        <span className="tag">
          stored on <span className="text-foreground">0G Storage</span>
        </span>
        <span aria-hidden className="text-[color:var(--hairline)]">|</span>
        <span className="tag">
          reasoned by{" "}
          <span className="text-foreground">0G Compute Router</span>
        </span>
      </div>

      <SectionDivider />

      {/* Mira greeting — the agent is present even on the browse page */}
      <div className="flex items-start gap-4 mb-12 fade-in-up">
        <MiraOrb size={40} state="calm" className="flex-shrink-0 mt-1" />
        <div className="max-w-prose">
          <p className="text-sm leading-relaxed text-[color:var(--muted)]">
            These are the retreats I reason against. Each one is a verified
            attestation — not a listing. If you&apos;d rather I find your match,
            <Link
              href="/#intake"
              className="text-[color:var(--accent)] hover:text-[color:var(--accent-ink)] transition-colors ml-1"
            >
              talk to me first →
            </Link>
          </p>
        </div>
      </div>

      {/* 3D carousel — cinematic browse of the pool */}
      {attestations.length > 0 && (
        <div className="mb-16 -mx-6 sm:-mx-10">
          <p className="tag mb-3 px-6 sm:px-10">drag to explore</p>
          <RetreatCarousel
            retreats={attestations.map((a) => ({
              rootHash: a.rootHash,
              title: a.title ?? "",
              location: a.claims.location ?? "",
              priceUsd: a.claims.priceUsd ?? 0,
              photo: RETREAT_PHOTOS[a.rootHash],
            }))}
          />
        </div>
      )}

      {attestations.length === 0 ? (
        <div className="py-16 text-center surface-card rounded-sm border border-dashed border-[color:var(--hairline)]">
          <div className="flex justify-center mb-6">
            <MiraOrb size={48} state="calm" />
          </div>
          <p className="font-serif text-3xl tracking-tight mb-4">
            The pool is still forming.
          </p>
          <p className="text-[color:var(--muted)] max-w-md mx-auto mb-8 leading-relaxed">
            No attestations have been written yet. Be the first to seed it —
            write one about a retreat you know, and I&apos;ll start reasoning
            against it. Every attestation makes the matching smarter for the
            next practitioner who arrives.
          </p>
          <Link
            href="/attest"
            className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            Write an attestation →
          </Link>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {attestations.map((a, i) => {
            const photo = RETREAT_PHOTOS[a.rootHash];
            return (
              <MaskReveal key={a.rootHash}>
                <li
                  className={`${i === 0 ? "fade-in-up-1" : (i % 2 === 0 ? "fade-in-up-2" : "fade-in-up-3")}`}
                >
                  <Link
                    href={`/match/${a.rootHash}`}
                    className="block h-full border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 hover:border-[color:var(--accent-soft)] transition-colors hover-lift surface-card"
                  >
                    {photo && (
                      <ProgressiveBlurImage
                        src={photo.src}
                        alt={photo.alt}
                        width={600}
                        height={400}
                        aspectRatio="3/2"
                        fallbackGradient={FALLBACK_GRADIENT}
                        className="mb-4 rounded-sm"
                      />
                    )}
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
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {a.claims.practiceStyle.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 rounded-sm border border-[color:var(--hairline)] text-[color:var(--muted)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-[color:var(--hairline)] mt-2">
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="tag">
                          1 attestation ·{" "}
                          <span className="text-foreground">0G Storage</span>
                        </p>
                        <span className="opacity-70 text-xs">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]" />
                          bookable
                        </span>
                        <span className="text-xs text-[color:var(--muted)]">
                          ${a.claims.priceUsd.toLocaleString()} deposit · drop-in ${Math.max(25, Math.round(a.claims.priceUsd / 20))}
                        </span>
                      </div>
                      <p className="tag opacity-60 truncate">
                        {a.rootHash}
                      </p>
                    </div>
                  </Link>
                </li>
              </MaskReveal>
            );
          })}
        </ul>
      )}

      {attestations.length > 0 && (
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
      )}
    </section>
  );
}
