"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import CloudField from "@/aesthetics/CloudField";
import MiraOrb from "./MiraOrb";
import {
  STEADY_PRESENCE,
  type MiraPresence,
} from "@/agent/mira-presence";
import {
  hasCompletedAestheticCalibration,
  readAestheticVector,
} from "@/aesthetics/aesthetic-store";
import type { AestheticVector } from "@/aesthetics/image-pool";
import type { Episode } from "@/episodes/model";
import StaggerReveal from "@/components/StaggerReveal";
import { MiraImpulseProvider } from "@/components/MiraImpulse";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const AestheticCalibration = dynamic(
  () => import("@/aesthetics/AestheticCalibration"),
  { ssr: false },
);

type Phase = "loading" | "aesthetic" | "returning" | "intention";

type Props = {
  greeting?: string | null;
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
        // Kinetic beat: Mira gathers the words of the intention before
        // carrying the navigation (shared-element orb morph).
        setCommitting(true);
        await new Promise((resolve) => setTimeout(resolve, 1150));
      }
      router.push(`/episode/${data.episode.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
      setSubmitting(false);
    }
  }

  const current = episode?.intentions.at(-1);

  return (
    <MiraImpulseProvider>
    <section className="relative min-h-[calc(100svh-56px)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        <CloudField
          vector={aestheticVector}
          variant="vision"
          className="h-full w-full motion-reduce:hidden"
        />
      </div>
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(246,241,231,.55), rgba(246,241,231,.2) 60%, rgba(246,241,231,.65))",
        }}
      />

      <div className="w-full max-w-2xl px-6 sm:px-10 py-16 text-center">
        {greeting && phase !== "aesthetic" && (
          <p
            className="tag italic mb-2"
            aria-live="polite"
            data-testid="returning-greeting"
          >
            {greeting}
          </p>
        )}
        <div className="flex justify-center mb-8">
          <MiraOrb
            size={128}
            presence={activePresence ?? STEADY_PRESENCE}
            activity={committing ? "arriving" : submitting ? "processing" : "idle"}
            aestheticVector={aestheticVector}
            shared
          />
        </div>

        {phase === "loading" && (
          <p className="font-serif text-3xl tracking-tight" aria-live="polite">
            Let me find where we left things…
          </p>
        )}

        {phase === "aesthetic" && (
          <AestheticCalibration
            onComplete={(pref) => {
              setAestheticVector(pref.vector);
              setPhase("intention");
            }}
          />
        )}

        {phase === "returning" && episode && current && (
          <StaggerReveal>
            <p className="tag mb-4 t-stagger-line">your active intention</p>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight mb-5 t-stagger-line t-stagger-line--2">
              {current.statement}
            </h1>
            <p className="text-[color:var(--muted)] mb-8 leading-relaxed t-stagger-line t-stagger-line--2">
              I kept this alive. We can continue from the next unresolved
              decision, or change what matters now.
            </p>
            <div className="flex flex-wrap justify-center gap-3 t-stagger-line t-stagger-line--2">
              <button
                type="button"
                onClick={() => router.push(`/episode/${episode.id}`)}
                className="px-7 py-3 rounded-sm bg-foreground text-background"
              >
                Continue →
              </button>
              <button
                type="button"
                onClick={() => setPhase("intention")}
                className="px-7 py-3 rounded-sm border border-[color:var(--hairline)]"
              >
                Start a different intention
              </button>
            </div>
          </StaggerReveal>
        )}

        {phase === "intention" && committing && (
          <div className="max-w-xl mx-auto" aria-live="polite">
            <p className="font-serif text-3xl sm:text-4xl leading-snug tracking-tight">
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
                    {" "}
                  </span>
                ))}
            </p>
            <span className="sr-only">
              Intention recorded. Opening your episode.
            </span>
          </div>
        )}

        {phase === "intention" && !committing && (
          <StaggerReveal>
            <p className="tag mb-4 t-stagger-line">Mira</p>
            <h1 className="font-serif text-4xl sm:text-6xl leading-[1.05] tracking-tight mb-5 t-stagger-line t-stagger-line--2">
              What are you trying to make space for?
            </h1>
            <p className="text-[color:var(--muted)] max-w-lg mx-auto mb-4 leading-relaxed t-stagger-line t-stagger-line--2">
              You do not need a destination or dates yet. Begin with what you
              want life to feel like on the other side.
            </p>
            <p className="why max-w-lg mx-auto mb-8 t-stagger-line t-stagger-line--2">
              Pressing <em>Tell Mira what matters</em> records this intention
              and remembers it across visits. You can refine, export, or delete it
              at any time.
            </p>
            <label className="block text-left max-w-xl mx-auto t-stagger-line t-stagger-line--2">
              <span className="sr-only">Your intention</span>
              <textarea
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                rows={4}
                maxLength={800}
                placeholder="I need to feel like myself again after this launch…"
                className="w-full rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)]/80 backdrop-blur-sm p-5 text-lg leading-relaxed resize-none"
              />
            </label>
            <label className="mt-4 max-w-xl mx-auto flex items-start gap-3 text-left text-sm text-[color:var(--muted)] t-stagger-line t-stagger-line--2">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1"
              />
              <span>
                Keep this intention on this device so I can resume it with you.
                You can inspect or delete it at any time.
              </span>
            </label>
            {error && (
              <p className="mt-4 text-sm text-[color:var(--accent-ink)]" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={create}
              disabled={!statement.trim() || !consent || submitting}
              className="mt-7 px-8 py-3.5 rounded-sm bg-foreground text-background disabled:opacity-40 t-stagger-line t-stagger-line--2"
            >
              {submitting ? "Giving it shape…" : "Tell Mira what matters →"}
            </button>
          </StaggerReveal>
        )}
      </div>
    </section>
    </MiraImpulseProvider>
  );
}
