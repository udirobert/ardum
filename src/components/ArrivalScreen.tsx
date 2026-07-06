"use client";

// ArrivalScreen — the new landing experience.
//
// The page opens to Mira, not to copy about Mira. The cloud field IS the
// environment. One question floats beneath the orb: "Where are you arriving
// from?" — and that is the only thing on screen.
//
// Returning users: Mira speaks first. The recall banner is gone — instead,
// her recognition line IS the opening question. The practitioner feels seen
// before they've answered anything.
//
// Structure:
//   1. Cloud field fills the viewport (vision variant — fuller payoff)
//   2. Mira orb at centre, ~140px, breathing calmly
//   3. Character-by-character CSS reveal of Mira's line (no JS state per char)
//   4. CTA fades in after the reveal completes
//
// The "how it works" explainer is gone. Trust is built by doing, not reading.

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import CloudField from "@/aesthetics/CloudField";
import MiraOrb from "@/components/MiraOrb";
import {
  getFingerprint,
  isRecallable,
  recallAgeLabel,
  STORAGE_KEY as FINGERPRINT_KEY,
  type Fingerprint,
} from "@/lib/fingerprint";
import type { AestheticVector } from "@/aesthetics/image-pool";

// The neutral-warm vector used before the practitioner has answered anything.
// Skews warm and slightly calming so the cloud field opens as cream/terracotta
// rather than mid-grey — Ardum's brand palette from the first frame.
const NEUTRAL_VECTOR: AestheticVector = {
  ocean: 0.5, mountain: 0.5, jungle: 0.5, desert: 0.5, forest: 0.5,
  warm: 0.65, cool: 0.35,
  minimal: 0.5, ornate: 0.5,
  light: 0.62, dark: 0.38,
  calming: 0.6, energizing: 0.4,
  expansive: 0.55, intimate: 0.45,
};

// Character-reveal timing (ms per character). Punctuation gets a 5× pause.
const CHAR_MS = 28;
const START_DELAY_MS = 1200;

// Compute the total reveal duration for a string.
function revealDuration(text: string): number {
  return (
    START_DELAY_MS +
    text.split("").reduce((acc, ch) => {
      return acc + (/[.,—]/.test(ch) ? CHAR_MS * 5 : CHAR_MS);
    }, 0)
  );
}

// ── Fingerprint external store ─────────────────────────────────────────────
const subscribeNoop = () => () => {};
let cachedRaw: string | null | undefined = undefined;
let cachedFP: Fingerprint | null = null;
const getFPSnapshot = (): Fingerprint | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(FINGERPRINT_KEY);
  if (raw === cachedRaw) return cachedFP;
  cachedRaw = raw;
  const fp = getFingerprint();
  cachedFP = isRecallable(fp) ? fp : null;
  return cachedFP;
};
const getFPServerSnapshot = (): Fingerprint | null => null;

// ── CSS character-reveal component ────────────────────────────────────────
// Each character is a <span> with an animation-delay proportional to its
// position. No JS state per character — the reveal is pure CSS animation.
// The cursor is a separate <span> that hides after the last character appears.

function TypedText({
  text,
  className,
  startDelay = START_DELAY_MS,
  charMs = CHAR_MS,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  charMs?: number;
}) {
  // Precompute cumulative per-character delays immutably (no mutation during render).
  const chars = text.split("");
  const delays = chars.reduce<number[]>((acc, ch) => {
    const prev = acc.length === 0 ? startDelay : acc[acc.length - 1];
    const step = /[.,—]/.test(ch) ? charMs * 5 : charMs;
    acc.push(prev + step);
    return acc;
  }, []);
  return (
    <span className={className} aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            opacity: 0,
            animation: `char-reveal 80ms linear ${delays[i]}ms forwards`,
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

// ── ArrivalScreen ──────────────────────────────────────────────────────────

type ArrivalScreenProps = {
  onBegin: () => void;
};

export default function ArrivalScreen({ onBegin }: ArrivalScreenProps) {
  const fingerprint = useSyncExternalStore(
    subscribeNoop,
    getFPSnapshot,
    getFPServerSnapshot,
  );

  // Build Mira's opening line from the fingerprint (if returning).
  // This is the recognition moment — not a banner, but her first words.
  const miraLine = useMemo(() => {
    if (!fingerprint) {
      return "Where are you arriving from?";
    }
    const age = recallAgeLabel(fingerprint) ?? "a while ago";
    const { energy } = fingerprint.profile;
    const energyMap: Record<string, string> = {
      settled: "settled",
      "in-movement": "in movement",
      low: "somewhere low",
      sharp: "sharp and alert",
    };
    const energyLabel = energyMap[energy] ?? energy;
    const timeLabel = age === "yesterday" ? "yesterday" : `${age}`;
    return `You were here ${timeLabel}. You were ${energyLabel}. Are you arriving from the same place?`;
  }, [fingerprint]);

  const isReturning = !!fingerprint;

  // "done" fires after the full CSS reveal has completed — drives CTA + scroll cue.
  const [done, setDone] = useState(false);
  const duration = useMemo(() => revealDuration(miraLine), [miraLine]);

  useEffect(() => {
    const tid = setTimeout(() => setDone(true), duration + 200);
    return () => clearTimeout(tid);
  }, [duration]);

  // Enter key to begin — only active after the reveal.
  const [exiting, setExiting] = useState(false);
  function handleBegin() {
    setExiting(true);
    setTimeout(onBegin, 520);
  }

  useEffect(() => {
    if (!done) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") handleBegin();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-h-[calc(100svh-56px)] transition-opacity duration-500 ${exiting ? "opacity-0" : "opacity-100"}`}
      style={{ isolation: "isolate" }}
    >
      {/* Cloud field — fills the entire arrival screen */}
      <div className="absolute inset-0 -z-10">
        <CloudField vector={NEUTRAL_VECTOR} variant="vision" className="w-full h-full" />
      </div>

      {/* Soft centre vignette so text stays legible against the clouds */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 65% at 50% 58%, rgba(246,241,231,0.55) 0%, rgba(246,241,231,0.18) 55%, transparent 80%)",
        }}
        aria-hidden
      />

      {/* Centre column */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg mx-auto">

        {/* Mira orb — large, breathing, the presence before any words */}
        <div
          className="mb-10 fade-in-up"
          style={{
            animationDelay: "300ms",
            filter: "drop-shadow(0 0 56px rgba(168,90,58,0.24))",
          }}
        >
          <MiraOrb size={144} state="speaking" />
        </div>

        {/* Mira's opening question — character-by-character CSS reveal */}
        <p
          className="font-serif text-2xl sm:text-3xl leading-[1.38] tracking-tight text-foreground"
          style={{ minHeight: "4.5rem" }}
        >
          <TypedText text={miraLine} />
          {/* Blinking cursor — hides itself after the last character */}
          <span
            aria-hidden
            className="inline-block w-[2px] h-[0.85em] bg-[color:var(--accent)] ml-[2px] align-middle"
            style={{
              animation: `char-reveal 80ms linear ${duration - 80}ms forwards, cursor-blink 0.9s ease-in-out ${duration + 200}ms forwards`,
              opacity: 0,
            }}
          />
        </p>

        {/* Sub-line for new visitors — establishes what Ardum is */}
        {!isReturning && (
          <div
            style={{
              opacity: 0,
              animation: `fade-in-up 480ms cubic-bezier(0.22,1,0.36,1) ${duration + 300}ms forwards`,
            }}
          >
            <p className="text-[color:var(--muted)] mt-4 text-base leading-relaxed">
              Ardum finds your yoga retreat.
            </p>
            <p className="text-[color:var(--muted)] mt-1 text-sm leading-relaxed opacity-70">
              Three questions. No filters. An agent that reads where you are.
            </p>
          </div>
        )}

        {/* CTA buttons */}
        <div
          className="mt-10 flex flex-col items-center gap-4"
          style={{
            opacity: 0,
            animation: `fade-in-up 480ms cubic-bezier(0.22,1,0.36,1) ${duration + (isReturning ? 300 : 600)}ms forwards`,
          }}
        >
          <button
            type="button"
            onClick={handleBegin}
            className="px-8 py-3.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors text-base tracking-wide"
          >
            {isReturning ? "Yes, tell me more →" : "Begin →"}
          </button>

          {isReturning && (
            <button
              type="button"
              onClick={handleBegin}
              className="text-[color:var(--muted)] hover:text-foreground text-sm transition-colors"
            >
              I&apos;m in a different place now
            </button>
          )}

          <p className="tag opacity-40 mt-1">or press Enter</p>
        </div>
      </div>

      {/* Scroll indicator — fades in after CTA */}
      {done && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 fade-in-up"
          aria-hidden
        >
          <p className="tag opacity-35">scroll to browse the pool</p>
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="opacity-25"
            style={{ animation: "mira-breathe 2.4s ease-in-out infinite" }}
          >
            <path
              d="M10 4v12M6 12l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
