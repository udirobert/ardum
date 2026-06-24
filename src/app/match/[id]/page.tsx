import { notFound } from "next/navigation";
import Link from "next/link";

import { getAttestation } from "@/lib/og-storage";
import { RETREAT_PHOTOS, FALLBACK_GRADIENT } from "@/lib/retreat-photos";
import ReasoningList from "@/matching/ReasoningList";
import BreathCycleDiagram from "@/matching/BreathCycleDiagram";
import ProgressiveBlurImage from "@/components/ProgressiveBlurImage";
import RevealSection from "@/components/RevealSection";
import MaskReveal from "@/components/MaskReveal";

export const dynamic = "force-dynamic";

// Per-retreat match detail — full reasoning, full claims, the attestation
// fetched from 0G Storage (or local fallback) by rootHash.

export default async function MatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The URL id IS the retreatRootHash in the seed (and in real 0G Storage,
  // the content id). Look up the match run that contained it.
  // In a richer app we'd store an index from retreat → runs.
  const sessions = (globalThis as { __ardumSessions?: Map<string, { matchRun?: import("@/matching/types").MatchRun }> })
    .__ardumSessions;
  const allRuns = sessions
    ? Array.from(sessions.values()).map((s) => s.matchRun).filter(Boolean)
    : [];
  const run = allRuns
    .flatMap((r) => (r ? [r] : []))
    .find((r) => r.results.some((m) => m.id === id || m.retreatRootHash === id));
  const match = run?.results.find((m) => m.id === id || m.retreatRootHash === id);

  const attestation = await getAttestation(id);

  if (!match && !attestation) {
    notFound();
  }

  // Fallback: render attestation-only if we don't have a run (e.g. direct
  // share-link to a known retreat).
  const title = match?.retreatTitle ?? attestation?.title ?? id;
  const description = match?.retreatDescription ?? attestation?.description ?? "";
  const location = match?.retreatLocation ?? attestation?.claims.location ?? "";
  const durationDays = match?.durationDays ?? attestation?.claims.durationDays ?? 0;
  const priceUsd = match?.priceUsd ?? attestation?.claims.priceUsd ?? 0;
  const capacity = match?.capacity ?? attestation?.claims.capacity ?? 0;
  const practiceStyle =
    match?.practiceStyle ?? attestation?.claims.practiceStyle ?? [];
  const headline = match?.headline;
  const score = match?.score;
  const reasoning = match?.reasoning ?? [];
  const photo = RETREAT_PHOTOS[id];

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <Link
        href="/match"
        className="tag hover:text-foreground transition-colors"
      >
        ← all matches
      </Link>

      {photo && (
        <div className="mt-8 mb-10 -mx-6 sm:-mx-10">
          <ProgressiveBlurImage
            src={photo.src}
            alt={photo.alt}
            width={1200}
            height={675}
            aspectRatio="16/9"
            fallbackGradient={FALLBACK_GRADIENT}
            className="rounded-sm"
          />
        </div>
      )}

      <p className="tag mt-10 mb-2">{location}</p>
      <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-3">
        {title}
      </h1>
      <p className="text-[color:var(--muted)] mb-6">
        {durationDays} days · ${priceUsd.toLocaleString()} · cohort of{" "}
        {capacity}
      </p>

      {headline && (
        <p className="font-serif text-2xl italic leading-snug mb-8 max-w-prose">
          {headline}
        </p>
      )}

      <p className="text-[color:var(--muted)] max-w-prose mb-10 leading-relaxed">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mb-12">
        {practiceStyle.map((s) => (
          <span
            key={s}
            className="text-xs px-2.5 py-1 rounded-sm border border-[color:var(--hairline)] text-[color:var(--muted)]"
          >
            {s}
          </span>
        ))}
      </div>

      {typeof score === "number" && (
        <div className="mb-12 flex items-baseline gap-3">
          <p className="font-serif text-5xl tabular-nums">
            {Math.round(score * 100)}
          </p>
          <p className="tag">fit score</p>
        </div>
      )}

      {reasoning.length > 0 && (
        <MaskReveal>
          <div className="mb-12">
            <h2 className="font-serif text-3xl tracking-tight mb-6">
              Reasoning
            </h2>
            <ReasoningList steps={reasoning} />
          </div>
        </MaskReveal>
      )}

      {attestation && (
        <RevealSection delay={300}>
          <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-8 surface-card">
            <p className="tag mb-3">attestation</p>
            <p className="text-sm mb-3">
              <span className="text-[color:var(--muted)]">attestor: </span>
              <span className="tag break-all">{attestation.attestor}</span>
            </p>
            <p className="text-sm">
              <span className="text-[color:var(--muted)]">created: </span>
              {new Date(attestation.createdAt).toLocaleDateString()}
            </p>
            {attestation.claims.notes && (
              <p className="why mt-4 max-w-prose">{attestation.claims.notes}</p>
            )}
          </div>
        </RevealSection>
      )}

      {attestation?.claims.breathCycle && (
        <RevealSection delay={450}>
          <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-8 mt-6 surface-card">
            <p className="tag mb-3">breath cycle</p>
            <p className="text-sm mb-4 text-[color:var(--muted)]">
              Nafas-shaped — {attestation.claims.breathCycle.ratio} ratio,
              each phase in {attestation.claims.breathCycle.unit}.
            </p>
            <BreathCycleDiagram
              cycle={attestation.claims.breathCycle}
            />
          </div>
        </RevealSection>
      )}
    </section>
  );
}
