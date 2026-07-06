"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { INTAKE_STEPS, CLOSING_LINE, READING_LINE } from "./intakeSteps";
import type {
  EnergyState,
  BudgetBand,
  SocialComfort,
  PoseBaseline,
  PractitionerProfile,
} from "./schema";
import PoseCheck from "./PoseCheck";
import MiraOrb from "@/components/MiraOrb";
import CloudField from "@/aesthetics/CloudField";
import { intakeAnswersToVector } from "./vector";
import { poseForEnergy } from "@/lib/yoga-poses";
import type { AestheticVector } from "@/aesthetics/image-pool";
import {
  clearFingerprint,
  getFingerprint,
  getOrCreateUserId,
  isRecallable,
  recallAgeLabel,
  setFingerprint,
  STORAGE_KEY as FINGERPRINT_KEY,
  type Fingerprint,
} from "@/lib/fingerprint";

// ── Cognee memory types (client-safe subset) ──────────────────────────────
type CogneeMemory = {
  isReturning: boolean;
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
  provider: string;
  configured: boolean;
};

// External store for the local fingerprint. useSyncExternalStore is
// React 19's idiom for reading browser-only state without triggering the
// "setState in effect" anti-pattern. The snapshot is memoized so two calls
// in the same tick return the same reference — otherwise React's
// referential equality check fails and we loop.
const subscribeNoop = () => () => {};
let cachedRaw: string | null | undefined = undefined;
let cachedFingerprint: Fingerprint | null = null;
const getFingerprintSnapshot = (): Fingerprint | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(FINGERPRINT_KEY);
  if (raw === cachedRaw) return cachedFingerprint;
  cachedRaw = raw;
  const fp = getFingerprint();
  cachedFingerprint = isRecallable(fp) ? fp : null;
  return cachedFingerprint;
};
const getFingerprintServerSnapshot = (): Fingerprint | null => null;

// The intake is a conversation: one question per screen, "why" copy visible,
// progress as a quiet detail. Not a quiz.

type IntakeAnswers = Partial<
  Pick<PractitionerProfile, "energy" | "budget" | "social">
>;

// ── Intake answer → approximate aesthetic vector ──────────────────
// Used to tint the Mira orb's marble veins as the practitioner
// answers each question — one cohesive signal from both audio and visual.
export default function Intake({ active = true }: { active?: boolean }) {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [pose, setPose] = useState<PoseBaseline | undefined>(undefined);
  const [runPose, setRunPose] = useState(false);
  const [skippedPose, setSkippedPose] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The reading moment — a one-time ceremonial pause after all three
  // answers are in. The clouds deepen and Mira speaks before the final
  // step arrives. readingShown prevents it from re-triggering if the
  // user goes back to change an answer.
  const [readingActive, setReadingActive] = useState(false);
  const [readingShown, setReadingShown] = useState(false);
  // The recall banner is shown if a stored fingerprint falls inside the
  // 1-30 day window. Read via useSyncExternalStore so localStorage access
  // is registered as external state, not an effect-time side effect.
  const fingerprint = useSyncExternalStore(
    subscribeNoop,
    getFingerprintSnapshot,
    getFingerprintServerSnapshot
  );
  const [recallDismissed, setRecallDismissed] = useState(false);

  // The transcript flows naturally — no absolutely-positioned pages, so no
  // height measurement is needed. This ref pins the latest turn so we can
  // scroll it into view as the conversation advances.
  const latestTurnRef = useRef<HTMLDivElement>(null);

  // Cognee memory — fetched on mount. If Mira has persistent memory of
  // this practitioner, we show a richer welcome-back banner that
  // references past matches, bookings, and notes. Falls back to the
  // localStorage fingerprint banner when Cognee is not configured.
  const [cogneeMemory, setCogneeMemory] = useState<CogneeMemory | null>(null);
  const userIdRef = useRef<string>("");
  useEffect(() => {
    const id = getOrCreateUserId();
    userIdRef.current = id;
    if (!id) return;
    fetch(`/api/memory?userId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data: CogneeMemory) => setCogneeMemory(data))
      .catch(() => {});
  }, []);

  const hasCogneeMemory =
    cogneeMemory?.isReturning && cogneeMemory.provider !== "none";
  const recallVisible = (fingerprint || hasCogneeMemory) && !recallDismissed;

  // Auto-scroll the latest turn into view when the conversation advances.
  // Skipped during the reading moment (the overlay holds the viewport) and
  // when the intake isn't the active phase. Accounts for the header offset.
  useEffect(() => {
    if (readingActive || !active) return;
    const el = latestTurnRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }, [pageIndex, readingActive, active]);

  const currentStep = INTAKE_STEPS[pageIndex];
  const isFinal = pageIndex === INTAKE_STEPS.length;

  // Live aesthetic vector from intake answers — drives the orb's marble
  // veins AND the cloud field atmosphere. One signal, sound and vision.
  const liveVector = useMemo(
    () => intakeAnswersToVector(answers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers.energy, answers.social]
  );

  // During the reading moment, deepen the vector — push darker, more
  // intimate, calmer — so the clouds visibly settle as Mira reads.
  const atmosphereVector = useMemo<AestheticVector>(() => {
    if (!readingActive) return liveVector;
    return {
      ...liveVector,
      dark: Math.min(1, liveVector.dark + 0.22),
      light: Math.max(0, liveVector.light - 0.22),
      intimate: Math.min(1, liveVector.intimate + 0.18),
      expansive: Math.max(0, liveVector.expansive - 0.18),
      calming: Math.min(1, liveVector.calming + 0.12),
      energizing: Math.max(0, liveVector.energizing - 0.12),
    };
  }, [readingActive, liveVector]);

  // The reading moment auto-dismisses after ~4.2s — the clouds ease back
  // and the final step (pose/notes/begin) arrives.
  useEffect(() => {
    if (!readingActive) return;
    const tid = setTimeout(() => {
      setReadingActive(false);
      setPageIndex(INTAKE_STEPS.length);
    }, 4200);
    return () => clearTimeout(tid);
  }, [readingActive]);

  // Picking an answer is itself the continuation — no separate "continue"
  // button. The answer is set and the conversation advances to the next
  // unanswered step. When all three are answered for the first time, the
  // reading moment triggers instead of jumping straight to the final step.
  // The next-step computation uses the synchronously-built newAnswers so it
  // sees the fresh value without waiting for state to flush.
  function pick(value: string) {
    let newAnswers = answers;
    if (currentStep.id === "energy") {
      newAnswers = { ...answers, energy: value as EnergyState };
      setAnswers(newAnswers);
    } else if (currentStep.id === "budget") {
      newAnswers = { ...answers, budget: value as BudgetBand };
      setAnswers(newAnswers);
    } else if (currentStep.id === "social") {
      newAnswers = { ...answers, social: value as SocialComfort };
      setAnswers(newAnswers);
    }
    const allThree =
      newAnswers.energy && newAnswers.budget && newAnswers.social;
    // First time all three are answered → the reading moment.
    if (allThree && !readingShown) {
      setReadingShown(true);
      setReadingActive(true);
      return;
    }
    const nextUnanswered = INTAKE_STEPS.findIndex(
      (s, i) => i > pageIndex && !newAnswers[s.id]
    );
    setPageIndex(nextUnanswered === -1 ? INTAKE_STEPS.length : nextUnanswered);
  }

  // Jump back to a past step to re-answer it. Later answers stay visible.
  function goToStep(i: number) {
    setPageIndex(i);
  }

  function back() {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
  }

  async function beginMatching() {
    if (!answers.energy || !answers.budget || !answers.social) return;
    setSubmitting(true);
    setSubmitError(null);
    const profile: PractitionerProfile = {
      energy: answers.energy,
      budget: answers.budget,
      social: answers.social,
      pose,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    // Persist a fingerprint for cross-session recall. Pose is included
    // only if a baseline was captured this session. `notes` is excluded
    // — that's the most likely place for personal detail and we want
    // the user to opt back in for that explicitly.
    setFingerprint(profile, pose);

    // Persistent user ID for Cognee memory. This survives across sessions
    // (unlike sessionId which is ephemeral) so Mira can remember the
    // practitioner across infinite visits.
    const userId = getOrCreateUserId();

    // Optimistic navigation: generate the sessionId on the client,
    // push the route immediately, and POST the profile in the
    // background. The stream route reads the profile from the `p`
    // query param (base64-encoded) so it doesn't depend on the
    // session store being available — Supabase may be down or the
    // Edge/Node isolates may not share in-memory state. The POST
    // is still fired for persistence/recall, but the stream doesn't
    // wait on it.
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const profileB64 =
      typeof btoa !== "undefined"
        ? btoa(encodeURIComponent(JSON.stringify(profile)))
        : "";
    router.push(
      `/match?session=${sessionId}&user=${userId}${profileB64 ? `&p=${profileB64}` : ""}`,
    );

    try {
      const profRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, userId, profile }),
      });
      // Best-effort — the stream doesn't depend on this succeeding
      // because the profile is passed via the `p` query param.
      if (!profRes.ok) {
        console.warn(`Profile POST returned ${profRes.status} — stream will use query param fallback.`);
      }
    } catch (err) {
      // Non-fatal — the stream reads the profile from the URL param.
      console.warn("Profile POST failed — stream will use query param fallback.", err);
    }
  }

  // Recall actions -------------------------------------------------------

  function useRecallAnswers() {
    if (!fingerprint) return;
    setAnswers({
      energy: fingerprint.profile.energy,
      budget: fingerprint.profile.budget,
      social: fingerprint.profile.social,
    });
    if (fingerprint.pose) setPose(fingerprint.pose);
    setRecallDismissed(true);
    // Skip straight to the final step (pose + notes + begin).
    setPageIndex(INTAKE_STEPS.length);
  }

  function startFresh() {
    setRecallDismissed(true);
  }

  function clearAndStart() {
    clearFingerprint();
    setRecallDismissed(true);
  }

  // Keyboard: 1-4 picks an option (which auto-advances the conversation),
  // Backspace goes back to re-answer the previous step, Enter on the final
  // step begins matching. We attach the listener ONCE and keep the latest
  // values in refs so the handler always sees fresh state.
  const stepRef = useRef(currentStep);
  const pageIndexRef = useRef(pageIndex);
  const pickRef = useRef(pick);
  const backRef = useRef(back);
  const beginRef = useRef(beginMatching);
  useEffect(() => {
    stepRef.current = currentStep;
    pageIndexRef.current = pageIndex;
    pickRef.current = pick;
    backRef.current = back;
    beginRef.current = beginMatching;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      // Final step: Enter begins matching, Backspace goes back.
      if (pageIndexRef.current >= INTAKE_STEPS.length) {
        if (e.key === "Enter") {
          e.preventDefault();
          beginRef.current();
        } else if (e.key === "Backspace") {
          backRef.current();
        }
        return;
      }
      const step = stepRef.current;
      if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        const opt = step.options[idx];
        if (opt) pickRef.current(opt.value);
      } else if (e.key === "Backspace" && pageIndexRef.current > 0) {
        backRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full">
      {/*
        The Reading — a continuous cloud atmosphere behind the conversation,
        driven by the same preference vector that drives the orb's marble
        veins. The atmosphere shifts as each answer arrives; the reading
        happens in the air, not as a separate detour. Only mounted when the
        intake is the active phase (avoids a wasted WebGL context during
        the arrival screen).
      */}
      {active && (
        <>
          <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
            <CloudField
              vector={atmosphereVector}
              variant="backdrop"
              className="w-full h-full"
            />
          </div>
          {/* Cream wash for content readability — strong behind the text
              column so buttons and text are always legible, fading only at
              the far edges so the clouds remain visible. */}
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 75% 90% at 50% 35%, rgba(246,241,231,0.88) 0%, rgba(246,241,231,0.62) 50%, rgba(246,241,231,0.32) 85%)",
            }}
          />
        </>
      )}

      {/*
        The reading moment — a one-time ceremonial overlay after all three
        answers. The clouds have deepened (atmosphereVector); Mira's orb is
        centered and her line fades in. Holds for ~4s before the final step.
      */}
      {readingActive && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center min-h-[70vh] px-6"
          style={{ animation: "fade-in-up 600ms var(--ease-ardum) both" }}
        >
          <div
            className="absolute inset-0 bg-[color:var(--background)]/30"
            aria-hidden
          />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div
              className="mb-8"
              style={{
                filter: "drop-shadow(0 0 48px rgba(168,90,58,0.28))",
              }}
            >
              <MiraOrb
                size={88}
                state="thinking"
                aestheticVector={atmosphereVector}
              />
            </div>
            <p
              className="font-serif text-2xl sm:text-3xl leading-[1.3] tracking-tight text-foreground max-w-md mira-line"
            >
              {READING_LINE}
            </p>
            <div className="flex items-center gap-2 mt-8">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft"
              />
              <span className="tag">reading…</span>
            </div>
          </div>
        </div>
      )}

    <section className="relative z-10 mx-auto w-full max-w-2xl px-6 sm:px-10 pt-12 sm:pt-20 pb-24">

      {recallVisible && hasCogneeMemory && cogneeMemory && (
        <CogneeRecallBanner
          memory={cogneeMemory}
          fingerprint={fingerprint}
          onUse={useRecallAnswers}
          onStartOver={startFresh}
          onClear={clearAndStart}
        />
      )}

      {recallVisible && !hasCogneeMemory && fingerprint && (
        <RecallBanner
          fingerprint={fingerprint}
          onUse={useRecallAnswers}
          onStartOver={startFresh}
          onClear={clearAndStart}
        />
      )}

      {/* First-visit intro — Mira sets the expectation that she remembers.
          Shown only when there's no recall banner and we're at the start. */}
      {!recallVisible && !hasCogneeMemory && pageIndex === 0 && cogneeMemory && (
        <FirstVisitIntro configured={cogneeMemory.configured} />
      )}

      {/*
        The conversation transcript. Completed turns (Mira's question, your
        answer, Mira's acknowledgement) stay visible and accumulate; the
        active question sits at the bottom. No step counter, no progress
        bar — Mira knows where you are.
      */}
      <div className="mt-4">
        {INTAKE_STEPS.map((step, i) => {
          const isAnswered = !!answers[step.id];
          const isActive = i === pageIndex;
          // A step renders if it's been answered OR it's the active step.
          // Future unanswered steps stay hidden until the conversation
          // reaches them. When the user goes back to re-answer an earlier
          // step, later answered steps stay visible with their answer cards.
          if (!isAnswered && !isActive) return null;
          // The active step shows its option list (for first answer or
          // re-answer). Answered non-active steps show the answer card +
          // Mira's acknowledgement + a "change this answer" link.
          const showOptions = isActive;
          const showAnswered = isAnswered && !isActive;
          const selectedOpt = step.options.find((o) => o.value === answers[step.id]);

          return (
            <div key={step.id} className="mb-14 last:mb-0">
              {/* Mira's question turn — orb + her setup line */}
              <div
                ref={isActive && !isFinal ? latestTurnRef : undefined}
                className="flex items-start gap-3 mb-5 fade-in-up"
              >
                <div className="flex-shrink-0 pt-1">
                  <MiraOrb size={36} state="speaking" aestheticVector={liveVector} />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-lg leading-relaxed text-foreground max-w-prose mira-line">
                    {step.mira}
                  </p>
                </div>
              </div>

              {/* The question + options/answer, indented under Mira's turn */}
              <div className="ml-12 sm:ml-14">
                <div className="flex items-start gap-4 mb-3">
                  <h2 className="flex-1 font-serif text-2xl sm:text-3xl leading-[1.15] tracking-tight">
                    {step.prompt}
                  </h2>
                  {step.id === "energy" && (
                    <div
                      aria-hidden
                      className="hidden sm:block flex-shrink-0 w-16 h-16 opacity-25 mix-blend-multiply"
                      style={{ filter: "sepia(60%) hue-rotate(-10deg)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={poseForEnergy("settled").svgUrl}
                        alt=""
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
                <p className="text-[color:var(--muted)] text-base mb-4">{step.sub}</p>

                {/* The "why" as a quiet collapsible — present but not loud. */}
                <details className="mb-6 max-w-prose">
                  <summary className="why cursor-pointer list-none inline hover:text-foreground transition-colors">
                    why I&apos;m asking this
                  </summary>
                  <p className="why mt-2 not-italic">{step.why}</p>
                </details>

                {/* Answered turn: the answer card + Mira's acknowledgement +
                    a quiet "change this answer" link. */}
                {showAnswered && selectedOpt && (
                  <div className="fade-in-up">
                    <div className="border-l-2 border-[color:var(--accent)] pl-4 py-2 mb-5 bg-[color:var(--surface)] rounded-r-sm">
                      <p className="tag mb-0.5">you said</p>
                      <p className="font-serif text-lg tracking-tight">
                        {selectedOpt.label}
                      </p>
                    </div>
                    <div className="flex items-start gap-3 mb-5">
                      <div className="flex-shrink-0 pt-1">
                        <MiraOrb size={28} state="calm" aestheticVector={liveVector} />
                      </div>
                      <p className="text-base leading-relaxed text-[color:var(--muted)] max-w-prose pt-0.5">
                        {selectedOpt.ack}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      className="tag hover:text-foreground transition-colors hover:underline underline-offset-2"
                    >
                      change this answer
                    </button>
                  </div>
                )}

                {/* Active turn: the option list. Picking auto-advances.
                    Solid background so buttons are readable over the cloud
                    field. The gooey filter is dropped — it blurred borders
                    against the clouds and hurt legibility. */}
                {showOptions && (
                  <ul className="flex flex-col gap-2">
                    {step.options.map((opt, j) => {
                      const selected = answers[step.id] === opt.value;
                      return (
                        <li key={opt.value}>
                          <button
                            type="button"
                            onClick={() => pick(opt.value)}
                            className={`w-full text-left px-5 py-4 rounded-sm border transition-all duration-200 hover-lift ${
                              selected
                                ? "border-[color:var(--accent)] bg-[color:var(--surface)] scale-[1.01]"
                                : "border-[color:var(--hairline)] bg-[color:var(--background)] hover:border-[color:var(--accent-soft)] hover:bg-[color:var(--surface)]"
                            }`}
                          >
                            <span className="font-serif text-xl mr-4 text-[color:var(--muted)]">
                              {j + 1}
                            </span>
                            <span className="text-lg">{opt.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}

        {/* The final turn — pose sample + notes + begin matching. */}
        {isFinal && (
          <div ref={latestTurnRef} className="mb-0 fade-in-up">
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 pt-1">
                <MiraOrb size={36} state="calm" aestheticVector={liveVector} />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-lg leading-relaxed text-foreground max-w-prose mira-line">
                  {CLOSING_LINE}
                </p>
              </div>
            </div>

            <div className="ml-12 sm:ml-14">
              <h2 className="font-serif text-2xl sm:text-3xl leading-[1.15] tracking-tight mb-3">
                One last thing — optional.
              </h2>
              <p className="text-[color:var(--muted)] text-base mb-10 max-w-prose">
                A five-second posture sample gives the matching agent a real
                baseline to reason from. Your camera frames never leave this
                browser tab — only the derived signals are sent.
              </p>

              <PoseCheck
                enabled={runPose}
                skipped={skippedPose}
                onEnable={() => {
                  setRunPose(true);
                  setSkippedPose(false);
                }}
                onComplete={(baseline) => {
                  setPose(baseline);
                  setRunPose(false);
                  setSkippedPose(false);
                }}
                onSkip={() => {
                  setRunPose(false);
                  setSkippedPose(true);
                }}
                onUndoSkip={() => setSkippedPose(false)}
                baseline={pose}
              />

              <label className="block mt-10">
                <span className="tag block mb-2">
                  anything else worth saying? (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="a teacher you've worked with, a practice you want to go deeper into, a constraint…"
                  className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-3 focus:border-[color:var(--accent)] outline-none resize-y"
                />
              </label>

              {submitError && (
                <p
                  role="alert"
                  className="mt-8 text-sm text-[color:var(--accent-ink)] fade-in-up max-w-prose"
                >
                  {submitError}
                </p>
              )}

              <div className="flex items-center justify-between mt-12">
                <button
                  type="button"
                  onClick={back}
                  className="text-[color:var(--muted)] hover:text-foreground transition-colors"
                >
                  ← back
                </button>
                <button
                  type="button"
                  onClick={beginMatching}
                  disabled={submitting}
                  className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
                >
                  {submitting ? "I'm reasoning…" : submitError ? "try again →" : "find my retreat →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard hint — quiet, only at the very start of the conversation. */}
        {pageIndex === 0 && !answers.energy && (
          <p className="tag mt-10 opacity-60">
            press 1–4 to choose · backspace to go back
          </p>
        )}
      </div>
    </section>
    </div>
  );
}

// The welcome-back banner for localStorage-only memory. Three explicit
// actions so the user is never surprised by an auto-applied profile.
function RecallBanner({
  fingerprint,
  onUse,
  onStartOver,
  onClear,
}: {
  fingerprint: Fingerprint;
  onUse: () => void;
  onStartOver: () => void;
  onClear: () => void;
}) {
  const age = recallAgeLabel(fingerprint) ?? "a few days ago";
  const { energy, budget, social } = fingerprint.profile;
  return (
    <aside className="mb-10 border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 fade-in-up surface-card">
      <p className="tag mb-2">welcome back</p>
      <h2 className="font-serif text-xl tracking-tight mb-2">
        You were here {age}.
      </h2>
      <p className="why max-w-prose mb-4">
        {age === "yesterday" ? "Yesterday you said" : "Last time you said"}{" "}
        your energy was <em>{energy}</em>, your budget band{" "}
        <em>{budget}</em>, and your social comfort{" "}
        <em>{social}</em>. Still true?
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onUse}
          className="px-4 py-2 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
        >
          Use these answers
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="px-4 py-2 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm"
        >
          Let me change something
        </button>
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2 rounded-sm border border-dashed border-[color:var(--hairline)] text-[color:var(--muted)] hover:text-foreground transition-colors text-sm"
        >
          Clear my history
        </button>
      </div>
    </aside>
  );
}

// The Cognee-powered welcome-back banner. This is the "AI that doesn't
// forget" moment — Mira references past matches, bookings, and notes
// from her persistent graph-vector memory, not just the localStorage
// fingerprint.
function CogneeRecallBanner({
  memory,
  fingerprint,
  onUse,
  onStartOver,
  onClear,
}: {
  memory: CogneeMemory;
  fingerprint: Fingerprint | null;
  onUse: () => void;
  onStartOver: () => void;
  onClear: () => void;
}) {
  const lastBooking = memory.pastBookings[0];
  const lastMatch = memory.pastMatches[0];
  const lastNote = memory.pastNotes[0];
  const energyTrajectory = memory.energyHistory;
  const lastEnergy = energyTrajectory[energyTrajectory.length - 1];

  // Build Mira's recognition line — the thing that makes the user feel
  // genuinely seen, not just recalled from a cookie.
  let recognition = "I remember you.";
  if (lastBooking) {
    recognition = `You've been to ${lastBooking.title} in ${lastBooking.location}.`;
  } else if (lastMatch) {
    recognition = `Last time I recommended ${lastMatch.title} in ${lastMatch.location}.`;
  }

  if (lastEnergy && fingerprint) {
    const energyShifted = lastEnergy !== fingerprint.profile.energy;
    recognition += energyShifted
      ? ` Your energy was ${lastEnergy} then — I see it's shifted to ${fingerprint.profile.energy}.`
      : ` Your energy was ${lastEnergy} then, and it still is.`;
  } else if (lastEnergy) {
    recognition += ` Your energy was ${lastEnergy} last time.`;
  }

  return (
    <aside className="mb-10 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 fade-in-up surface-card">
      <div className="flex items-start gap-4 mb-4">
        <MiraOrb size={40} state="calm" />
        <div className="flex-1">
          <p className="tag mb-1 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"
            />
            Mira remembers you
          </p>
          <h2 className="font-serif text-xl tracking-tight mb-2">
            {recognition}
          </h2>
        </div>
      </div>

      {/* Memory details — the transparency that builds trust */}
      <div className="ml-14 space-y-3 mb-4">
        {lastNote && (
          <p className="why max-w-prose">
            You told me: <em>&ldquo;{lastNote}&rdquo;</em>. I&apos;ve kept that with me.
          </p>
        )}
        {memory.pastMatches.length > 1 && (
          <p className="tag opacity-70">
            {memory.pastMatches.length} past recommendations ·{" "}
            {memory.pastBookings.length} booked
          </p>
        )}
        {energyTrajectory.length > 1 && (
          <p className="tag opacity-70">
            energy trajectory: {energyTrajectory.join(" → ")}
          </p>
        )}
      </div>

      <p className="why max-w-prose mb-4 ml-14">
        {fingerprint
          ? "Your energy, budget, and social comfort from last time are below. Still true?"
          : "Want me to use what I know, or start fresh?"}
      </p>

      <div className="flex flex-wrap gap-3 ml-14">
        <button
          type="button"
          onClick={onUse}
          className="px-4 py-2 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
        >
          Use what you know
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="px-4 py-2 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm"
        >
          Let me change something
        </button>
        <Link
          href="/memory"
          className="px-4 py-2 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm text-[color:var(--muted)] hover:text-foreground"
        >
          See everything I remember →
        </Link>
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2 rounded-sm border border-dashed border-[color:var(--hairline)] text-[color:var(--muted)] hover:text-foreground transition-colors text-sm"
        >
          Forget me
        </button>
      </div>

      <p className="tag mt-4 ml-14 opacity-60">
        powered by Cognee · hybrid graph-vector memory ·{" "}
        <Link href="/memory" className="underline hover:text-foreground">
          what does Mira know?
        </Link>
      </p>
    </aside>
  );
}

// First-visit intro — Mira sets the expectation that she remembers.
// This is the trust-building moment: "I'll remember you, and you can
// see or wipe what I know at any time."
function FirstVisitIntro({ configured }: { configured: boolean }) {
  return (
    <aside className="mb-10 border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-5 fade-in-up">
      <div className="flex items-start gap-3">
        <MiraOrb size={32} state="speaking" />
        <div className="flex-1">
          <p className="text-sm leading-relaxed max-w-prose">
            {configured
              ? "I'm Mira. I'll remember everything you tell me — your energy, your matches, the things you share. The more we work together, the better I'll know you. You can see or wipe what I know at any time."
              : "I'm Mira. I'll remember your answers from last time, right here in your browser. Set up Cognee memory and I'll remember you across devices and sessions, too."}
          </p>
          {configured && (
            <p className="tag mt-2 opacity-60">
              powered by Cognee ·{" "}
              <Link
                href="/memory"
                className="underline hover:text-foreground transition-colors"
              >
                your memory, your control
              </Link>
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
