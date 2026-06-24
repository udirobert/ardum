import { notFound } from "next/navigation";
import Link from "next/link";

import { getAttestation } from "@/lib/og-storage";
import { RETREAT_PHOTOS, FALLBACK_GRADIENT } from "@/lib/retreat-photos";
import BreathCycleDiagram from "@/matching/BreathCycleDiagram";
import ProgressiveBlurImage from "@/components/ProgressiveBlurImage";
import RevealSection from "@/components/RevealSection";
import ClientMatchBanner from "@/components/ClientMatchBanner";

export const dynamic = "force-dynamic";

export default async function MatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const attestation = await getAttestation(id);

  if (!attestation) {
    notFound();
  }

  const title = attestation.title ?? id;
  const description = attestation.description ?? "";
  const location = attestation.claims.location ?? "";
  const durationDays = attestation.claims.durationDays ?? 0;
  const priceUsd = attestation.claims.priceUsd ?? 0;
  const capacity = attestation.claims.capacity ?? 0;
  const practiceStyle = attestation.claims.practiceStyle ?? [];
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

      <ClientMatchBanner retreatId={id} />

      {attestation && (
        <RevealSection delay={300}>
          <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-8 surface-card">
            <p className="tag mb-4 flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"
              />
              attestation · stored on{" "}
              <span className="text-foreground">0G Storage</span>
            </p>
            <dl className="grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[color:var(--muted)]">attestor</dt>
              <dd className="tag break-all">{attestation.attestor}</dd>
              <dt className="text-[color:var(--muted)]">created</dt>
              <dd>{new Date(attestation.createdAt).toLocaleDateString()}</dd>
              <dt className="text-[color:var(--muted)]">rootHash</dt>
              <dd className="tag break-all opacity-80">{id}</dd>
            </dl>
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
