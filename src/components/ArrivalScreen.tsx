"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMiraField } from "./MiraField";
import { useMiraImpulse } from "./MiraImpulse";
import { preloadMiraScene } from "./MiraOrb";
import { type MiraActivity, type MiraPresence } from "@/agent/mira-presence";
import {
  hasCompletedAestheticCalibration,
  hasSkippedAestheticCalibration,
  readAestheticVector,
} from "@/aesthetics/aesthetic-store";
import type { AestheticVector } from "@/aesthetics/image-pool";
import { DUSK_MUTED, DUSK_HEADING } from "@/aesthetics/dusk-theme";
import type { Episode } from "@/episodes/model";
import StaggerReveal from "@/components/StaggerReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { providerFailureLine } from "@/agent/mira-voice";

const AestheticCalibration = dynamic(
  () => import("@/aesthetics/AestheticCalibration"),
  { ssr: false },
);

// Warm the hero scene chunk as soon as the arrival bundle evaluates — the
// shell field is this page's atmosphere.
preloadMiraScene();

type Phase = "loading" | "aesthetic" | "returning" | "intention";

type Props = {
  greeting?: string | null;
  preferredName?: string | null;
  /** When set, arrival skips the client episode list fetch. */
  episodeBootstrap?: {
    episode: Episode | null;
    presence: MiraPresence | null;
  };
};

function resolveInitialPhase(
  active: Episode | null | undefined,
): Phase {
  if (active) return "returning";
  // No active episode: we cannot decide between "aesthetic" and
  // "intention" during the shared server/client render because that
  // depends on localStorage. Start at "loading" and let the client
  // derive the real entry phase from the calibration flag (see
  // effectivePhase below) — this keeps the first paint identical on
  // server and client and avoids a hydration mismatch.
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
    bootstrapped
      ? resolveInitialPhase(episodeBootstrap.episode)
      : "loading",
  );
  const [episode, setEpisode] = useState<Episode | null>(
    episodeBootstrap?.episode ?? null,
  );
  const [statement, setStatement] = useState("");
  // Persistence is on by default — the anonymous actor cookie is set
  // server-side on the first ownership-bearing request (ADR 0004), and
  // the episode requires persistenceConsent to be created (service.ts).
  // The transparency note below communicates this; the person can inspect
  // or delete on /memory. No checkbox: false control that doesn't gate
  // the submit is worse than transparent default-on.
  const [consent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const { fire } = useMiraImpulse();
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [activePresence, setActivePresence] = useState<MiraPresence | null>(
    episodeBootstrap?.presence ?? null,
  );
  const [aestheticVector, setAestheticVector] = useState<AestheticVector>(
    () => readAestheticVector(),
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Calibration completion lives in localStorage (client-only). Read it
  // through useSyncExternalStore with a server snapshot of `false` so the
  // first render matches the server exactly — no hydration mismatch and no
  // synchronous setState inside an effect. After mount React re-renders with
  // the true client value, which drives effectivePhase below.
  const calibrationDone = useSyncExternalStore(
    () => () => {},
    () =>
      hasCompletedAestheticCalibration() || hasSkippedAestheticCalibration(),
    () => false,
  );

  // The aesthetic calibration can be disabled via env flag. When disabled,
  // new visitors skip straight to the intention input. Default: disabled —
  // the intention ask is the first interaction, not image reactions.
  const calibrationEnabled =
    process.env.NEXT_PUBLIC_AESTHETIC_CALIBRATION_ENABLED === "true";

  // The phase the UI actually renders. When bootstrapped with no active
  // episode, the shared render lands on "loading"; the client derives the
  // real entry phase from the calibration flag without touching setState.
  const effectivePhase: Phase =
    bootstrapped && phase === "loading"
      ? calibrationDone || !calibrationEnabled
        ? "intention"
        : "aesthetic"
      : phase;

  // Arrival contract: input focusable without waiting on stagger/orb.
  useEffect(() => {
    if (effectivePhase !== "intention" || committing) return;
    const el = inputRef.current;
    if (!el) return;
    // Defer one frame so layout is ready; still within first-session window.
    const id = window.requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
    // arrival-autofocus
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
          setActivePresence(data.activeMiraPresence ?? null);
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
      // The intention now exists — the orb answers with its strongest pulse
      // while the arrival animation holds.
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

  const fieldVeil =
    effectivePhase === "aesthetic"
      ? 0.12
      : centered
        ? 0.18
        : inputFocused
          ? 0.38
          : effectivePhase === "intention"
            ? 0.3
            : 0.24;

  useMiraField({
    presence: activePresence,
    activity: fieldActivity,
    aestheticVector,
    veil: fieldVeil,
  });

  const greetingNode = greeting ? (
    <p
      className="tag italic mb-3"
      aria-live="polite"
      data-testid="returning-greeting"
    >
      {greeting}
    </p>
  ) : null;

  return (
    <section className="relative flex flex-col min-h-[calc(100svh-56px)] overflow-hidden">
      {centered && (
        <div className="dusk relative z-10 flex-1 flex items-center justify-center px-6 text-center">
          {effectivePhase === "loading" && (
            <div>
              {greetingNode}
              <p
                className="font-serif text-3xl sm:text-4xl tracking-tight"
                aria-live="polite"
                style={DUSK_HEADING}
              >
                Mira
              </p>
            </div>
          )}
          {committing && (
            <div className="max-w-2xl" aria-live="polite" style={{ color: "#f6efe3" }}>
              <p
                className="font-serif text-3xl sm:text-5xl leading-snug tracking-tight"
                style={DUSK_HEADING}
              >
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
              <span className="sr-only">
                Intention recorded. Opening your episode.
              </span>
            </div>
          )}
        </div>
      )}

      {!centered && effectivePhase !== "aesthetic" && (
        <div className="dusk relative z-10 flex-1 flex flex-col max-w-xl mx-auto w-full px-6 sm:px-10">
          {/* Voice lane — Mira's line sits in the orb's lower third, not a top headline. */}
          <div className="flex-1 flex flex-col justify-end pb-6 sm:pb-10 text-center min-h-[38vh]">
            {effectivePhase === "intention" && (
              <StaggerReveal eager>
                {greetingNode}
                <p className="tag mb-3 t-stagger-line">Mira</p>
                <h1
                  className="font-serif text-3xl sm:text-5xl leading-[1.08] tracking-tight t-stagger-line t-stagger-line--2"
                  style={DUSK_HEADING}
                >
                  {preferredName
                    ? `What are you trying to make space for, ${preferredName}?`
                    : "What are you trying to make space for?"}
                </h1>
                <p
                  className="mt-4 text-base sm:text-lg leading-relaxed max-w-md mx-auto t-stagger-line t-stagger-line--2"
                  style={DUSK_MUTED}
                >
                  No destination or dates yet — tell me what you want life to
                  feel like on the other side, and I&apos;ll help you get there.
                </p>
              </StaggerReveal>
            )}

            {effectivePhase === "returning" && episode && current && (
              <StaggerReveal eager>
                {greetingNode}
                <p className="tag mb-3 t-stagger-line">your active intention</p>
                {(() => {
                  // Short intentions (1-3 words) look sparse at the
                  // full 5xl scale designed for sentence-length
                  // statements. Scale the heading down so a single
                  // word doesn't dominate the screen awkwardly.
                  const wordCount = current.statement.trim().split(/\s+/).length;
                  const sizeClass =
                    wordCount <= 2
                      ? "text-2xl sm:text-3xl"
                      : wordCount <= 5
                        ? "text-3xl sm:text-4xl"
                        : "text-3xl sm:text-5xl";
                  return (
                    <h1
                      className={`font-serif ${sizeClass} leading-tight tracking-tight t-stagger-line t-stagger-line--2`}
                      style={DUSK_HEADING}
                    >
                      {current.statement}
                    </h1>
                  );
                })()}
                <p
                  className="mt-4 text-base sm:text-lg leading-relaxed max-w-md mx-auto t-stagger-line t-stagger-line--2"
                  style={DUSK_MUTED}
                >
                  {preferredName
                    ? `I kept this alive for you, ${preferredName}. We can pick up where we left off, or change what matters now.`
                    : "I kept this alive. We can pick up where we left off, or change what matters now."}
                </p>
              </StaggerReveal>
            )}
          </div>

          {/* Input lane — quiet ground; no panel chrome competing with the field. */}
          <div className="pb-12 sm:pb-14 pt-2">
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
                    className="w-full bg-transparent border-0 border-b py-4 text-xl sm:text-2xl font-serif leading-relaxed tracking-tight resize-none placeholder:opacity-40 focus:outline-none focus:ring-0"
                    style={{
                      borderColor: "rgba(246,239,227,0.28)",
                      color: "#f6efe3",
                    }}
                  />
                </label>
                <p
                  className="mt-5 text-left text-sm t-stagger-line t-stagger-line--2"
                  style={DUSK_MUTED}
                >
                  I&apos;ll keep this so we can resume. Inspect or delete anytime
                  in{" "}
                  <Link href="/memory" className="underline hover:opacity-100">
                    your intention &amp; privacy
                  </Link>
                  .
                </p>
                {error && (
                  <p
                    className="mt-4 text-sm"
                    role="alert"
                    style={{ color: "#f0a88a" }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={create}
                  disabled={!statement.trim() || submitting}
                  className="mt-8 w-full px-8 py-3.5 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed t-stagger-line t-stagger-line--2"
                  style={{ background: "#f6efe3", color: "#1a120d" }}
                >
                  {submitting ? "Giving it shape…" : "Tell Mira what matters →"}
                </button>
              </StaggerReveal>
            )}

            {effectivePhase === "returning" && episode && (
              <StaggerReveal eager>
                <div className="flex flex-col items-center gap-4 t-stagger-line">
                  <button
                    type="button"
                    onClick={() => {
                      fire("lean");
                      router.push(`/episode/${episode.id}`);
                    }}
                    className="w-full max-w-sm px-7 py-3 rounded-sm"
                    style={{ background: "#f6efe3", color: "#1a120d" }}
                  >
                    Continue →
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("intention")}
                    className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
                    style={{ color: "rgba(246,239,227,0.6)" }}
                  >
                    or start a different intention
                  </button>
                </div>
              </StaggerReveal>
            )}
          </div>
        </div>
      )}

      {effectivePhase === "aesthetic" && (
        <div className="dusk relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 sm:px-10 py-10 text-center overflow-y-auto">
          <AestheticCalibration
            onVector={setAestheticVector}
            onComplete={(pref) => {
              setAestheticVector(pref.vector);
              setPhase("intention");
            }}
          />
        </div>
      )}
    </section>
  );
}
