"use client";

// A quiet vision frame for the booked landing — the imagery of the
// place they're going to, in the palette they chose during calibration.
// Anticipation layer §3 (docs/plans/anticipation-layer.md): prospection
// research finds the simulation IS the pleasure; this feeds it. No CTA,
// no ceremony — just the frame, held.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { NEUTRAL_VECTOR, type AestheticVector } from "./image-pool";
import {
  readCachedRetreatVision,
  writeCachedRetreatVision,
} from "./retreat-vision-store";
import { vectorFingerprint } from "./vector-fingerprint";
import type { RetreatVisionArtifact } from "./resolve-retreat-vision";

type Props = {
  vector: AestheticVector | null;
  intention?: string;
};

export default function RetreatVisionFrame({ vector, intention }: Props) {
  const resolvedVector = vector ?? NEUTRAL_VECTOR;
  const fingerprint = useMemo(
    () => vectorFingerprint(resolvedVector, intention),
    [resolvedVector, intention],
  );
  const cachedVision = useMemo(
    () =>
      typeof window !== "undefined"
        ? readCachedRetreatVision(fingerprint)
        : null,
    [fingerprint],
  );
  const [vision, setVision] = useState<RetreatVisionArtifact | null>(null);
  const resolved = vision ?? cachedVision;

  useEffect(() => {
    if (resolved) return;
    let cancelled = false;
    fetch("/api/aesthetics/vision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vector: resolvedVector, intention }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("no frame");
        const artifact = (await res.json()) as RetreatVisionArtifact;
        if (!cancelled) {
          setVision(artifact);
          writeCachedRetreatVision(artifact);
        }
      })
      .catch(() => {
        /* no frame is fine — the plan carries the landing without it */
      });
    return () => {
      cancelled = true;
    };
  }, [resolved, resolvedVector, intention]);

  if (!resolved) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-[rgba(246,239,227,0.14)] vision-ken-burns">
      <Image
        src={resolved.imageUrl}
        alt={resolved.alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 640px"
      />
      <div
        className="absolute inset-0 pointer-events-none vision-grade"
        style={
          {
            "--vision-warmth": resolved.grade.warmth,
            "--vision-dark": resolved.grade.darkness,
            "--vision-calm": resolved.grade.calm,
          } as CSSProperties
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(30,18,12,0.55)] via-transparent to-transparent pointer-events-none" />
      <span className="absolute bottom-3 left-4 text-xs text-white/75">
        {intention
          ? `where "${intention.slice(0, 48)}${intention.length > 48 ? "…" : ""}" can land`
          : "the atmosphere you chose"}
      </span>
    </div>
  );
}
