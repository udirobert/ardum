"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMiraImpulse } from "./MiraImpulse";
import MiraOrb from "./MiraOrb";

import { type MiraActivity, type MiraPresence, STEADY_PRESENCE } from "@/agent/mira-presence";
import {
  hasCompletedAestheticCalibration,
  hasSkippedAestheticCalibration,
  readAestheticVector,
} from "@/aesthetics/aesthetic-store";
import type { AestheticVector } from "@/aesthetics/image-pool";
import { EDITORIAL_EYEBROW, EDITORIAL_MUTED } from "@/aesthetics/dusk-theme";
import type { Episode } from "@/episodes/model";
import StaggerReveal from "@/components/StaggerReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatDateTime } from "@/lib/format";
import { providerFailureLine } from "@/agent/mira-voice";

const AestheticCalibration = dynamic(
  () => import("@/aesthetics/AestheticCalibration"),
  { ssr: false },
);

type Phase = "loading" | "aesthetic" | "returning" | "intention";

type Props = {
  greeting?: string | null;
  preferredName?: string | null;
  episodeBootstrap?: {
    episode: Episode | null;
    presence: MiraPresence | null;
  };
};

function resolveInitialPhase(active: Episode | null | undefined): Phase {
  if (active) return "returning";
  return "loading";
}

export default function ArrivalScreen({
  greeting,
  preferredName,
  episodeBootstrap,
}: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const bootstrapped = episodeBootstrap !== undefined;
  const [phase, setPhase] = useState<Phase>(
    bootstrapped ? resolveInitialPhase(episodeBootstrap.episode) : "loading",
  );
  const [episode, setEpisode] = useState<Episode | null>(
    episodeBootstrap?.episode ?? null,
  );
  const [statement, setStatement] = useState("");
  const [consent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const { fire } = useMiraImpulse();
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [activePresence] = useState<MiraPresence | null>(
    episodeBootstrap?.presence ?? null,
  );
  const [aestheticVector, setAestheticVector] = useState<AestheticVector>(
    () => readAestheticVector(),
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const calibrationDone = useSyncExternalStore(
    () => () => {},
    () =>
      hasCompletedAestheticCalibration() || hasSkippedAestheticCalibration(),
    () => false,
  );

  const calibrationEnabled =
    process.env.NEXT_PUBLIC_AESTHETIC_CALIBRATION_ENABLED === "true";

  const effectivePhase: Phase =
    bootstrapped && phase === "loading"
      ? calibrationDone || !calibrationEnabled
        ? "intention"
        : "aesthetic"
      : phase;

  useEffect(() => {
    if (effectivePhase !== "intention" || committing) return;
    const el = inputRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [effectivePhase, committing]);

  useEffect(() => {
    if (bootstrapped) return;
    fetch("/api/episodes")
      .then((response) => response.json())
      .then(
        (data: {
          episodes?: Episode[];
          activeMiraPresence?: MiraPresence | null;
        }) => {
          const active = data.episodes?.find(
            (item) => !["completed"].includes(item.status),
          );
          setEpisode(active ?? null);
          if (active) {
            setPhase("returning");
          } else if (
            hasCompletedAestheticCalibration() ||
            hasSkippedAestheticCalibration() ||
            !calibrationEnabled
          ) {
            setPhase("intention");
          } else {
            setPhase("aesthetic");
          }
        },
      )
      .catch(() => setPhase("intention"))
      .finally(() => {});
  }, [bootstrapped, calibrationEnabled]);

  async function create() {
    if (!statement.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          statement,
          persistenceConsent: consent,
        }),
      });
      const data = (await response.json()) as {
        episode?: Episode;
        error?: string;
      };
      if (!response.ok || !data.episode) {
        throw new Error(providerFailureLine("Saving your intention"));
      }
      fire("commit");
      if (!reduced) {
        setCommitting(true);
        await new Promise((resolve) => setTimeout(resolve, 1150));
      }
      router.push(`/episode/${data.episode.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : providerFailureLine("Saving your intention"),
      );
      setSubmitting(false);
      setCommitting(false);
    }
  }

  const current = episode?.intentions.at(-1);
  const centered = effectivePhase === "loading" || committing;

  const fieldActivity: MiraActivity = committing
    ? "arriving"
    : submitting
      ? "processing"
      : inputFocused
        ? "listening"
        : effectivePhase === "intention" || effectivePhase === "returning"
          ? "speaking"
          : "idle";

  const greetingNode = greeting ? (
    <p
      className="text-sm italic mb-4 leading-relaxed"
      aria-live="polite"
      data-testid="returning-greeting"
      style={EDITORIAL_MUTED}
    >
      {greeting}
    </p>
  ) : null;

  // Committing beat — centered parchment, words gather toward Mira
  if (committing) {
    return (
      <section className="editorial min-h-[calc(100svh-56px)] flex items-center justify-center px-6 text-center">
        <div className="max-w-2xl" aria-live="polite">
          <p className="font-serif text-3xl sm:text-5xl leading-snug tracking-tight">
            {statement
              .trim()
              .split(/\s+/)
              .map((word, i) => (
                <span
                  key={i}
                  className="word-gather"
                  style={{ animationDelay: `${Math.min(i * 45, 600)}ms` }}
                >
                  {word}{" "}
                </span>
              ))}
          </p>
          <span className="sr-only">Intention recorded. Opening your episode.</span>
        </div>
      </section>
    );
  }

  if (centered) {
    return (
      <section className="editorial min-h-[calc(100svh-56px)] flex items-center justify-center px-6 text-center">
        <div>
          {greetingNode}
          <p
            className="font-serif text-3xl sm:text-4xl tracking-tight"
            aria-live="polite"
          >
            Mira
          </p>
          <p className="mt-3 text-sm" style={EDITORIAL_MUTED}>
            giving your intention shape…
          </p>
        </div>
      </section>
    );
  }

  if (effectivePhase === "aesthetic") {
    return (
      <section className="editorial min-h-[calc(100svh-56px)] flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 sm:px-10 py-10 text-center">
        <AestheticCalibration
          onVector={setAestheticVector}
          onComplete={(pref) => {
            setAestheticVector(pref.vector);
            setPhase("intention");
          }}
        />
      </section>
    );
  }

  // Editorial refuge — asymmetric: type on the left, Mira anchored as
  // illustration on the right. One quiet rule, generous whitespace,
  // parchment ground. Mira is an anchor, not a full-bleed void.
  const orbPresence = activePresence ?? STEADY_PRESENCE;

  return (
    <section className="editorial min-h-[calc(100svh-56px)]">
      {/* Top rule — the refuge is a printed page */}
      <div className="mx-auto max-w-[72rem] px-6 sm:px-10 lg:px-12">
        <div className="h-px w-full bg-[color:var(--rule)]" aria-hidden />
      </div>

      <div className="mx-auto max-w-[72rem] px-6 sm:px-10 lg:px-12 py-10 sm:py-14 lg:py-16">
        <div className="grid lg:grid-cols-[1.2fr_0.85fr] gap-10 lg:gap-12 items-start">
          {/* ── Left: the ask ── */}
          <div className="min-w-0">
            <StaggerReveal eager>
              <div className="max-w-[36rem]">
                {effectivePhase === "intention" && (
                  <>
                    {greetingNode}
                    <p className="t-stagger-line" style={EDITORIAL_EYEBROW}>
                      Mira — your persistent guide
                    </p>
                    <h1
                      className="font-serif text-[2.05rem] sm:text-[2.9rem] lg:text-[3.25rem] leading-[1.02] tracking-tight t-stagger-line t-stagger-line--2"
                    >
                      {preferredName
                        ? `What are you trying to make space for, ${preferredName}?`
                        : "What are you trying to make space for?"}
                    </h1>
                    <p
                      className="mt-5 text-[1.05rem] sm:text-lg leading-relaxed t-stagger-line t-stagger-line--2"
                      style={EDITORIAL_MUTED}
                    >
                      Start with the feeling you&apos;re after — rest,
                      clarity, a reset. I&apos;ll find the place, hold it
                      while you decide, and handle the commitment when
                      you&apos;re ready.
                    </p>
                    <p
                      className="mt-4 text-sm t-stagger-line t-stagger-line--2"
                      style={EDITORIAL_MUTED}
                    >
                      <Link
                        href="/proof"
                        className="underline decoration-[rgba(26,23,20,0.18)] underline-offset-4 hover:decoration-[rgba(26,23,20,0.38)]"
                      >
                        How this is secured
                      </Link>
                      {" · non-binding until you say so"}
                    </p>
                  </>
                )}

                {effectivePhase === "returning" && episode && current && (
                  <>
                    {greetingNode}
                    <p className="t-stagger-line" style={EDITORIAL_EYEBROW}>
                      your active intention
                    </p>
                    {(() => {
                      const wordCount = current.statement.trim().split(/\s+/).length;
                      const sizeClass =
                        wordCount <= 2
                          ? "text-2xl sm:text-3xl"
                          : wordCount <= 5
                            ? "text-3xl sm:text-4xl"
                            : "text-[2.05rem] sm:text-[2.75rem]";
                      return (
                        <h1
                          className={`font-serif ${sizeClass} leading-tight tracking-tight t-stagger-line t-stagger-line--2`}
                        >
                          {current.statement}
                        </h1>
                      );
                    })()}
                    <p
                      className="mt-4 text-base sm:text-lg leading-relaxed t-stagger-line t-stagger-line--2"
                      style={EDITORIAL_MUTED}
                    >
                      {preferredName
                        ? `I kept this alive for you, ${preferredName}. We can pick up where we left off, or change what matters now.`
                        : "I kept this alive. We can pick up where we left off, or change what matters now."}
                    </p>
                  </>
                )}
              </div>
            </StaggerReveal>

            {/* Input / action lane — quiet ground, underline only */}
            <div className="mt-10 sm:mt-12 max-w-[36rem]">
              {effectivePhase === "intention" && (
                <StaggerReveal eager>
                  <label className="block text-left t-stagger-line">
                    <span className="sr-only">Your intention</span>
                    <textarea
                      ref={inputRef}
                      value={statement}
                      onChange={(event) => setStatement(event.target.value)}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      rows={2}
                      maxLength={800}
                      autoFocus
                      data-testid="arrival-intention-input"
                      placeholder="I need to feel like myself again after this launch…"
                      className="arrival-input w-full bg-transparent border-0 border-b py-4 text-xl sm:text-2xl font-serif leading-relaxed tracking-tight resize-none focus:outline-none focus:ring-0"
                      style={{
                        borderColor: "rgba(26,23,20,0.18)",
                        color: "#1a1714",
                      }}
                    />
                  </label>
                  <p
                    className="mt-4 text-left text-sm leading-relaxed t-stagger-line t-stagger-line--2"
                    style={EDITORIAL_MUTED}
                  >
                    I&apos;ll keep this so we can resume. Inspect or delete
                    anytime in{" "}
                    <Link
                      href="/memory"
                      className="underline decoration-[rgba(26,23,20,0.18)] underline-offset-4 hover:decoration-[rgba(26,23,20,0.32)]"
                    >
                      your intention &amp; privacy
                    </Link>
                    .
                  </p>
                  {error && (
                    <p
                      className="mt-4 text-sm"
                      role="alert"
                      style={{ color: "#8a3a20" }}
                    >
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={create}
                    disabled={!statement.trim() || submitting}
                    className="mt-8 w-full sm:w-auto px-8 py-3.5 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed t-stagger-line t-stagger-line--2 text-[15px] tracking-wide"
                    style={{ background: "#1a1714", color: "#fbf6ee" }}
                  >
                    {submitting ? "Giving it shape…" : "Tell Mira what matters →"}
                  </button>

                  {/* Mobile illustration — keep Mira visible below the fold on small screens */}
                  <div className="lg:hidden mt-10 flex flex-col items-center gap-3 t-stagger-line t-stagger-line--2">
                    <div className="w-[200px] h-[200px] rounded-full overflow-hidden border border-[color:var(--rule)] bg-[color:var(--paper-strong)] flex items-center justify-center">
                      <div className="w-full h-full">
                        <MiraOrb
                          size={200}
                          presence={orbPresence}
                          activity={fieldActivity}
                          aestheticVector={aestheticVector}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-center max-w-[22ch]" style={EDITORIAL_MUTED}>
                      Mira holds the space while you decide.
                    </p>
                  </div>
                </StaggerReveal>
              )}

              {effectivePhase === "returning" && episode && (
                <StaggerReveal eager>
                  <div className="flex flex-col items-start gap-4 t-stagger-line">
                    {episode.hold?.status === "active" && episode.hold.expiresAt && (
                      <p
                        className="text-sm leading-relaxed"
                        style={EDITORIAL_MUTED}
                        data-testid="returning-hold-status"
                      >
                        Planning hold open until{" "}
                        {formatDateTime(new Date(episode.hold.expiresAt))} — nothing
                        booked or charged.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        fire("lean");
                        router.push(`/episode/${episode.id}`);
                      }}
                      className="w-full sm:w-auto px-7 py-3 rounded-sm text-[15px]"
                      style={{ background: "#1a1714", color: "#fbf6ee" }}
                    >
                      Continue →
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhase("intention")}
                      className="text-sm underline decoration-[rgba(26,23,20,0.18)] underline-offset-4 hover:decoration-[rgba(26,23,20,0.32)] transition-colors"
                      style={EDITORIAL_MUTED}
                    >
                      or start a different intention
                    </button>
                  </div>
                </StaggerReveal>
              )}
            </div>

            {/* Proof strip — tiny, low-contrast, not a sales block */}
            <div className="mt-12 pt-6 border-t border-[color:var(--rule)] max-w-[36rem]">
              <p className="text-xs leading-relaxed" style={{ color: "rgba(26,23,20,0.42)" }}>
                No marketplace, no filters, no urgency. One intention → three questions → one held place you can release.
              </p>
            </div>
          </div>

          {/* ── Right: anchored illustration ── */}
          <div className="hidden lg:block lg:sticky lg:top-24">
            <StaggerReveal eager>
              <div className="t-stagger-line">
                <div className="relative aspect-[4/4.6] rounded-[20px] overflow-hidden border border-[color:var(--rule)] bg-[color:var(--paper-strong)] flex items-center justify-center">
                  {/* Warm inset glow so the orb reads as presence on paper */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden
                    style={{
                      background:
                        "radial-gradient(ellipse 72% 62% at 50% 42%, rgba(168,90,58,0.10) 0%, transparent 62%), radial-gradient(ellipse 90% 86% at 50% 100%, rgba(26,23,20,0.04) 0%, transparent 55%)",
                    }}
                  />
                  <div className="relative w-[78%] h-[78%] flex items-center justify-center">
                    <MiraOrb
                      size={360}
                      presence={orbPresence}
                      activity={fieldActivity}
                      aestheticVector={aestheticVector}
                    />
                  </div>
                  {/* Quiet plate label */}
                  <div className="absolute bottom-0 inset-x-0 px-5 py-4 border-t border-[color:var(--rule)] bg-[rgba(251,246,238,0.72)] backdrop-blur-[6px]">
                    <p className="text-xs leading-relaxed" style={EDITORIAL_MUTED}>
                      Mira is steady until you speak. She doesn&apos;t watch — she holds.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs" style={{ color: "rgba(26,23,20,0.42)" }}>
                  Hold on Mira for a nudge once you&apos;ve begun. No surveillance — only when you ask.
                </p>
              </div>
            </StaggerReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
