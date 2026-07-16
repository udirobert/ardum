"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import type { AestheticVector } from "./image-pool";
import { describePreferences, type UserPreference } from "./image-pool";
import {
  readCachedRetreatVision,
  writeCachedRetreatVision,
} from "./retreat-vision-store";
import { vectorFingerprint } from "./vector-fingerprint";
import type { RetreatVisionArtifact } from "./resolve-retreat-vision";
import StaggerReveal from "@/components/StaggerReveal";
import { CREAM, DUSK_HEADING, DUSK_MUTED } from "./dusk-theme";

type Props = {
  vector: AestheticVector;
  preference?: UserPreference;
  intention?: string;
  onContinue: () => void;
};

export default function RetreatVision({
  vector,
  preference,
  intention,
  onContinue,
}: Props) {
  const fingerprint = useMemo(
    () => vectorFingerprint(vector, intention),
    [vector, intention],
  );
  const cachedVision = useMemo(
    () =>
      typeof window !== "undefined"
        ? readCachedRetreatVision(fingerprint)
        : null,
    [fingerprint],
  );
  const [vision, setVision] = useState<RetreatVisionArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolvedVision = vision ?? cachedVision;
  const qualities = describePreferences(
    preference ?? { vector, interactions: [] },
  );

  useEffect(() => {
    if (resolvedVision) return;

    let cancelled = false;
    fetch("/api/aesthetics/vision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vector,
        intention,
        interactions: preference?.interactions,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Vision failed");
        if (!cancelled) {
          const artifact = data as RetreatVisionArtifact;
          writeCachedRetreatVision(artifact);
          setVision(artifact);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Vision unavailable.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    fingerprint,
    intention,
    preference?.interactions,
    resolvedVision,
    vector,
  ]);

  const grade = resolvedVision?.grade ?? {
    warmth: 0.5,
    darkness: 0.35,
    calm: 0.6,
  };

  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      <StaggerReveal>
        <p className="tag mb-2 t-stagger-line">your retreat vision</p>
        <h2
          className="font-serif text-3xl sm:text-5xl tracking-tight mb-4 t-stagger-line t-stagger-line--2"
          style={DUSK_HEADING}
        >
          This is the atmosphere I see forming.
        </h2>
        {qualities.length > 0 && (
          <p className="mb-8 t-stagger-line t-stagger-line--2" style={DUSK_MUTED}>
            {qualities.join(" · ")} — held in a single frame.
          </p>
        )}
      </StaggerReveal>

      <div className="relative aspect-video w-full max-h-[48svh] overflow-hidden rounded-sm border border-[rgba(246,239,227,0.18)] shadow-2xl vision-ken-burns">
        {!resolvedVision && !error && (
          <div className="absolute inset-0 vision-shimmer" />
        )}
        {error && (
          <p
            className="absolute inset-0 flex items-center justify-center text-sm px-6"
            style={DUSK_MUTED}
          >
            {error}
          </p>
        )}
        {resolvedVision && (
          <>
            <Image
              src={resolvedVision.imageUrl}
              alt={resolvedVision.alt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
            />
            <div
              className="absolute inset-0 pointer-events-none vision-grade"
              style={
                {
                  "--vision-warmth": grade.warmth,
                  "--vision-dark": grade.darkness,
                  "--vision-calm": grade.calm,
                } as CSSProperties
              }
            />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(30,18,12,0.5)] via-transparent to-transparent pointer-events-none" />
        {resolvedVision && (
          <span className="absolute top-3 right-3 tag bg-black/30 text-white/80 px-2 py-1 rounded-sm">
            curated for you
          </span>
        )}
      </div>

      {resolvedVision && (
        <p
          className="mt-6 text-sm italic max-w-xl mx-auto leading-relaxed"
          style={DUSK_MUTED}
        >
          {intention
            ? `A place that could hold "${intention.slice(0, 80)}${intention.length > 80 ? "…" : ""}".`
            : "A place that could hold what you have not named yet."}
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!resolvedVision && !error}
        className="mt-10 px-10 py-3.5 rounded-sm disabled:opacity-40"
        style={{ background: CREAM, color: "#1a120d" }}
      >
        Continue →
      </button>
    </div>
  );
}
