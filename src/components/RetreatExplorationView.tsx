"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRevealPresentation } from "@/inventory/use-retreat-exploration";
import { useMiraField } from "./MiraField";
import { MiraOrbProvider } from "./MiraOrbContext";
import type { Retreat } from "@/inventory/retreat";
import type { Recommendation } from "@/agent/retreat-response";
import { composeBeat2Letter } from "@/evidence/wider-aperture";
import type { WiderApertureEvidence } from "@/evidence/wider-aperture";
import type { WiderApertureStores } from "@/evidence/resolve-wider-aperture";
import { resolveWiderApertureEvidence } from "@/evidence/resolve-wider-aperture";
import AmbientCanvas from "./AmbientCanvas";
import WebGPUCommitmentTransition from "./WebGPUCommitmentTransition";
import {
  CohortEvidencePanel,
  PublicEvidencePanel,
} from "./WiderApertureDisclosurePanels";
import { DUSK_PANEL, CREAM } from "@/aesthetics/dusk-theme";
import type { IntentionConstraints } from "@/agent/constraint-updater";

/**
 * Recommendation reveal flow — Beats 1 through 4 (presentation only).
 *
 * Receives persisted recommendation data and delegates hold, refinement,
 * and rejection to canonical episode commands via callbacks.
 */
interface RetreatExplorationViewProps {
  recommendation: Recommendation | null;
  holdActive?: boolean;
  holdPending?: boolean;
  busy?: boolean;
  voiceLaneNudge?: string | null;
  /** Pre-resolved tier B/C evidence from episode detail API. */
  widerApertureEvidence?: WiderApertureEvidence | null;
  /** Client-side resolve for demo/dev when retreat or constraints change. */
  widerApertureStores?: WiderApertureStores;
  constraints?: IntentionConstraints;
  uncertainties?: string[];
  onHold: () => void;
  onVoiceMessage?: (text: string) => Promise<void>;
  onElevate?: (retreatId: string) => void;
  onReject?: (retreatId: string) => void;
  onHoldCeremonyComplete?: () => void;
}

export default function RetreatExplorationView({
  recommendation,
  holdActive = false,
  holdPending = false,
  busy = false,
  voiceLaneNudge = null,
  widerApertureEvidence: widerApertureEvidenceProp,
  widerApertureStores,
  constraints = {},
  uncertainties = [],
  onHold,
  onVoiceMessage,
  onElevate,
  onReject,
  onHoldCeremonyComplete,
}: RetreatExplorationViewProps) {
  const beats = useRevealPresentation(recommendation);
  const {
    state,
    openAlternatives,
    closeAlternatives,
    beginHoldCeremony,
    endHoldCeremony,
    setProcessing,
  } = beats;

  const activity =
    state === "looking" || state === "processing"
      ? "processing"
      : state === "arriving"
        ? "arriving"
        : state === "listening"
          ? "listening"
          : state === "committing"
            ? "processing"
            : "idle";

  useMiraField({
    activity,
    veil: state === "settled" || state === "listening" ? 0.4 : 0.2,
    fieldTier: "hero",
  });

  const [committingRetreat, setCommittingRetreat] = useState<Retreat | null>(
    null,
  );

  const widerApertureEvidence = (() => {
    if (widerApertureStores && recommendation) {
      return resolveWiderApertureEvidence({
        constraints,
        retreatKey: recommendation.retreat.id,
        stores: widerApertureStores,
      });
    }
    return widerApertureEvidenceProp ?? null;
  })();

  const handleCommit = () => {
    if (!recommendation) return;
    setCommittingRetreat(recommendation.retreat);
    beginHoldCeremony();
    onHold();
  };

  const handleVoiceMessage = async (text: string) => {
    if (!onVoiceMessage) return;
    setProcessing(true);
    try {
      await onVoiceMessage(text);
    } finally {
      setProcessing(false);
    }
  };

  const showHoldCeremony =
    holdPending || (committingRetreat !== null && state === "committing");

  return (
    <MiraOrbProvider>
      <AmbientCanvas retreat={recommendation?.retreat ?? null} />

      <AnimatePresence mode="wait">
        {state === "looking" && !recommendation && (
          <LookingBeat key="looking" />
        )}

        {recommendation && (state === "arriving" || state === "settled") && (
          <Beat2
            key={`beat2-${recommendation.retreat.id}`}
            recommendation={recommendation}
            revealing={state === "arriving"}
            holdActive={holdActive}
            onCommit={handleCommit}
            onOpenAlternatives={openAlternatives}
            widerApertureEvidence={widerApertureEvidence}
            uncertainties={uncertainties}
          />
        )}

        {state === "listening" && recommendation && (
          <Beat3
            key="beat3"
            recommendation={recommendation}
            voiceLaneNudge={voiceLaneNudge}
            onElevate={onElevate ?? (() => {})}
            onReject={onReject ?? (() => {})}
            onVoiceMessage={handleVoiceMessage}
            onClose={closeAlternatives}
            busy={busy}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHoldCeremony && committingRetreat && (
          <WebGPUCommitmentTransition
            retreat={committingRetreat}
            isActive={true}
            onComplete={() => {
              setCommittingRetreat(null);
              endHoldCeremony();
              onHoldCeremonyComplete?.();
            }}
          />
        )}
      </AnimatePresence>
    </MiraOrbProvider>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Beat 1 — looking
// ──────────────────────────────────────────────────────────────────────

function LookingBeat() {
  return (
    <motion.div
      className="relative z-10 min-h-[60vh] flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p
        className="font-serif text-xl sm:text-2xl text-center max-w-md"
        style={{ color: CREAM, opacity: 0.7 }}
      >
        Looking at what fits…
      </p>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Beat 2 — recommendation reveal + steady-state decision card
// ──────────────────────────────────────────────────────────────────────

interface Beat2Props {
  recommendation: Recommendation;
  revealing: boolean;
  holdActive: boolean;
  onCommit: () => void;
  onOpenAlternatives: () => void;
  widerApertureEvidence: WiderApertureEvidence | null;
  uncertainties: string[];
}

function Beat2({
  recommendation,
  revealing,
  holdActive,
  onCommit,
  onOpenAlternatives,
  widerApertureEvidence,
  uncertainties,
}: Beat2Props) {
  const { retreat, letter } = recommendation;
  const displayLetter = composeBeat2Letter(
    letter,
    widerApertureEvidence,
    uncertainties,
  );

  return (
    <motion.div
      className="relative z-10 min-h-[calc(100svh-56px)] flex flex-col justify-end px-6 sm:px-10 pb-10 sm:pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* Reveal: image emerges first, then the card settles over it. */}
        <RevealImage retreat={retreat} revealing={revealing} />

        {/* Keyed on retreat.id so disclosure state resets naturally on
            re-rank / elevate via remount, no effect needed. */}
        <DecisionCard
          key={retreat.id}
          retreat={retreat}
          letter={displayLetter}
          revealing={revealing}
          holdActive={holdActive}
          onCommit={onCommit}
          onOpenAlternatives={onOpenAlternatives}
          widerApertureEvidence={widerApertureEvidence}
          uncertainties={uncertainties}
        />
      </div>
    </motion.div>
  );
}

function RevealImage({ retreat, revealing }: { retreat: Retreat; revealing: boolean }) {
  return (
    <motion.div
      className="relative w-full aspect-[16/9] rounded-sm overflow-hidden mb-6"
      initial={revealing ? { opacity: 0, scale: 0.92, y: 24 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={retreat.heroImage}
        alt={retreat.title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
    </motion.div>
  );
}

interface DecisionCardProps {
  retreat: Retreat;
  letter: string;
  revealing: boolean;
  holdActive: boolean;
  onCommit: () => void;
  onOpenAlternatives: () => void;
  widerApertureEvidence: WiderApertureEvidence | null;
  uncertainties: string[];
}

type DisclosureKey =
  | "none"
  | "alternatives"
  | "provenance"
  | "cohort"
  | "public-evidence"
  | "counterfactual"
  | "operator";

function DecisionCard({
  retreat,
  letter,
  revealing,
  holdActive,
  onCommit,
  onOpenAlternatives,
  widerApertureEvidence,
  uncertainties,
}: DecisionCardProps) {
  const [disclosure, setDisclosure] = useState<DisclosureKey>("none");
  const cohortEvidence = widerApertureEvidence?.cohort ?? null;
  const publicEvidence = widerApertureEvidence?.public ?? null;
  const uncertaintyCount = uncertainties.length;

  return (
    <motion.div
      className="rounded-sm p-6 sm:p-8 surface-card"
      style={{
        background: DUSK_PANEL.background,
        borderColor: DUSK_PANEL.borderColor,
        border: "1px solid var(--hairline)",
      }}
      initial={revealing ? { opacity: 0, y: 32 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      aria-live="polite"
    >
      {/* 1. Mira's letter — the why, not the what. */}
      <p
        className="font-serif text-xl sm:text-2xl leading-relaxed mb-6"
        style={{ color: CREAM }}
      >
        {letter}
      </p>

      {/* Retreat identity — evidence for the letter, not a brochure. */}
      <div className="mb-6">
        <h2 className="font-serif text-2xl sm:text-3xl tracking-tight" style={{ color: CREAM }}>
          {retreat.title}
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgba(246,239,227,0.7)" }}>
          {retreat.dates.duration} days · ${retreat.price.amount.toLocaleString()} · {retreat.location}
        </p>
      </div>

      {/* 2. One primary decision — hold. */}
      <button
        type="button"
        onClick={onCommit}
        disabled={holdActive}
        className="w-full px-6 py-4 rounded-full text-base font-medium transition-all duration-200 hover:scale-[1.01] disabled:opacity-50"
        style={{
          background: "var(--accent-soft, #a85a3a)",
          color: CREAM,
          boxShadow: "0 0 40px rgba(168,90,58,0.3)",
        }}
      >
        {holdActive ? "Hold active" : "Hold this for 48 hours"}
        <span className="block text-sm font-normal opacity-80 mt-1">
          {holdActive
            ? "Nothing charged. I'm watching it."
            : "Nothing charged. I'll watch it."}
        </span>
      </button>

      {/* 3. Status — one quiet line; optional uncertainty nudge. */}
      <p className="text-xs mt-4" style={{ color: "rgba(246,239,227,0.5)" }}>
        {holdActive ? "Hold active." : "No hold active yet."}
      </p>
      {uncertaintyCount > 0 && (
        <button
          type="button"
          onClick={() => setDisclosure("provenance")}
          className="text-xs mt-2 text-left transition-opacity hover:opacity-100"
          style={{ color: "rgba(246,239,227,0.45)" }}
        >
          There {uncertaintyCount === 1 ? "is" : "are"} {uncertaintyCount}{" "}
          {uncertaintyCount === 1 ? "thing" : "things"} I&apos;m still uncertain
          about.
        </button>
      )}

      {/* 4. Disclosure — collapsed by default. */}
      <div className="mt-6 pt-6 border-t" style={{ borderColor: "rgba(246,239,227,0.1)" }}>
        <ul className="space-y-2">
          <DisclosureRow
            label="See other possibilities I'm weighing"
            isOpen={disclosure === "alternatives"}
            onToggle={() =>
              setDisclosure(disclosure === "alternatives" ? "none" : "alternatives")
            }
            onOpen={onOpenAlternatives}
          >
            <p className="text-sm" style={{ color: "rgba(246,239,227,0.7)" }}>
              I&apos;ll show you a few others and what makes each different.
            </p>
          </DisclosureRow>
          <DisclosureRow
            label="How I chose this"
            isOpen={disclosure === "provenance"}
            onToggle={() =>
              setDisclosure(disclosure === "provenance" ? "none" : "provenance")
            }
          >
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "rgba(246,239,227,0.7)" }}>
                Ranked against your intention, your constraints, and the
                operator&apos;s track record. Provenance is held in the episode
                record.
              </p>
              {uncertaintyCount > 0 && (
                <div>
                  <p
                    className="text-xs uppercase tracking-wider mb-2"
                    style={{ color: "rgba(246,239,227,0.55)" }}
                  >
                    What remains uncertain
                  </p>
                  <ul className="space-y-1">
                    {uncertainties.map((item) => (
                      <li
                        key={item}
                        className="text-sm"
                        style={{ color: "rgba(246,239,227,0.7)" }}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </DisclosureRow>
          {cohortEvidence && (
            <DisclosureRow
              label="What others found"
              isOpen={disclosure === "cohort"}
              onToggle={() =>
                setDisclosure(disclosure === "cohort" ? "none" : "cohort")
              }
            >
              <CohortEvidencePanel evidence={cohortEvidence} />
            </DisclosureRow>
          )}
          {publicEvidence && (
            <DisclosureRow
              label="What public sources report"
              isOpen={disclosure === "public-evidence"}
              onToggle={() =>
                setDisclosure(
                  disclosure === "public-evidence" ? "none" : "public-evidence",
                )
              }
            >
              <PublicEvidencePanel evidence={publicEvidence} />
            </DisclosureRow>
          )}
          <DisclosureRow
            label="What if the timing slips"
            isOpen={disclosure === "counterfactual"}
            onToggle={() =>
              setDisclosure(disclosure === "counterfactual" ? "none" : "counterfactual")
            }
          >
            <p className="text-sm" style={{ color: "rgba(246,239,227,0.7)" }}>
              A re-ranking under shifted timing is available. It&apos;s read-only —
              it never changes a hold.
            </p>
          </DisclosureRow>
          <DisclosureRow
            label="Operator & highlights"
            isOpen={disclosure === "operator"}
            onToggle={() =>
              setDisclosure(disclosure === "operator" ? "none" : "operator")
            }
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={retreat.operator.avatar}
                  alt={retreat.operator.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: CREAM }}>
                    {retreat.operator.name}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(246,239,227,0.6)" }}>
                    {retreat.operator.bio}
                  </p>
                </div>
              </div>
              {retreat.highlights.length > 0 && (
                <ul className="space-y-1">
                  {retreat.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="text-xs flex items-start gap-2"
                      style={{ color: "rgba(246,239,227,0.8)" }}
                    >
                      <span style={{ color: "var(--accent-soft, #a85a3a)" }}>•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DisclosureRow>
        </ul>
      </div>
    </motion.div>
  );
}

function DisclosureRow({
  label,
  isOpen,
  onToggle,
  onOpen,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onToggle();
          // For the alternatives row, opening disclosure also opens Beat 3.
          if (!isOpen && onOpen) onOpen();
        }}
        aria-expanded={isOpen}
        className="w-full text-left text-sm py-1 transition-opacity hover:opacity-100"
        style={{ color: "rgba(246,239,227,0.6)" }}
      >
        <span className="inline-block mr-2" aria-hidden>
          {isOpen ? "−" : "+"}
        </span>
        {label}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden pl-6 pt-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Beat 3 — alternatives overlay (summoned)
// ──────────────────────────────────────────────────────────────────────

interface Beat3Props {
  recommendation: Recommendation;
  voiceLaneNudge: string | null;
  onElevate: (retreatId: string) => void;
  onReject: (retreatId: string) => void;
  onVoiceMessage: (text: string) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}

function Beat3({
  recommendation,
  voiceLaneNudge,
  onElevate,
  onReject,
  onVoiceMessage,
  onClose,
  busy,
}: Beat3Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the voice lane on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes Beat 3.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = () => {
    if (!input.trim() || busy) return;
    onVoiceMessage(input.trim());
    setInput("");
  };

  return (
    <motion.div
      className="fixed inset-0 z-30 flex flex-col px-6 sm:px-10 pt-16 pb-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Dimmed backdrop over the Beat 2 card. */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(9,5,3,0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-2xl flex flex-col gap-6">
        {/* Mira's frame for the alternatives set. */}
        <div>
          <p
            className="font-serif text-xl sm:text-2xl leading-relaxed"
            style={{ color: CREAM }}
          >
            Other possibilities I&apos;m weighing
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(246,239,227,0.6)" }}>
            {recommendation.alternatives.length} that sit close to what you named.
          </p>
        </div>

        {/* Alternative cards — bounded set, no infinite scroll. */}
        <div className="space-y-4 max-h-[55svh] overflow-y-auto pr-1">
          {recommendation.alternatives.length === 0 && (
            <p className="text-sm" style={{ color: "rgba(246,239,227,0.6)" }}>
              I&apos;m not weighing anything else right now. Tell me what feels off,
              or stay with the one I presented.
            </p>
          )}
          {recommendation.alternatives.map(({ retreat, reason }) => (
            <AlternativeCard
              key={retreat.id}
              retreat={retreat}
              reason={reason}
              onElevate={() => onElevate(retreat.id)}
              onReject={() => onReject(retreat.id)}
            />
          ))}
        </div>

        {/* Voice lane — only in Beat 3. */}
        <div className="mt-auto">
          {voiceLaneNudge && (
            <p
              className="font-serif text-base mb-3 italic"
              style={{ color: "rgba(246,239,227,0.85)" }}
            >
              {voiceLaneNudge}
            </p>
          )}
          <div
            className="rounded-full flex items-center gap-3 px-5 py-3"
            style={{
              background: DUSK_PANEL.background,
              border: `1px solid ${DUSK_PANEL.borderColor}`,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="tell me what feels off"
              disabled={busy}
              className="flex-1 bg-transparent border-none outline-none text-base"
              style={{ color: CREAM }}
              aria-label="Tell Mira what feels off"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy || !input.trim()}
              className="text-sm px-4 py-2 rounded-full disabled:opacity-40"
              style={{
                background: "var(--accent-soft, #a85a3a)",
                color: CREAM,
              }}
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>

        {/* Close — return to top pick. */}
        <button
          type="button"
          onClick={onClose}
          className="self-center text-xs underline"
          style={{ color: "rgba(246,239,227,0.5)" }}
        >
          close — return to the one I presented
        </button>
      </div>
    </motion.div>
  );
}

function AlternativeCard({
  retreat,
  reason,
  onElevate,
  onReject,
}: {
  retreat: Retreat;
  reason: string;
  onElevate: () => void;
  onReject: () => void;
}) {
  return (
    <motion.div
      layout
      className="rounded-sm overflow-hidden"
      style={{
        background: DUSK_PANEL.background,
        border: `1px solid ${DUSK_PANEL.borderColor}`,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={retreat.heroImage}
          alt={retreat.title}
          className="w-24 h-24 sm:w-32 sm:h-32 rounded-sm object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg" style={{ color: CREAM }}>
            {retreat.title}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(246,239,227,0.6)" }}>
            {retreat.dates.duration} days · ${retreat.price.amount.toLocaleString()} · {retreat.location}
          </p>
          <p
            className="text-sm mt-2 italic"
            style={{ color: "rgba(246,239,227,0.85)" }}
          >
            {reason}
          </p>
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              onClick={onElevate}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                background: "var(--accent-soft, #a85a3a)",
                color: CREAM,
              }}
            >
              elevate this
            </button>
            <button
              type="button"
              onClick={onReject}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                background: "transparent",
                color: "rgba(246,239,227,0.6)",
                border: `1px solid ${DUSK_PANEL.borderColor}`,
              }}
            >
              not this
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
