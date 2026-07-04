import { notFound } from "next/navigation";
import Link from "next/link";

import { getAttestation } from "@/lib/og-storage";
import { getProfile } from "@/lib/session";
import { recallContext } from "@/lib/cognee";
import { RETREAT_PHOTOS, FALLBACK_GRADIENT } from "@/lib/retreat-photos";
import BreathCycleDiagram from "@/matching/BreathCycleDiagram";
import ProgressiveBlurImage from "@/components/ProgressiveBlurImage";
import RevealSection from "@/components/RevealSection";
import ClientMatchBanner from "@/components/ClientMatchBanner";
import AgentLetter from "@/components/AgentLetter";
import { matchLetter } from "@/agent/mira-voice";
import ChangedMyMind from "@/matching/ChangedMyMind";
import ShareMatch from "@/matching/ShareMatch";
import type { MatchResult } from "@/matching/types";

export const dynamic = "force-dynamic";

export default async function MatchDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string; user?: string }>;
}) {
  const { id } = await params;
  const { session: sessionId, user: userId } = await searchParams;

  const attestation = await getAttestation(id);

  if (!attestation) {
    notFound();
  }

  // Fetch the practitioner's profile to personalize Mira's letter
  const profile = sessionId ? await getProfile(sessionId) : undefined;
  const signals = profile
    ? { energy: profile.energy, budget: profile.budget, social: profile.social }
    : {};

  // Recall Mira's memory for this practitioner so the letter can open
  // with recognition instead of a cold start. Uses the persistent userId
  // (not the ephemeral sessionId) so memory survives across sessions.
  // Graceful no-op when Cognee is not configured.
  const memory = (userId ?? sessionId) ? await recallContext(userId ?? sessionId!) : undefined;

  const title = attestation.title ?? id;
  const description = attestation.description ?? "";
  const location = attestation.claims.location ?? "";
  const durationDays = attestation.claims.durationDays ?? 0;
  const priceUsd = attestation.claims.priceUsd ?? 0;
  const capacity = attestation.claims.capacity ?? 0;
  const practiceStyle = attestation.claims.practiceStyle ?? [];
  const photo = RETREAT_PHOTOS[id];

  // Build a minimal MatchResult for Mira's letter
  const matchForLetter: MatchResult = {
    id,
    retreatRootHash: id,
    retreatTitle: title,
    retreatDescription: description,
    retreatLocation: location,
    durationDays,
    priceUsd,
    capacity,
    practiceStyle,
    score: 0,
    headline: description.slice(0, 140),
    reasoning: [],
    attestationCount: 1,
    attestor: attestation.attestor,
    attestedAt: attestation.createdAt,
  };

  const letter = matchLetter(matchForLetter, signals, memory);

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

      {/* Mira's letter — the agent presents the match, not a product listing */}
      <AgentLetter
        orbSize={56}
        lines={letter.lines}
        cta={letter.cta}
        recognitionLineCount={letter.recognitionLineCount}
        retreatRootHash={id}
        retreatTitle={title}
        depositUsd={priceUsd}
        operatorAddress={attestation.attestor}
        classPriceUsd={Math.max(25, Math.round(priceUsd / 20))}
        signals={signals}
        sessionId={sessionId}
        userId={userId}
      />

      <ClientMatchBanner retreatId={id} />

      {/* Retreat details — below the letter, as supporting context */}
      <RevealSection delay={200}>
        <div className="mt-12 pt-8 border-t border-[color:var(--hairline)]">
          <p className="tag mb-4">the retreat</p>
          <h2 className="font-serif text-3xl tracking-tight mb-3">{title}</h2>
          <p className="text-[color:var(--muted)] mb-4">
            {durationDays} days · ${priceUsd.toLocaleString()} · cohort of{" "}
            {capacity} · {location}
          </p>
          <p className="text-[color:var(--muted)] max-w-prose mb-6 leading-relaxed">
            {description}
          </p>
          <div className="flex flex-wrap gap-2">
            {practiceStyle.map((s) => (
              <span
                key={s}
                className="text-xs px-2.5 py-1 rounded-sm border border-[color:var(--hairline)] text-[color:var(--muted)]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Attestation provenance */}
      {attestation && (
        <RevealSection delay={300}>
          <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-8 surface-card mt-8">
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

      {/* Share this match — viral loop on the detail page too */}
      {sessionId && (
        <RevealSection delay={500}>
          <div className="mt-8">
            <ShareMatch match={matchForLetter} />
          </div>
        </RevealSection>
      )}

      {/* I changed my mind — re-match from the detail page */}
      {sessionId && (
        <RevealSection delay={550}>
          <ChangedMyMind sessionId={sessionId} />
        </RevealSection>
      )}
    </section>
  );
}
