"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { motion } from "framer-motion";
import MiraOrb from "@/components/MiraOrb";
import GooeyEmergence, { GooeySource } from "@/components/GooeyEmergence";
import { matchLetter } from "@/agent/mira-voice";
import { resolveRetreatVision } from "@/aesthetics/resolve-retreat-vision";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { type AestheticVector } from "@/aesthetics/image-pool";
import type { MatchResult } from "@/matching/types";
import type { MiraPresence } from "@/agent/mira-presence";
import type { MemoryContext } from "@/memory/semantic-memory";
import type { Episode, NextDecision } from "@/episodes/model";
import type { DerivedViews, WorkbenchActions } from "./types";
import PrimaryButton from "./PrimaryButton";
import HoldPanel from "./HoldPanel";
import LensFactors from "./LensFactors";
import ExploreOtherFits from "./ExploreOtherFits";
import ReasoningOrbs from "./ReasoningOrbs";
import ListeningSurface from "./ListeningSurface";
import {
  dismissListeningBeckon,
  listeningBeckonSeen,
  listeningBeckonSeenServer,
  subscribeListeningBeckon,
} from "@/lib/listening-teach";
import { formatDateTime, formatUsd } from "@/lib/format";
import { useSyncExternalStore } from "react";

const CommitmentPanel = dynamic(
  () => import("@/booking/CommitmentPanel"),
  { ssr: false },
);

// The recommendation surface — the core of the workbench. Renders Mira's
// letter, the retreat card, and the state-appropriate primary decision
// (hold, secure my place, or commitment panel). Secondary tools (lenses,
// counterfactuals, alternatives) collapse under disclosure when the fit
// is strong; expand when uncertainty is high.
//
// Copy hierarchy (experience-layer contract):
//   1. Mira's letter (meaning)
//   2. one primary human decision
//   3. status (what Mira is doing)
//   4. provenance and secondary tools (disclosure)
export default function RecommendationSurface({
  episode,
  nextDecision,
  memory,
  miraPresence,
  recommendation,
  derived,
  busy,
  shareUrl,
  participant,
  voiceInput,
  voiceResponse,
  commitmentOpen,
  aestheticVector,
  actions,
}: {
  episode: Episode;
  nextDecision: NextDecision;
  memory: MemoryContext | undefined;
  miraPresence: MiraPresence | null;
  recommendation: MatchResult;
  derived: DerivedViews;
  busy: boolean;
  shareUrl: string | null;
  participant: string;
  voiceInput: string;
  voiceResponse: string | null;
  commitmentOpen: boolean;
  aestheticVector: AestheticVector | null;
  actions: WorkbenchActions;
}) {
  const intention = episode.intentions.at(-1)!;
  const latestObservation = episode.monitor?.observations.at(-1);

  // Mira's letter — recognition lines (returning users) + main letter.
  const practitionerSignals = {
    energy: intention.constraints.energy,
    budget: intention.constraints.budget,
    social: intention.constraints.social,
  };
  const letter = matchLetter(recommendation, practitionerSignals, memory);

  // Uncertainty gate: secondary tools expand only when the fit is weak.
  const fitScore = episode.recommendation?.result.score ?? 1;
  const expandSecondaryTools = fitScore < 0.75;

  // Adaptive density: the interface itself breathes differently depending
  // on confidence. High confidence = spacious (this is it). Low = denser
  // (look more carefully). Urgency = subtle warmth/tempo shift.
  const density = fitScore > 0.85 ? "spacious" : fitScore < 0.65 ? "dense" : "normal";
  // Hold urgency: compare expiry against a server-supplied timestamp.
  // The episode's hold has an expiresAt ISO string; we compare it to
  // the episode's own latest event timestamp as a stable "now" proxy.
  const latestEventAt = episode.events.at(-1)?.createdAt;
  const nowProxy = latestEventAt ? new Date(latestEventAt).getTime() : 0;
  const holdExpiry = episode.hold?.expiresAt && nowProxy
    ? new Date(episode.hold.expiresAt).getTime() - nowProxy
    : null;
  const holdUrgent = holdExpiry !== null && holdExpiry < 12 * 60 * 60 * 1000;

  // Rejection flow: when the practitioner clicks "not this one," we enter
  // the Listening beat (Beat 3) — Mira shows bounded alternative cards.
  // When they elevate one, the gooey division plays on the current card
  // and the server action fires to bring the alternative forward.
  const [listening, setListening] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // The Listening beckon: a one-time hint that alternatives exist behind
  // the rejection link (docs/design/experience-layer.md — Listening is
  // summoned, so marketplace-socialized users may never discover it).
  // Read through useSyncExternalStore so SSR renders identically (the
  // server snapshot is "seen") and dismissal re-renders via the store.
  const beckonSeen = useSyncExternalStore(
    subscribeListeningBeckon,
    listeningBeckonSeen,
    listeningBeckonSeenServer,
  );
  const showBeckon = !beckonSeen;
  const dismissBeckon = dismissListeningBeckon;

  const holdDecision =
    nextDecision.kind === "await-responses" ||
    nextDecision.kind === "review-hold" ||
    nextDecision.kind === "ready-to-book";

  // The alternatives come from the recommendation snapshot.
  const alternatives = episode.recommendation?.alternatives ?? [];

  return (
    <div
      className={[
        density === "spacious"
          ? "space-y-6"
          : density === "dense"
            ? "space-y-3"
            : "space-y-5",
        holdUrgent ? "commitment-urgent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-density={density}
    >
      {/* Mira's voice — one orb, one block. Recognition lines (if the
          practitioner is returning) sit above the why; both are Mira
          speaking, so they share a single presence. */}
      {letter && letter.lines.length > 0 && (
        <div className="flex items-start gap-3">
          <MiraOrb size={40} presence={miraPresence ?? undefined} className="flex-shrink-0 mt-1" viewTransitionName="mira-orb" />
          <div className="space-y-2 leading-relaxed flex-1">
            {letter.recognitionLineCount > 0 && (
              <div className="space-y-2">
                {letter.lines
                  .slice(0, letter.recognitionLineCount)
                  .map((line, index) => (
                    <p
                      key={`recognition-${index}`}
                      className="italic text-[color:var(--accent-ink)]"
                    >
                      {line}
                    </p>
                  ))}
              </div>
            )}
            {letter.lines
              .slice(letter.recognitionLineCount)
              .map((line, index) => (
                <p
                  key={`letter-${index}`}
                  className="text-lg leading-relaxed text-[color:var(--foreground)]"
                >
                  {line}
                </p>
              ))}
          </div>
        </div>
      )}

      {/* Beat 3 — Listening: when the practitioner rejected the current
          pick, Mira shows bounded alternative cards. The card and decision
          area are hidden while the Listening surface is visible. */}
      {listening ? (
        <ListeningSurface
          alternatives={alternatives}
          currentTitle={recommendation.retreatTitle}
          presence={miraPresence}
          onElevate={() => {
            // Elevating an alternative = rejecting the current pick. The
            // gooey division plays on the current card, then the server
            // action fires to re-recommend with the current pick excluded.
            // The re-ranked top pick replaces it. Note: the server
            // re-recommends deterministically — the elevated alternative
            // may or may not become the new top pick depending on its
            // score relative to the remaining pool.
            setListening(false);
            setRejecting(true);
          }}
          onBack={() => setListening(false)}
          busy={busy}
        />
      ) : (
        <>
      <RetreatCardEmergence
        key={recommendation.retreatRootHash}
        recommendation={recommendation}
        aestheticVector={aestheticVector}
        dividing={rejecting}
        onDivideComplete={() => {
          if (rejecting) {
            actions.act({
              type: "reject-recommendation",
              retreatRootHash: recommendation.retreatRootHash,
            });
          }
        }}
      />

      {/* Weak-fit caveat — shown only when the score is below 0.75. */}
      {episode.recommendation!.uncertainties.length > 0 && (
        <p className="text-sm italic text-[color:var(--muted)]">
          {episode.recommendation!.uncertainties.join(" ")}
        </p>
      )}

      {holdDecision && episode.hold?.status === "active" ? (
        <>
          {/* Mira's voice during hold — she's watching, not silent. */}
          <div className="flex items-start gap-3">
            <MiraOrb size={32} presence={miraPresence ?? undefined} className="flex-shrink-0 mt-1" />
            <p className="text-sm leading-relaxed italic text-[color:var(--accent-ink)]">
              I&apos;m watching this for you. I&apos;ll let you know if
              anything changes.
            </p>
          </div>
          <HoldPanel
            nextDecision={nextDecision}
            episode={episode}
            participant={participant}
            setParticipant={actions.setParticipant}
            shareUrl={shareUrl}
            busy={busy}
            onInvite={() =>
              actions.act({
                type: "create-invite",
                participantName: participant,
                sharingConsent: true,
              })
            }
            onRelease={() => actions.act({ type: "release-hold" })}
            onCloseCoordination={() => actions.act({ type: "close-coordination" })}
            onRefresh={actions.load}
            recommendation={recommendation}
            activeBand={derived.activeBand}
            bandData={derived.bandData}
            bandLoading={derived.bandLoading}
            onPickBand={actions.runCounterfactualBudget}
            activeEnergy={derived.activeEnergy}
            energyData={derived.energyData}
            energyLoading={derived.energyLoading}
            onPickEnergy={actions.runCounterfactualEnergy}
            expandSecondaryTools={expandSecondaryTools}
          />
        </>
      ) : (
        <>
          {/* The primary decision: hold this pick. Everything else
              collapses into disclosure so the page reads:
              letter → identity → Hold → status → disclosure. */}
          <div className="flex flex-col gap-2">
            <PrimaryButton
              disabled={busy}
              onClick={() => actions.act({ type: "create-hold" })}
            >
              Hold this for 48 hours
            </PrimaryButton>

            {episode.recommendation!.alternatives.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setListening(true)}
                  className="text-sm text-[color:var(--muted)] hover:text-foreground underline"
                >
                  Not this one — show me another
                </button>
                {!busy && showBeckon && (
                  <p
                    className="text-xs leading-relaxed text-[color:var(--muted)] border-l-2 border-[color:var(--accent-soft)] pl-3 cursor-pointer"
                    onClick={dismissBeckon}
                  >
                    There are other places I considered — but I hold one at a
                    time. If this isn&apos;t it, the button above opens them.
                    <span aria-hidden> (tap to dismiss)</span>
                  </p>
                )}
              </>
            )}
          </div>

          <p className="text-sm leading-relaxed italic text-[color:var(--muted)]">
            This is my strongest current fit. I&apos;ll keep watching —
            if something fits better, I&apos;ll let you know.
          </p>

          {/* Secondary tools collapse behind a single disclosure. */}
          <details
            className="border-t border-[color:var(--hairline)] pt-4"
            open={expandSecondaryTools || undefined}
          >
            <summary className="tag cursor-pointer">
              weigh it differently, or see what else fits
            </summary>
            <div className="mt-3 space-y-5">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    actions.act({
                      type: episode.monitor ? "check-monitor" : "start-monitoring",
                    })
                  }
                  className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
                >
                  {episode.monitor ? "Check for changes" : "or I can watch this for you →"}
                </button>
              </div>
              <LensFactors
                activeLens={derived.activeLens}
                lensData={derived.lensData}
                lensLoading={derived.lensLoading}
                busy={busy}
                onPickLens={actions.recomputeWithPerspective}
                recommendation={recommendation}
              />
              <ExploreOtherFits
                alternatives={episode.recommendation!.alternatives}
                recommendation={recommendation}
                busy={busy}
                activeBand={derived.activeBand}
                bandData={derived.bandData}
                bandLoading={derived.bandLoading}
                onPickBand={actions.runCounterfactualBudget}
                activeEnergy={derived.activeEnergy}
                energyData={derived.energyData}
                energyLoading={derived.energyLoading}
                onPickEnergy={actions.runCounterfactualEnergy}
                holdActive={false}
                expanded={expandSecondaryTools}
              />
            </div>
          </details>
        </>
      )}

      {latestObservation && (
        <div className="flex items-start gap-3">
          <MiraOrb size={28} presence={miraPresence ?? undefined} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-[color:var(--muted)]">
            Last checked {formatDateTime(new Date(latestObservation.observedAt))}
            :{" "}
            {latestObservation.summary}
          </p>
        </div>
      )}

      {nextDecision.kind === "ready-to-book" && (
        <div className="border-t border-[color:var(--hairline)] pt-6">
          <p className="why mb-3">
            Confirm amount and bounds. Mira handles the rest. You can
            change your mind before that line.
          </p>
          {!commitmentOpen ? (
            <div className="flex flex-col gap-2">
              <PrimaryButton
                disabled={busy}
                onClick={() => {
                  actions.fire("lean");
                  actions.setCommitmentOpen(true);
                }}
              >
                {nextDecision.primaryLabel}
              </PrimaryButton>
              {episode.hold?.status === "active" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => actions.act({ type: "release-hold" })}
                  className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
                >
                  or release the hold
                </button>
              )}
            </div>
          ) : (
            <CommitmentPanel
              episode={episode}
              onClose={() => actions.setCommitmentOpen(false)}
              onBooked={() => {
                actions.fire("commit");
                actions.setCommitmentOpen(false);
                void actions.load();
              }}
            />
          )}
        </div>
      )}

      {/* End of the card + decision area — closes the listening
          conditional. Feedback and reasoning disclosures stay visible
          in both the Arriving and Listening beats. */}
        </>
      )}

      {/* Feedback — collapsed by default so it doesn't compete
          with the primary Hold decision. */}
      <FeedbackDisclosure
        voiceInput={voiceInput}
        voiceResponse={voiceResponse}
        busy={busy}
        onVoiceInputChange={actions.setVoiceInput}
        onSubmitVoice={actions.submitVoiceFeedback}
        onCategorical={(reason) => actions.act({ type: "feedback", reason })}
      />

      {/* Reasoning disclosure: the data Mira saw for each axis, with an
          orbiting-blob visualization that makes the fit structure legible
          at a glance. The blobs are aria-hidden decoration; the text carries
          the accessible detail. */}
      <details className="pt-2">
        <summary className="tag cursor-pointer">how Mira chose this</summary>
        <div className="mt-3 flex flex-col sm:flex-row gap-4">
          <div className="flex-shrink-0">
            <ReasoningOrbs reasoning={recommendation.reasoning} size={64} />
          </div>
          <div className="space-y-4 flex-1">
            {recommendation.reasoning.map((step) => (
              <div key={step.axis} className="text-sm border-l-2 border-[color:var(--hairline)] pl-3">
                <p className="font-medium mb-1">{step.axis}</p>
                <p className="text-[color:var(--muted)] text-xs mb-1">
                  {step.given}
                </p>
                <p className="text-[color:var(--foreground)]">{step.then}</p>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

// The retreat card wrapped in a gooey emergence — the card "buds off" from
// the orb with a viscous detachment, then settles crisp. The GooeySource
// dot at the top stays tethered to the card while the practitioner reviews
// it; when they scroll past, the card pulls slightly toward the orb (the
// tether stretches). When the practitioner rejects ("not this one"), the
// card gooey-divides — the filter stays active during the exit so the
// card appears to drip away from the orb, not just disappear.
function RetreatCardEmergence({
  recommendation,
  aestheticVector,
  dividing,
  onDivideComplete,
}: {
  recommendation: MatchResult;
  aestheticVector: AestheticVector | null;
  dividing: boolean;
  onDivideComplete: () => void;
}) {
  const [emerged, setEmerged] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();

  // The emergence fires once on mount — the card "arrives." The gooey
  // filter stays active during the review state (the tether), then is
  // removed once the card has settled.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount trigger for emergence animation
    setMounted(true);
    const timer = setTimeout(() => setEmerged(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Fire the division callback once the exit animation completes.
  useEffect(() => {
    if (!dividing) return;
    const timer = setTimeout(() => onDivideComplete(), 700);
    return () => clearTimeout(timer);
  }, [dividing, onDivideComplete]);

  // The gooey filter stays active while the card is tethered (review
  // state) or dividing (rejection). It's removed only once the card has
  // fully settled and no transition is in flight.
  const gooeyActive = (mounted && !emerged) || dividing;

  // Scroll-pull: as the practitioner scrolls past the fold, the card
  // drifts slightly toward the orb center (upward + inward), stretching
  // the tether. Subtle — 6px max at full scroll.
  const pull = scrollProgress * 6;

  return (
    <GooeyEmergence
      active={gooeyActive}
      blur={10}
      contrast={18}
      settleMs={dividing ? 800 : 400}
      className="relative"
    >
      <div className="flex justify-center mb-[-20px] relative z-10">
        <GooeySource size={40} color="var(--accent)" className="opacity-60" />
      </div>
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{
          scale: dividing ? 0.7 : 1,
          opacity: dividing ? 0 : 1,
          y: dividing ? -30 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: dividing ? 60 : 80,
          damping: dividing ? 12 : 18,
          mass: 1.2,
          delay: dividing ? 0 : 0.1,
        }}
        style={{
          transform: `translateY(-${pull}px)`,
          transition: "transform 400ms ease-out",
        }}
      >
        <RetreatCard recommendation={recommendation} aestheticVector={aestheticVector} />
      </motion.div>
    </GooeyEmergence>
  );
}

// The retreat card — vision image + title, location, price, capacity.
// The image is resolved deterministically from the aesthetic vector via
// the same resolveRetreatVision infrastructure that powers the booked
// landing. The image emerges over the orb's field then settles into the
// dark-glass card — the signature "arriving" beat from the design target.
function RetreatCard({
  recommendation,
  aestheticVector,
}: {
  recommendation: MatchResult;
  aestheticVector: AestheticVector | null;
}) {
  const vision = useMemo(
    () => resolveRetreatVision({ vector: aestheticVector }),
    [aestheticVector],
  );

  return (
    <div>
      <p className="tag mb-3">one current recommendation</p>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-sm border border-[rgba(246,239,227,0.14)]">
        <Image
          src={vision.imageUrl}
          alt={vision.alt}
          fill
          className="object-cover vision-ken-burns"
          sizes="(max-width: 768px) 100vw, 640px"
        />
        <div
          className="absolute inset-0 pointer-events-none vision-grade"
          style={
            {
              "--vision-warmth": vision.grade.warmth,
              "--vision-dark": vision.grade.darkness,
              "--vision-calm": vision.grade.calm,
            } as CSSProperties
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(30,18,12,0.62)] via-[rgba(30,18,12,0.12)] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <h3 className="font-serif text-2xl sm:text-3xl tracking-tight text-[#f6efe3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            {recommendation.retreatTitle}
          </h3>
          <p className="text-sm text-[#f6efe3]/80 mt-1">
            {recommendation.retreatLocation} · {recommendation.durationDays} days · {formatUsd(recommendation.priceUsd)} · cohort of {recommendation.capacity}
          </p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="text-sm text-[color:var(--muted)] cursor-pointer hover:text-foreground transition-colors">
          About this retreat
        </summary>
        <p className="mt-3 leading-relaxed text-sm">
          {recommendation.retreatDescription}
        </p>
      </details>
    </div>
  );
}

// The voice-lane feedback disclosure — free-text + categorical fallback.
// Collapsed by default so it doesn't compete with the primary decision.
function FeedbackDisclosure({
  voiceInput,
  voiceResponse,
  busy,
  onVoiceInputChange,
  onSubmitVoice,
  onCategorical,
}: {
  voiceInput: string;
  voiceResponse: string | null;
  busy: boolean;
  onVoiceInputChange: (value: string) => void;
  onSubmitVoice: () => void;
  onCategorical: (reason: "timing" | "budget" | "group" | "place" | "intention") => void;
}) {
  return (
    <details className="pt-2">
      <summary className="tag cursor-pointer">
        this doesn&apos;t feel right
      </summary>
      <fieldset className="border-t border-[color:var(--hairline)] pt-4 mt-2">
        <legend className="tag mb-3">tell Mira what feels off</legend>
        <div className="space-y-3">
          <textarea
            value={voiceInput}
            onChange={(e) => onVoiceInputChange(e.target.value)}
            placeholder="I don't want somewhere remote…"
            rows={2}
            className="w-full px-4 py-3 rounded-sm border border-[color:var(--hairline)] bg-transparent text-sm resize-none focus:outline-none focus:border-[color:var(--accent)]"
            disabled={busy}
          />
          {voiceResponse && (
            <p className="text-sm italic text-[color:var(--accent-ink)]">
              {voiceResponse}
            </p>
          )}
          <button
            type="button"
            disabled={busy || !voiceInput.trim()}
            onClick={onSubmitVoice}
            className="text-sm text-[color:var(--muted)] hover:text-foreground disabled:opacity-40"
          >
            {busy ? "Sitting with that…" : "Tell Mira →"}
          </button>
        </div>
        <details className="mt-4 pt-3 border-t border-[color:var(--hairline)]">
          <summary className="text-xs text-[color:var(--muted)] cursor-pointer">
            or pick a category
          </summary>
          <div className="flex flex-wrap gap-2 mt-3">
            {(["timing", "budget", "group", "place", "intention"] as const).map(
              (reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={busy}
                  onClick={() => onCategorical(reason)}
                  className="px-3 py-2 rounded-sm border border-[color:var(--hairline)] text-sm capitalize"
                >
                  {reason}
                </button>
              ),
            )}
          </div>
        </details>
      </fieldset>
    </details>
  );
}
