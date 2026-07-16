"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  IMAGE_POOL,
  describePreferences,
  emptyPreference,
  pickNextImage,
  updatePreference,
  type PoolImage,
  type UserPreference,
} from "./image-pool";
import {
  readAestheticPreference,
  writeAestheticPreference,
} from "./aesthetic-store";
import { useMiraImpulse } from "@/components/MiraImpulse";
import StaggerReveal from "@/components/StaggerReveal";
import { CREAM, DUSK_HEADING, DUSK_MUTED } from "./dusk-theme";

const RetreatVision = dynamic(() => import("./RetreatVision"), { ssr: false });

const TARGET_REACTIONS = 4;

type Phase = "calibrate" | "vision";

type Props = {
  onComplete: (pref: UserPreference) => void;
  /** Fires after every reaction so the hero orb's palette retunes live. */
  onVector?: (vector: UserPreference["vector"]) => void;
};

export default function AestheticCalibration({ onComplete, onVector }: Props) {
  const { fire } = useMiraImpulse();
  const [pref, setPref] = useState<UserPreference>(() =>
    typeof window !== "undefined" ? readAestheticPreference() : emptyPreference(),
  );
  const [phase, setPhase] = useState<Phase>(() => {
    const initial =
      typeof window !== "undefined" ? readAestheticPreference() : emptyPreference();
    return initial.interactions.length >= TARGET_REACTIONS ? "vision" : "calibrate";
  });
  const [shown, setShown] = useState<Set<string>>(() => {
    const initial =
      typeof window !== "undefined" ? readAestheticPreference() : emptyPreference();
    return new Set(initial.interactions.map((item) => item.imageId));
  });
  const [current, setCurrent] = useState<PoolImage | null>(() => {
    if (typeof window === "undefined") return null;
    const initial = readAestheticPreference();
    if (initial.interactions.length >= TARGET_REACTIONS) return null;
    const initialShown = new Set(initial.interactions.map((item) => item.imageId));
    return pickNextImage(IMAGE_POOL, initial, initialShown);
  });
  const [exiting, setExiting] = useState<"resonate" | "skip" | null>(null);
  const shownAt = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Stamp when the initial image appeared; advance() stamps subsequent ones.
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const advance = useCallback(
    (nextPref: UserPreference, nextShown: Set<string>) => {
      if (nextPref.interactions.length >= TARGET_REACTIONS) {
        writeAestheticPreference(nextPref);
        setPref(nextPref);
        setPhase("vision");
        return;
      }
      const img = pickNextImage(IMAGE_POOL, nextPref, nextShown);
      if (!img) {
        writeAestheticPreference(nextPref);
        setPref(nextPref);
        setPhase("vision");
        return;
      }
      setCurrent(img);
      shownAt.current = performance.now();
    },
    [],
  );

  const qualities = useMemo(
    () => (pref.interactions.length > 0 ? describePreferences(pref) : []),
    [pref],
  );

  function react(reaction: "resonate" | "skip") {
    if (!current || exiting) return;
    fire(reaction === "resonate" ? "resonate" : "skip");
    setExiting(reaction);
    const dwellMs = performance.now() - shownAt.current;
    const nextPref = updatePreference(pref, current, reaction, dwellMs);
    const nextShown = new Set(shown).add(current.id);
    onVector?.(nextPref.vector);

    window.setTimeout(() => {
      setPref(nextPref);
      setShown(nextShown);
      setCurrent(null);
      setExiting(null);
      advance(nextPref, nextShown);
    }, 280);
  }

  const progress = Math.min(100, (pref.interactions.length / TARGET_REACTIONS) * 100);

  if (phase === "vision") {
    return (
      <RetreatVision
        vector={pref.vector}
        preference={pref}
        onContinue={() => onComplete(pref)}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto text-center aesthetic-calibrate">
      <StaggerReveal>
        <p className="tag mb-2 t-stagger-line">before words</p>
        <h2
          className="font-serif text-3xl sm:text-5xl tracking-tight mb-3 t-stagger-line t-stagger-line--2"
          style={DUSK_HEADING}
        >
          Show me what feels closer.
        </h2>
        <p
          className="mb-8 t-stagger-line t-stagger-line--2"
          style={DUSK_MUTED}
        >
          Swipe or tap. I shift as you choose.
        </p>
      </StaggerReveal>

      <div
        className="h-1 rounded-full mb-6 overflow-hidden max-w-md mx-auto"
        style={{ background: "rgba(246,239,227,0.16)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "#d8a892" }}
        />
      </div>

      {qualities.length > 0 && (
        <p className="tag mb-6 italic" style={{ color: "#e5b394" }}>
          leaning toward {qualities.join(", ")}
        </p>
      )}

      {current && (
        <div
          className={`relative aspect-[4/3] w-full max-w-3xl max-h-[48svh] mx-auto overflow-hidden rounded-sm border border-[rgba(246,239,227,0.18)] shadow-2xl transition-all duration-300 aesthetic-calibrate-frame ${
            exiting === "resonate"
              ? "scale-[1.04] opacity-0 rotate-1"
              : exiting === "skip"
                ? "scale-95 opacity-0 -translate-x-4 blur-sm"
                : "scale-100 opacity-100"
          }`}
          onTouchStart={(event) => {
            const t = event.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(event) => {
            if (!touchStart.current || exiting) return;
            const t = event.changedTouches[0];
            const dx = t.clientX - touchStart.current.x;
            const dy = t.clientY - touchStart.current.y;
            touchStart.current = null;
            if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
            react(dx > 0 ? "resonate" : "skip");
          }}
        >
          <Image
            src={current.src}
            alt={current.alt}
            fill
            className="object-cover select-none"
            sizes="(max-width: 768px) 100vw, 960px"
            priority
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(46,32,24,0.6)] via-transparent to-transparent pointer-events-none" />
          <p className="absolute bottom-4 left-4 right-4 text-left text-sm text-white/90 pointer-events-none">
            {current.alt}
          </p>
          <div className="absolute top-4 left-4 right-4 flex justify-between text-xs text-white/70 pointer-events-none sm:hidden">
            <span>← not this</span>
            <span>this →</span>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-8">
        <button
          type="button"
          disabled={!current || !!exiting}
          onClick={() => react("skip")}
          className="px-6 py-3 rounded-sm border disabled:opacity-40"
          style={{ borderColor: "rgba(246,239,227,0.3)", color: CREAM }}
        >
          Not this
        </button>
        <button
          type="button"
          disabled={!current || !!exiting}
          onClick={() => react("resonate")}
          className="px-8 py-3 rounded-sm disabled:opacity-40"
          style={{ background: CREAM, color: "#1a120d" }}
        >
          This feels right
        </button>
      </div>
    </div>
  );
}
