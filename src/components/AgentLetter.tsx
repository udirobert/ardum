"use client";

// AgentLetter — Mira presents the match as a personal letter, not a
// product listing. The orb breathes at the top. Lines appear one by
// one with a staggered reveal. The booking CTA is a natural sentence
// at the end, not a button bolted onto a card.
//
// When the user clicks the CTA, the ConversationalBooking flow opens
// inline — the letter continues into the booking conversation, no
// page change, no wizard.

import { useMemo, useState } from "react";
import MiraOrb from "./MiraOrb";
import ConversationalBooking from "@/booking/ConversationalBooking";
import ClassInvitation from "@/booking/ClassInvitation";
import BookingProviders from "@/booking/BookingProviders";
import { describePreferences, type UserPreference } from "@/aesthetics/image-pool";

type AgentLetterProps = {
  orbSize?: number;
  lines: string[];
  cta: string;
  // Number of leading lines that are "welcome back" recognition (from
  // Cognee memory). These get a distinct visual treatment — italic,
  // accent-colored — to separate "I remember you" from "here's your match."
  recognitionLineCount?: number;
  retreatRootHash: string;
  retreatTitle: string;
  depositUsd: number;
  operatorAddress: string;
  classPriceUsd: number;
  signals: { energy?: string; budget?: string; social?: string };
  sessionId?: string;
  userId?: string;
};

export default function AgentLetter({
  orbSize = 56,
  lines,
  cta,
  recognitionLineCount = 0,
  retreatRootHash,
  retreatTitle,
  depositUsd,
  operatorAddress,
  classPriceUsd,
  signals,
  sessionId,
  userId,
}: AgentLetterProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);

  // Read aesthetic preferences from sessionStorage and generate
  // Mira's aesthetic observation lines. Computed via useMemo to
  // avoid set-state-in-effect cascading renders.
  const aestheticLines = useMemo<string[]>(() => {
    if (!sessionId || typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(`aesthetic-pref-${sessionId}`);
      if (!raw) return [];
      const pref = JSON.parse(raw) as UserPreference;
      const dominant = describePreferences(pref);
      if (dominant.length === 0) return [];
      const observation = dominant.length === 1
        ? `While I was thinking, you were drawn to ${dominant[0]}. That confirms what I'm seeing.`
        : `While I was thinking, you were drawn to ${dominant.slice(0, -1).join(", ")} and ${dominant[dominant.length - 1]}. That tells me something about where you'd thrive.`;
      return [observation];
    } catch {
      return [];
    }
  }, [sessionId]);

  return (
    <div className="mt-10 mb-10">
      {/* Mira orb + label */}
      <div className="flex items-center gap-4 mb-8">
        <MiraOrb size={orbSize} state="speaking" />
        <div>
          <p className="font-serif text-2xl tracking-tight">Mira</p>
          <p className="tag">your guide</p>
        </div>
      </div>

      {/* The letter — staggered lines. Recognition lines (from Cognee
          memory) are styled distinctly: italic, accent-colored, with a
          subtle left border. This visually separates "I remember you"
          from "here's your match." */}
      <div className="space-y-4 mb-8 max-w-prose">
        {lines.map((line, i) => {
          const isRecognition = i < recognitionLineCount;
          return (
            <p
              key={i}
              className={
                isRecognition
                  ? "text-lg leading-relaxed text-[color:var(--accent-ink)] italic border-l-2 border-[color:var(--accent-soft)] pl-4 mira-line mira-line-1"
                  : `text-lg leading-relaxed text-foreground mira-line mira-line-${Math.min(i + 1 - recognitionLineCount, 5)}`
              }
            >
              {line}
            </p>
          );
        })}
        {/* Aesthetic observation — woven in from the journey */}
        {aestheticLines.map((line, i) => (
          <p
            key={`aesthetic-${i}`}
            className="text-lg leading-relaxed text-[color:var(--accent-ink)] italic mira-line mira-line-5"
          >
            {line}
          </p>
        ))}
      </div>

      {/* CTA — woven into the letter as a sentence, not a button */}
      {!bookingOpen && !classOpen && (
        <div className="space-y-4">
          <div className="mira-line mira-line-5">
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="text-lg font-serif text-[color:var(--accent)] hover:text-[color:var(--accent-ink)] transition-colors text-left"
            >
              {cta} →
            </button>
          </div>

          {/* Secondary option — drop-in class as invitation */}
          <div className="mira-line mira-line-5">
            <button
              type="button"
              onClick={() => setClassOpen(true)}
              className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors text-left"
            >
              Or try a single class first (${classPriceUsd}) →
            </button>
          </div>
        </div>
      )}

      {/* Booking flow opens inline — the letter continues */}
      {bookingOpen && (
        <BookingProviders>
          <ConversationalBooking
            retreatRootHash={retreatRootHash}
            retreatTitle={retreatTitle}
            depositUsd={depositUsd}
            operatorAddress={operatorAddress}
            signals={signals}
            userId={userId}
            onClose={() => setBookingOpen(false)}
          />
        </BookingProviders>
      )}

      {/* Class invitation opens inline */}
      {classOpen && (
        <BookingProviders>
          <ClassInvitation
            retreatRootHash={retreatRootHash}
            retreatTitle={retreatTitle}
            classPriceUsd={classPriceUsd}
            signals={signals}
            onClose={() => setClassOpen(false)}
          />
        </BookingProviders>
      )}
    </div>
  );
}
