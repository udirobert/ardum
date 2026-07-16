"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { preloadMiraScene } from "./MiraOrb";
import { useMiraField } from "./MiraField";
import { type MiraPresence } from "@/agent/mira-presence";
import {
  hasCompletedAestheticCalibration,
  readAestheticVector,
} from "@/aesthetics/aesthetic-store";
import type { AestheticVector } from "@/aesthetics/image-pool";
import { DUSK_PANEL as PANEL } from "@/aesthetics/dusk-theme";
import type { Episode } from "@/episodes/model";
import StaggerReveal from "@/components/StaggerReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const AestheticCalibration = dynamic(
  () => import("@/aesthetics/AestheticCalibration"),
  { ssr: false },
);

// Warm the hero scene chunk the moment the arrival bundle evaluates —
// Mira should never be the last thing to show up on her own screen.
preloadMiraScene();

type Phase = "loading" | "aesthetic" | "returning" | "intention";

type Props = {
  greeting?: string | null;
};

// Guarantees the hero copy reads even over the orb's brightest pixels.
const HERO_SHADOW = {
  textShadow: "0 2px 26px rgba(9,5,3,0.6), 0 1px 3px rgba(9,5,3,0.55)",
};

const MUTED_COPY = {
  color: "rgba(246,239,227,0.74)",
  textShadow: "0 1px 10px rgba(9,5,3,0.5)",
};

export default function ArrivalScreen({ greeting }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("loading");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [statement, setStatement] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePresence, setActivePresence] = useState<MiraPresence | null>(
    null,
  );
  const [aestheticVector, setAestheticVector] = useState<AestheticVector>(
    () => readAestheticVector(),
  );

  useEffect(() => {
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
  }, []);

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
        // Kinetic beat: Mira gathers the words of the intention before the
        // route changes beneath her persistent field.
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

  useMiraField({
    presence: activePresence,
    activity: committing ? "arriving" : submitting ? "processing" : "idle",
    aestheticVector,
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
        {/* Loading / kinetic commit — a single centered beat over the orb. */}
        {centered && (
          <div className="dusk relative z-10 flex-1 flex items-center justify-center px-6 text-center">
            {phase === "loading" && (
              <div>
                {/* The greeting arrives with the server HTML — it must be
                    present from first paint, not after hydration. */}
                {greetingNode}
                <p
                  className="font-serif text-3xl sm:text-4xl tracking-tight"
                  aria-live="polite"
                  style={HERO_SHADOW}
                >
                  Let me find where we left things…
                </p>
              </div>
            )}
            {committing && (
              <div className="max-w-2xl" aria-live="polite" style={{ color: "#f6efe3" }}>
                <p
                  className="font-serif text-3xl sm:text-5xl leading-snug tracking-tight"
                  style={HERO_SHADOW}
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
                        {word}
                        {" "}
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

        {/* Intention & returning — question above the orb, action below it. */}
        {!centered && phase !== "aesthetic" && (
          <div className="dusk relative z-10 flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full px-6 sm:px-10 py-14 text-center">
            {phase === "intention" && (
              <>
                <div>
                  {greetingNode}
                  <StaggerReveal>
                    <p className="tag mb-4 t-stagger-line">Mira</p>
                    <h1
                      className="font-serif text-4xl sm:text-6xl leading-[1.04] tracking-tight t-stagger-line t-stagger-line--2"
                      style={HERO_SHADOW}
                    >
                      What are you trying to make space for?
                    </h1>
                  </StaggerReveal>
                </div>
                <div>
                  <div
                    className="max-w-xl mx-auto rounded-xl border backdrop-blur-md px-5 py-6 sm:px-8"
                    style={PANEL}
                  >
                    <StaggerReveal>
                      <p
                        className="mb-4 leading-relaxed t-stagger-line"
                        style={{ color: "rgba(246,239,227,0.78)" }}
                      >
                        You do not need a destination or dates yet. Begin with
                        what you want life to feel like on the other side.
                      </p>
                      <p className="why mb-5 t-stagger-line t-stagger-line--2">
                        Pressing <em>Tell Mira what matters</em> records this
                        intention and remembers it across visits. You can refine,
                        export, or delete it at any time.
                      </p>
                      <label className="block text-left t-stagger-line t-stagger-line--2">
                        <span className="sr-only">Your intention</span>
                        <textarea
                          value={statement}
                          onChange={(event) => setStatement(event.target.value)}
                          rows={3}
                          maxLength={800}
                          placeholder="I need to feel like myself again after this launch…"
                          className="w-full rounded-sm border p-4 text-lg leading-relaxed resize-none"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            borderColor: "rgba(246,239,227,0.22)",
                            color: "#f6efe3",
                          }}
                        />
                      </label>
                      <label
                        className="mt-4 flex items-start gap-3 text-left text-sm t-stagger-line t-stagger-line--2"
                        style={{ color: "rgba(246,239,227,0.72)" }}
                      >
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          Keep this intention on this device so I can resume it
                          with you. You can inspect or delete it at any time.
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
                        className="mt-6 w-full px-8 py-3.5 rounded-sm disabled:opacity-40 t-stagger-line t-stagger-line--2"
                        style={{ background: "#f6efe3", color: "#1a120d" }}
                      >
                        {submitting
                          ? "Giving it shape…"
                          : "Tell Mira what matters →"}
                      </button>
                    </StaggerReveal>
                  </div>
                </div>
              </>
            )}

            {phase === "returning" && episode && current && (
              <>
                <div>
                  {greetingNode}
                  <StaggerReveal>
                    <p className="tag mb-4 t-stagger-line">your active intention</p>
                    <h1
                      className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight t-stagger-line t-stagger-line--2"
                      style={HERO_SHADOW}
                    >
                      {current.statement}
                    </h1>
                  </StaggerReveal>
                </div>
                <div>
                  <StaggerReveal>
                    <p
                      className="max-w-lg mx-auto mb-8 leading-relaxed t-stagger-line"
                      style={MUTED_COPY}
                    >
                      I kept this alive. We can continue from the next unresolved
                      decision, or change what matters now.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 t-stagger-line t-stagger-line--2">
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
                </div>
              </>
            )}
          </div>
        )}

        {/* Aesthetic calibration — Mira asks about taste from inside her own
            field; each reaction ripples the orb and retunes its palette. */}
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
