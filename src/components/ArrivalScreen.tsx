"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CloudField from "@/aesthetics/CloudField";
import MiraOrb from "./MiraOrb";
import type { Episode } from "@/episodes/model";
import type { AestheticVector } from "@/aesthetics/image-pool";

const NEUTRAL_VECTOR: AestheticVector = {
  ocean: 0.5,
  mountain: 0.5,
  jungle: 0.5,
  desert: 0.5,
  forest: 0.5,
  warm: 0.65,
  cool: 0.35,
  minimal: 0.5,
  ornate: 0.5,
  light: 0.62,
  dark: 0.38,
  calming: 0.6,
  energizing: 0.4,
  expansive: 0.55,
  intimate: 0.45,
};

type Props = {
  // Server-derived warm greeting for returning practitioners.
  // Plain string so the home-page server component can hand it down
  // without dragging the MemoryContext shape into the client.
  // Null when the practitioner is new (no useful history yet).
  greeting?: string | null;
};

export default function ArrivalScreen({ greeting }: Props) {
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [statement, setStatement] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/episodes")
      .then((response) => response.json())
      .then((data: { episodes?: Episode[] }) => {
        const active = data.episodes?.find(
          (item) => !["completed"].includes(item.status),
        );
        setEpisode(active ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
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
      router.push(`/episode/${data.episode.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
      setSubmitting(false);
    }
  }

  const current = episode?.intentions.at(-1);

  return (
    <section className="relative min-h-[calc(100svh-56px)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        <CloudField
          vector={NEUTRAL_VECTOR}
          variant="vision"
          className="h-full w-full motion-reduce:hidden"
        />
      </div>
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(246,241,231,.72), rgba(246,241,231,.35) 60%, rgba(246,241,231,.75))",
        }}
      />

      <div className="w-full max-w-2xl px-6 sm:px-10 py-16 text-center">
        {greeting && (
          <p
            className="tag italic mb-2"
            aria-live="polite"
            data-testid="returning-greeting"
          >
            {greeting}
          </p>
        )}
        <div className="flex justify-center mb-8">
          <MiraOrb size={112} state={submitting ? "thinking" : "calm"} />
        </div>

        {!loaded ? (
          <p className="font-serif text-3xl tracking-tight" aria-live="polite">
            Let me find where we left things…
          </p>
        ) : episode && current ? (
          <div className="fade-in-up">
            <p className="tag mb-4">your active intention</p>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight mb-5">
              {current.statement}
            </h1>
            <p className="text-[color:var(--muted)] mb-8 leading-relaxed">
              I kept this alive. We can continue from the next unresolved
              decision, or change what matters now.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/episode/${episode.id}`)}
                className="px-7 py-3 rounded-sm bg-foreground text-background"
              >
                Continue →
              </button>
              <button
                type="button"
                onClick={() => setEpisode(null)}
                className="px-7 py-3 rounded-sm border border-[color:var(--hairline)]"
              >
                Start a different intention
              </button>
            </div>
          </div>
        ) : (
          <div className="fade-in-up">
            <p className="tag mb-4">Mira</p>
            <h1 className="font-serif text-4xl sm:text-6xl leading-[1.05] tracking-tight mb-5">
              What are you trying to make space for?
            </h1>
            <p className="text-[color:var(--muted)] max-w-lg mx-auto mb-4 leading-relaxed">
              You do not need a destination or dates yet. Begin with what you
              want life to feel like on the other side.
            </p>
            <p className="why max-w-lg mx-auto mb-8">
              Pressing <em>Tell Mira what matters</em> records this intention
              and remembers it across visits. You can refine, export, or
              delete it at any time.
            </p>
            <label className="block text-left max-w-xl mx-auto">
              <span className="sr-only">Your intention</span>
              <textarea
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                rows={4}
                maxLength={800}
                placeholder="I need to feel like myself again after this launch…"
                className="w-full rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)] p-5 text-lg leading-relaxed resize-none"
              />
            </label>
            <label className="mt-4 max-w-xl mx-auto flex items-start gap-3 text-left text-sm text-[color:var(--muted)]">
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
              className="mt-7 px-8 py-3.5 rounded-sm bg-foreground text-background disabled:opacity-40"
            >
              {submitting ? "Giving it shape…" : "Tell Mira what matters →"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
