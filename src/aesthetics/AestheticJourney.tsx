"use client";

// AestheticJourney — the visual + sound experience shown during the
// matching phase. Instead of a loading spinner, the user sees
// generative imagery from the curated pool and hears an ambient drone
// that shifts based on their reactions.
//
// The user taps "resonate" or "skip" on each image. Their reactions
// build a preference vector that:
//   1. Drives which images we show next
//   2. Shifts the ambient drone in real-time
//   3. Gets woven into Mira's match letter
//   4. Informs the fal.ai prompt for the generated retreat vision
//
// This is the "art" layer — the wait becomes the experience.

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import MiraOrb from "@/components/MiraOrb";
import {
  IMAGE_POOL,
  pickNextImage,
  updatePreference,
  emptyPreference,
  describePreferences,
  type PoolImage,
  type UserPreference,
} from "./image-pool";
import { AmbientDrone, vectorToDroneParams } from "./AmbientDrone";
import CloudField from "./CloudField";

type AestheticJourneyProps = {
  /** Called when the user has interacted with enough images (or all are shown) */
  onComplete: (pref: UserPreference) => void;
  /** Max images to show */
  maxImages?: number;
};

export default function AestheticJourney({
  onComplete,
  maxImages = 8,
}: AestheticJourneyProps) {
  const [pref, setPref] = useState<UserPreference>(emptyPreference());
  const [currentImage, setCurrentImage] = useState<PoolImage | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [imagePhase, setImagePhase] = useState<"entering" | "settled" | "leaving">("entering");
  const [started, setStarted] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [visionActive, setVisionActive] = useState(false);

  const droneRef = useRef<AmbientDrone | null>(null);
  const imageStartRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Start the journey — pick first image and start drone
  const start = useCallback(() => {
    setStarted(true);
    const first = pickNextImage(IMAGE_POOL, emptyPreference(), new Set());
    if (first) {
      setCurrentImage(first);
      setShownIds(new Set([first.id]));
      imageStartRef.current = performance.now();
    }

    // Start ambient drone with neutral vector
    const drone = new AmbientDrone();
    droneRef.current = drone;
    drone.start(vectorToDroneParams(emptyPreference().vector));
  }, []);

  // Pick next image when current one is dismissed
  const advance = useCallback(
    (reaction: "resonate" | "skip") => {
      if (!currentImage) return;

      const dwellMs = performance.now() - imageStartRef.current;
      const newPref = updatePreference(pref, currentImage, reaction, dwellMs);
      setPref(newPref);
      setInteractions((n) => n + 1);

      // Transition the drone to match new preferences
      droneRef.current?.transition(vectorToDroneParams(newPref.vector));

      // Animate out
      setImagePhase("leaving");

      setTimeout(() => {
        const next = pickNextImage(IMAGE_POOL, newPref, shownIds);
        if (next && interactions + 1 < maxImages) {
          setCurrentImage(next);
          setShownIds((prev) => new Set([...prev, next.id]));
          setImagePhase("entering");
          imageStartRef.current = performance.now();
        } else {
          // Learning complete — hold on a generative "vision": the clouds
          // expand to fill and settle into the atmosphere Mira read from
          // the practitioner. The drone keeps playing through the payoff.
          setCurrentImage(null);
          setVisionActive(true);
          setTimeout(() => {
            droneRef.current?.stop();
            onCompleteRef.current(newPref);
          }, 3800);
        }
      }, 600);
    },
    [currentImage, pref, shownIds, interactions, maxImages],
  );

  // Auto-advance to "settled" after enter animation
  useEffect(() => {
    if (imagePhase === "entering") {
      const t = setTimeout(() => setImagePhase("settled"), 800);
      return () => clearTimeout(t);
    }
  }, [imagePhase]);

  // Cleanup drone on unmount
  useEffect(() => {
    return () => {
      droneRef.current?.stop();
    };
  }, []);

  // Allow skip after 2 seconds of dwell
  useEffect(() => {
    if (!currentImage || imagePhase !== "settled") return;
    const t = setTimeout(() => {
      // Auto-advance as "skip" if no interaction after 8 seconds
      // (gentle nudge — don't let them stare forever)
    }, 8000);
    return () => clearTimeout(t);
  }, [currentImage, imagePhase]);

  // ── Pre-journey gate ───────────────────────────────────────────────
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center py-20 fade-in-up">
        <MiraOrb size={64} state="speaking" className="mb-8" />
        <p className="text-lg leading-relaxed text-center max-w-md mb-2 mira-line">
          While I think, let me show you something.
        </p>
        <p className="text-sm text-[color:var(--muted)] text-center max-w-md mb-8 mira-line mira-line-2">
          Images will appear. Tap the ones that resonate. Your reactions
          tell me about the kind of environment that would nourish you.
        </p>
        <button
          type="button"
          onClick={start}
          className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          Begin →
        </button>
        <p className="tag mt-4 opacity-60">
          sound on · best with headphones
        </p>
      </div>
    );
  }

  // ── Vision — the generative payoff ─────────────────────────────────
  // The reaction images gave way to the atmosphere they described. The
  // clouds fill the frame, coloured and paced by the final preference
  // vector — the same vector the drone is voicing right now.
  if (visionActive || (!currentImage && started)) {
    const qualities = describePreferences(pref);
    return (
      <div className="w-full fade-in-up">
        <div className="relative w-full aspect-[16/9] overflow-hidden rounded-sm border border-[color:var(--hairline)]">
          <CloudField vector={pref.vector} variant="vision" className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <MiraOrb size={48} state="speaking" className="mb-5" />
            <p className="font-serif text-2xl sm:text-3xl text-white mira-line" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.4)" }}>
              This is the atmosphere I read in you.
            </p>
            {qualities.length > 0 && (
              <p
                className="text-sm text-white/90 mt-3 mira-line mira-line-2"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
              >
                Drawn to {qualities.join(" · ")}.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
          <span className="tag">weaving this into your match…</span>
        </div>
      </div>
    );
  }

  // ── Active image display ───────────────────────────────────────────
  return (
    <div className="relative w-full">
      {/* Image stage — a living cloud field (driven by the evolving
          preference vector, in lockstep with the drone) with the current
          reaction image floating within it as a card. */}
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-sm border border-[color:var(--hairline)]">
        {/* Procedural atmosphere — recolours and drifts with each reaction */}
        <CloudField vector={pref.vector} variant="backdrop" className="absolute inset-0" />

        {currentImage && (
          <div
            className={`absolute inset-0 flex items-center justify-center p-8 sm:p-10 transition-all duration-700 ${
              imagePhase === "entering"
                ? "opacity-0 scale-105"
                : imagePhase === "leaving"
                  ? "opacity-0 scale-95"
                  : "opacity-100 scale-100"
            }`}
          >
            <div className="relative w-[58%] max-w-[240px] aspect-[4/5] rounded-sm overflow-hidden shadow-2xl ring-1 ring-black/10">
              <Image
                src={currentImage.src}
                alt={currentImage.alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 60vw, 240px"
                priority
              />
              {/* Soft gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </div>
          </div>
        )}

        {/* Mira orb — small, top corner, breathing */}
        <div className="absolute top-4 left-4 z-10">
          <MiraOrb size={32} state="thinking" />
        </div>

        {/* Image counter */}
        <div className="absolute top-4 right-4 z-10">
          <span className="tag bg-black/30 text-white px-2 py-1 rounded-sm">
            {interactions + 1} / {Math.min(maxImages, IMAGE_POOL.length)}
          </span>
        </div>
      </div>

      {/* Reaction controls */}
      {imagePhase === "settled" && (
        <div className="flex items-center justify-center gap-4 mt-6 fade-in-up">
          <button
            type="button"
            onClick={() => advance("skip")}
            className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] text-[color:var(--muted)] hover:text-foreground hover:border-[color:var(--accent-soft)] transition-colors text-sm"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => advance("resonate")}
            className="px-6 py-2.5 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
          >
            This resonates →
          </button>
        </div>
      )}

      {/* Entering state — brief pause before controls appear */}
      {imagePhase === "entering" && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
          <span className="tag">looking…</span>
        </div>
      )}
    </div>
  );
}
