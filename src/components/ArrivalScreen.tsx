"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMiraField } from "./MiraField";
import { type MiraActivity, type MiraPresence } from "@/agent/mira-presence";
import {
  hasCompletedAestheticCalibration,
  readAestheticVector,
} from "@/aesthetics/aesthetic-store";
import type { AestheticVector } from "@/aesthetics/image-pool";
import { DUSK_MUTED, DUSK_HEADING } from "@/aesthetics/dusk-theme";
import type { Episode } from "@/episodes/model";
import StaggerReveal from "@/components/StaggerReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const AestheticCalibration = dynamic(
  () => import("@/aesthetics/AestheticCalibration"),
  { ssr: false },
);

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
): Exclude<Phase, "loading"> {
  if (active) return "returning";
  if (hasCompletedAestheticCalibration()) return "intention";
  return "aesthetic";
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
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [activePresence, setActivePresence] = useState<MiraPresence | null>(
    episodeBootstrap?.presence ?? null,
  );
  const [aestheticVector, setAestheticVector] = useState<AestheticVector>(
    () => readAestheticVector(),
  );

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
          } else if (hasCompletedAestheticCalibration()) {
            setPhase("intention");
          } else {
            setPhase("aesthetic");
          }
        },
      )
      .catch(() => setPhase("intention"))
      .finally(() => {});
  }, [bootstrapped]);

  async function create() {
    if (!statement.trim() || !consent) return;
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
        throw new Error(data.error ?? "Could not save this intention.");
      }
      if (!reduced) {
        setCommitting(true);
        await new Promise((resolve) => setTimeout(resolve, 1150));
      }
      router.push(`/episode/${data.episode.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
      setSubmitting(false);
      setCommitting(false);
    }
  }

  const current = episode?.intentions.at(-1);
  const centered = phase === "loading" || committing;

  const fieldActivity: MiraActivity = committing
    ? "arriving"
    : submitting
      ? "processing"
      : inputFocused
        ? "listening"
        : phase === "intention" || phase === "returning"
          ? "speaking"
          : "idle";

  const fieldVeil =
    phase === "aesthetic"
      ? 0.12
      : centered
        ? 0.18
        : inputFocused
          ? 0.38
          : phase === "intention"
            ? 0.3
            : 0.24;

  useMiraField({
    presence: activePresence,
    activity: fieldActivity,
    aestheticVector,
    veil: fieldVeil,
    fieldTier: "ambient",
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
          {phase === "loading" && (
            <div>
              {greetingNode}
              <p
                className="font-serif text-3xl sm:text-4xl tracking-tight"
                aria-live="polite"
                style={DUSK_HEADING}
              >
                Let me recall where we left things…
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

      {!centered && phase !== "aesthetic" && (
        <div className="dusk relative z-10 flex-1 flex flex-col max-w-xl mx-auto w-full px-6 sm:px-10">
          {/* Voice lane — Mira's line sits in the orb's lower third, not a top headline. */}
          <div className="flex-1 flex flex-col justify-end pb-6 sm:pb-10 text-center min-h-[38vh]">
            {phase === "intention" && (
              <StaggerReveal>
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
                  No destination or dates yet — just what you want life to feel
                  like on the other side.
                </p>
              </StaggerReveal>
            )}

            {phase === "returning" && episode && current && (
              <StaggerReveal>
                {greetingNode}
                <p className="tag mb-3 t-stagger-line">your active intention</p>
                <h1
                  className="font-serif text-3xl sm:text-5xl leading-tight tracking-tight t-stagger-line t-stagger-line--2"
                  style={DUSK_HEADING}
                >
                  {current.statement}
                </h1>
                <p
                  className="mt-4 text-base sm:text-lg leading-relaxed max-w-md mx-auto t-stagger-line t-stagger-line--2"
                  style={DUSK_MUTED}
                >
                  {preferredName
                    ? `I kept this alive for you, ${preferredName}. We can continue from the next decision, or change what matters now.`
                    : "I kept this alive. We can continue from the next decision, or change what matters now."}
                </p>
              </StaggerReveal>
            )}
          </div>

          {/* Input lane — quiet ground; no panel chrome competing with the field. */}
          <div className="pb-12 sm:pb-14 pt-2">
            {phase === "intention" && (
              <StaggerReveal>
                <label className="block text-left t-stagger-line">
                  <span className="sr-only">Your intention</span>
                  <textarea
                    value={statement}
                    onChange={(event) => setStatement(event.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    rows={2}
                    maxLength={800}
                    placeholder="I need to feel like myself again after this launch…"
                    className="w-full bg-transparent border-0 border-b py-4 text-xl sm:text-2xl font-serif leading-relaxed tracking-tight resize-none placeholder:opacity-40 focus:outline-none focus:ring-0"
                    style={{
                      borderColor: "rgba(246,239,227,0.28)",
                      color: "#f6efe3",
                    }}
                  />
                </label>
                <label
                  className="mt-5 flex items-start gap-3 text-left text-sm t-stagger-line t-stagger-line--2"
                  style={DUSK_MUTED}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Keep this intention on this device so I can resume with you.
                    You can inspect or delete it anytime.
                  </span>
                </label>
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
                  disabled={!statement.trim() || !consent || submitting}
                  className="mt-8 w-full px-8 py-3.5 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed t-stagger-line t-stagger-line--2"
                  style={{ background: "#f6efe3", color: "#1a120d" }}
                >
                  {submitting ? "Giving it shape…" : "Tell Mira what matters →"}
                </button>
                {!submitting && statement.trim() && !consent && (
                  <p
                    className="mt-2 text-xs text-center"
                    style={{ color: "rgba(246,239,227,0.5)" }}
                  >
                    Tick the box above to continue
                  </p>
                )}
              </StaggerReveal>
            )}

            {phase === "returning" && episode && (
              <StaggerReveal>
                <div className="flex flex-wrap justify-center gap-3 t-stagger-line">
                  <button
                    type="button"
                    onClick={() => router.push(`/episode/${episode.id}`)}
                    className="px-7 py-3 rounded-sm"
                    style={{ background: "#f6efe3", color: "#1a120d" }}
                  >
                    Continue →
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("intention")}
                    className="px-7 py-3 rounded-sm border"
                    style={{
                      borderColor: "rgba(246,239,227,0.3)",
                      color: "#f6efe3",
                    }}
                  >
                    Start a different intention
                  </button>
                </div>
              </StaggerReveal>
            )}
          </div>
        </div>
      )}

      {phase === "aesthetic" && (
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
