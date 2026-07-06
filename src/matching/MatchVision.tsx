"use client";

// MatchVision — the ceremonial match reveal. When the agent finishes
// reasoning, the result doesn't appear as a card. Mira speaks. The
// clouds part. The retreat emerges from the atmosphere she read.
//
// This replaces the old "Your match" heading + expanded MatchCard with
// a letter from Mira, rendered over a living cloud field driven by the
// same aesthetic vector that shaped the intake atmosphere and the orb's
// marble veins. One signal, all the way through.
//
// After the letter, the standard reasoning + alternatives follow below.

import { useMemo, useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import CloudField from "@/aesthetics/CloudField";
import ConversationalBooking from "@/booking/ConversationalBooking";
import ClassInvitation from "@/booking/ClassInvitation";
import BookingProviders from "@/booking/BookingProviders";
import { describePreferences, type UserPreference, type AestheticVector, NEUTRAL_VECTOR } from "@/aesthetics/image-pool";
import { matchLetter } from "@/agent/mira-voice";
import type { MatchResult } from "./types";
import type { MemoryContext } from "@/lib/cognee";

type MatchVisionProps = {
  match: MatchResult;
  signals: { energy?: string; budget?: string; social?: string };
  memory?: MemoryContext;
  aestheticVector?: AestheticVector | null;
  sessionId?: string;
  userId?: string;
  /** Scroll target for "see the full reasoning" link */
  onSeeReasoning?: () => void;
};

export default function MatchVision({
  match,
  signals,
  memory,
  aestheticVector,
  sessionId,
  userId,
  onSeeReasoning,
}: MatchVisionProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);

  const vector = aestheticVector ?? NEUTRAL_VECTOR;

  const letter = useMemo(
    () => matchLetter(match, signals, memory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match.id, match.retreatTitle, signals.energy, signals.social, memory?.isReturning],
  );

  // Aesthetic observation lines from the journey (if the user interacted)
  const aestheticLines = useMemo<string[]>(() => {
    if (!sessionId || typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(`aesthetic-pref-${sessionId}`);
      if (!raw) return [];
      const pref = JSON.parse(raw) as UserPreference;
      const dominant = describePreferences(pref);
      if (dominant.length === 0) return [];
      const observation =
        dominant.length === 1
          ? `While I was thinking, you were drawn to ${dominant[0]}. That confirms what I'm seeing.`
          : `While I was thinking, you were drawn to ${dominant.slice(0, -1).join(", ")} and ${dominant[dominant.length - 1]}. That tells me something about where you'd thrive.`;
      return [observation];
    } catch {
      return [];
    }
  }, [sessionId]);

  const classPriceUsd = Math.max(25, Math.round(match.priceUsd / 20));

  return (
    <div className="relative w-full -mx-6 sm:-mx-10 grid">
      {/*
        The cloud field — the same atmosphere from the intake, now
        resolved into the shape of the practitioner's match. The vector
        from the journey (or the intake answers) drives the palette.
        Using CSS grid stacking (all children in cell 1,1) so the cloud
        field fills the full content height — more robust than absolute
        positioning which can miscompute height with negative margins.
      */}
      <div className="col-start-1 row-start-1 z-0 overflow-hidden" aria-hidden>
        <CloudField vector={vector} variant="vision" className="w-full h-full" />
      </div>
      {/* Dark wash for text readability over the cloud field — the
          vision is moodier than the intake so the letter carries weight.
          Stronger than before: a uniform base + radial vignette in the
          text area ensures the letter is legible regardless of how
          bright the clouds render behind it. */}
      <div
        className="col-start-1 row-start-1 z-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "linear-gradient(to bottom, rgba(20,14,12,0.58) 0%, rgba(20,14,12,0.52) 50%, rgba(20,14,12,0.62) 100%)",
        }}
      />
      <div
        className="col-start-1 row-start-1 z-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 50% 45%, rgba(20,14,12,0.35) 0%, transparent 70%)",
        }}
      />

      <div className="col-start-1 row-start-1 z-10 px-6 sm:px-10 py-20 sm:py-28">
        {/* Mira — centered, large, speaking the letter */}
        <div
          className="flex flex-col items-center text-center mb-12"
          style={{ filter: "drop-shadow(0 0 60px rgba(168,90,58,0.22))" }}
        >
          <MiraOrb size={88} state="speaking" aestheticVector={vector} />
          <p className="font-serif text-2xl tracking-tight text-white mt-5 mira-line">
            Mira
          </p>
        </div>

        {/* The letter — staggered lines, centered, over the clouds */}
        <div className="max-w-prose mx-auto space-y-5 mb-10">
          {letter.lines.map((line, i) => {
            const isRecognition = i < letter.recognitionLineCount;
            const isRetreatLine = line.includes(match.retreatTitle);
            return (
              <p
                key={i}
                className={
                  isRecognition
                    ? "text-lg leading-relaxed text-[color:var(--accent)] italic border-l-2 border-[color:var(--accent-soft)] pl-4 text-left mira-line"
                    : isRetreatLine
                      ? "font-serif text-2xl sm:text-3xl leading-[1.2] tracking-tight text-white text-left mira-line"
                      : "text-lg leading-relaxed text-white text-left mira-line"
                }
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.7), 0 0 24px rgba(0,0,0,0.4)" }}
              >
                {line}
              </p>
            );
          })}
          {/* Aesthetic observation woven from the journey */}
          {aestheticLines.map((line, i) => (
            <p
              key={`aesthetic-${i}`}
              className="text-lg leading-relaxed text-[color:var(--accent)] italic text-left mira-line"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.7), 0 0 24px rgba(0,0,0,0.4)" }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* CTA — woven into the letter as a sentence */}
        {!bookingOpen && !classOpen && (
          <div className="max-w-prose mx-auto space-y-4">
            <div className="mira-line">
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="text-lg font-serif text-[color:var(--accent)] hover:text-white transition-colors text-left"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.7), 0 0 24px rgba(0,0,0,0.4)" }}
              >
                {letter.cta} →
              </button>
            </div>
            <div className="mira-line">
              <button
                type="button"
                onClick={() => setClassOpen(true)}
                className="text-sm text-white/75 hover:text-white transition-colors text-left"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
              >
                Or try a single class first (${classPriceUsd}) →
              </button>
            </div>

            {/* "See the full reasoning" — quiet link to the details below */}
            {onSeeReasoning && (
              <div className="pt-6">
                <button
                  type="button"
                  onClick={onSeeReasoning}
                  className="text-sm text-white/65 hover:text-white/90 transition-colors text-left"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
                >
                  see the full reasoning ↓
                </button>
              </div>
            )}
          </div>
        )}

        {/* Booking flow opens inline — the letter continues.
            A cream surface makes the booking text readable over the
            cloud field. Rounded edges echo the vision's softness. */}
        {bookingOpen && (
          <div className="max-w-prose mx-auto mt-8 bg-[color:var(--background)] rounded-sm p-6 sm:p-8 border border-[color:var(--hairline)]">
            <BookingProviders>
              <ConversationalBooking
                retreatRootHash={match.retreatRootHash}
                retreatTitle={match.retreatTitle}
                depositUsd={match.priceUsd}
                operatorAddress={match.attestor ?? ""}
                signals={signals}
                userId={userId}
                onClose={() => setBookingOpen(false)}
              />
            </BookingProviders>
          </div>
        )}

        {/* Class invitation opens inline */}
        {classOpen && (
          <div className="max-w-prose mx-auto mt-8 bg-[color:var(--background)] rounded-sm p-6 sm:p-8 border border-[color:var(--hairline)]">
            <BookingProviders>
              <ClassInvitation
                retreatRootHash={match.retreatRootHash}
                retreatTitle={match.retreatTitle}
                classPriceUsd={classPriceUsd}
                signals={signals}
                onClose={() => setClassOpen(false)}
              />
            </BookingProviders>
          </div>
        )}
      </div>
    </div>
  );
}
