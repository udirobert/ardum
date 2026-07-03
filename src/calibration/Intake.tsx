"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { INTAKE_STEPS } from "./intakeSteps";
import type {
  EnergyState,
  BudgetBand,
  SocialComfort,
  PoseBaseline,
  PractitionerProfile,
} from "./schema";
import PoseCheck from "./PoseCheck";
import MiraOrb from "@/components/MiraOrb";
import {
  clearFingerprint,
  getFingerprint,
  isRecallable,
  recallAgeLabel,
  setFingerprint,
  STORAGE_KEY as FINGERPRINT_KEY,
  type Fingerprint,
} from "@/lib/fingerprint";

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

export default function Intake() {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [pose, setPose] = useState<PoseBaseline | undefined>(undefined);
  const [runPose, setRunPose] = useState(false);
  const [skippedPose, setSkippedPose] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The recall banner is shown if a stored fingerprint falls inside the
  // 1-30 day window. Read via useSyncExternalStore so localStorage access
  // is registered as external state, not an effect-time side effect.
  const fingerprint = useSyncExternalStore(
    subscribeNoop,
    getFingerprintSnapshot,
    getFingerprintServerSnapshot
  );
  const [recallDismissed, setRecallDismissed] = useState(false);

  const recallVisible = fingerprint && !recallDismissed;

  const currentStep = INTAKE_STEPS[pageIndex];
  const isFinal = pageIndex === INTAKE_STEPS.length;
  const canAdvance =
    isFinal ||
    (currentStep.id === "energy" && answers.energy) ||
    (currentStep.id === "budget" && answers.budget) ||
    (currentStep.id === "social" && answers.social);

  const progress = useMemo(
    () => ({
      current: Math.min(pageIndex + 1, INTAKE_STEPS.length),
      total: INTAKE_STEPS.length + 1, // +1 for the pose/begin step
    }),
    [pageIndex]
  );

  function pick(value: string) {
    if (currentStep.id === "energy") {
      setAnswers((a) => ({ ...a, energy: value as EnergyState }));
    } else if (currentStep.id === "budget") {
      setAnswers((a) => ({ ...a, budget: value as BudgetBand }));
    } else if (currentStep.id === "social") {
      setAnswers((a) => ({ ...a, social: value as SocialComfort }));
    }
  }  function next() {
    if (pageIndex < INTAKE_STEPS.length) {
      setPageIndex(pageIndex + 1);
    }
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

    // Optimistic navigation: generate the sessionId on the client,
    // push the route immediately, and POST the profile in the
    // background. The /api/agent/match/stream endpoint waits a few
    // seconds for the profile to land before erroring, so the GET can
    // race the POST without breaking the flow. Visible savings on first
    // paint of the match page: ~500–1500ms.
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    router.push(`/match?session=${sessionId}`);

    try {
      const profRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, profile }),
      });
      if (!profRes.ok) {
        const body = await profRes.text();
        let message = `The session store didn't accept the profile (HTTP ${profRes.status}).`;
        try {
          const parsed = JSON.parse(body) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          /* body wasn't JSON — fall back to the generic message */
        }
        throw new Error(message);
      }
    } catch (err) {
      console.error(err);
      // Best-effort: surface inline. The user is already on the match
      // page; the stream will eventually 404 and show its own error UI.
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong starting the match."
      );
      setSubmitting(false);
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

  // Keyboard: 1-4 picks an option, Enter advances, Backspace goes back.
  // We attach the listener ONCE and keep the latest values in refs so the
  // handler always sees fresh state without re-subscribing every render.
  const stepRef = useRef(currentStep);
  const canAdvanceRef = useRef(canAdvance);
  const pageIndexRef = useRef(pageIndex);
  const isFinalRef = useRef(isFinal);
  const pickRef = useRef(pick);
  const nextRef = useRef(next);
  const backRef = useRef(back);
  useEffect(() => {
    stepRef.current = currentStep;
    canAdvanceRef.current = canAdvance;
    pageIndexRef.current = pageIndex;
    isFinalRef.current = isFinal;
    pickRef.current = pick;
    nextRef.current = next;
    backRef.current = back;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Global shortcuts (number-key pick, Enter, Backspace) only operate
      // on the discrete-question steps. The final step has a free-form
      // notes textarea and an explicit "begin matching" button, so we
      // intentionally leave the keys to native behavior there.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (pageIndexRef.current >= INTAKE_STEPS.length) return;
      const step = stepRef.current;
      if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        const opt = step.options[idx];
        if (opt) pickRef.current(opt.value);
      } else if (e.key === "Enter" && canAdvanceRef.current) {
        nextRef.current();
      } else if (e.key === "Backspace" && pageIndexRef.current > 0) {
        backRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-12 sm:pt-20 pb-24">
      <ProgressBar current={progress.current} total={progress.total} />

      {recallVisible && fingerprint && (
        <RecallBanner
          fingerprint={fingerprint}
          onUse={useRecallAnswers}
          onStartOver={startFresh}
          onClear={clearAndStart}
        />
      )}

      <div className="t-page-slide relative min-h-[60vh]" data-page={pageIndex + 1}>
        {INTAKE_STEPS.map((step, i) => (
          <div key={step.id} className="t-page" data-page-id={i + 1}>
            {/* Mira — the guide present at every step */}
            <div className="flex items-center gap-4 mb-8">
              <MiraOrb size={44} state="speaking" />
              <div>
                <p className="font-serif text-xl tracking-tight">Mira</p>
                <p className="tag">your guide</p>
              </div>
            </div>
            <p className="text-lg leading-relaxed text-foreground mb-8 max-w-prose mira-line">
              {step.mira}
            </p>

            <p className="tag mb-6">
              step {i + 1} of {INTAKE_STEPS.length + 1}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-3">
              {step.prompt}
            </h1>
            <p className="text-[color:var(--muted)] text-lg mb-10">
              {step.sub}
            </p>
            <p className="why mb-10 max-w-prose">{step.why}</p>

            <ul className="flex flex-col gap-2">
              {step.options.map((opt, j) => {
                const selected = answers[step.id] === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => pick(opt.value)}
                      className={`w-full text-left px-5 py-4 rounded-sm border transition-colors hover-lift ${
                        selected
                          ? "border-[color:var(--accent)] bg-[color:var(--surface)]"
                          : "border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] hover:bg-[color:var(--surface)]"
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

            <div className="flex items-center justify-between mt-12">
              <button
                type="button"
                onClick={back}
                disabled={i === 0}
                className="text-[color:var(--muted)] disabled:opacity-30 hover:text-foreground transition-colors"
              >
                ← back
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!answers[step.id]}
                className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-30 hover:bg-[color:var(--accent-ink)] transition-colors"
              >
                continue →
              </button>
            </div>
            <p className="tag mt-6">
              press 1–4 to choose · enter to continue
            </p>
          </div>
        ))}

        <div className="t-page" data-page-id={INTAKE_STEPS.length + 1}>
          {/* Mira — guiding the final step */}
          <div className="flex items-center gap-4 mb-8">
            <MiraOrb size={44} state="calm" />
            <div>
              <p className="font-serif text-xl tracking-tight">Mira</p>
              <p className="tag">your guide</p>
            </div>
          </div>
          <p className="text-lg leading-relaxed text-foreground mb-8 max-w-prose mira-line">
            I have what I need. This last step is optional — a five-second
            posture sample gives me a real baseline to reason from. Your
            camera frames never leave this browser tab.
          </p>

          <p className="tag mb-6">
            step {INTAKE_STEPS.length + 1} of {INTAKE_STEPS.length + 1}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-3">
            One last thing — optional.
          </h1>
          <p className="text-[color:var(--muted)] text-lg mb-10 max-w-prose">
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
    </section>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-16">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-px flex-1 transition-colors ${
            i < current
              ? "bg-[color:var(--accent)]"
              : "bg-[color:var(--hairline)]"
          }`}
        />
      ))}
    </div>
  );
}

// The welcome-back banner. Three explicit actions so the user is never
// surprised by an auto-applied profile.
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
        <em>{social}</em>. Still true? Nothing leaves your browser — this
        memory lives only in this tab.
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
