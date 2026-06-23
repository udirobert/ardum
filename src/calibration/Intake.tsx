"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// The intake is a conversation: one question per screen, "why" copy visible,
// progress as a quiet detail. Not a quiz.

type IntakeAnswers = Partial<
  Pick<PractitionerProfile, "energy" | "budget" | "social">
>;

export default function Intake() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [pose, setPose] = useState<PoseBaseline | undefined>(undefined);
  const [runPose, setRunPose] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentStep = INTAKE_STEPS[stepIndex];
  const isFinal = stepIndex === INTAKE_STEPS.length;
  const canAdvance =
    isFinal ||
    (currentStep.id === "energy" && answers.energy) ||
    (currentStep.id === "budget" && answers.budget) ||
    (currentStep.id === "social" && answers.social);

  const progress = useMemo(
    () => ({
      current: Math.min(stepIndex + 1, INTAKE_STEPS.length),
      total: INTAKE_STEPS.length + 1, // +1 for the pose/begin step
    }),
    [stepIndex]
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
    if (stepIndex < INTAKE_STEPS.length) setStepIndex((i) => i + 1);
  }

  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  async function beginMatching() {
    if (!answers.energy || !answers.budget || !answers.social) return;
    setSubmitting(true);
    try {
      const profile: PractitionerProfile = {
        energy: answers.energy,
        budget: answers.budget,
        social: answers.social,
        pose,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      // Save the profile and hand off to the match page. The page opens an
      // SSE stream to /api/agent/match/stream — the agent "thinks out loud"
      // there, step by step, in real time.
      const profRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const { sessionId } = await profRes.json();
      router.push(`/match?session=${sessionId}`);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  }

  // Keyboard: 1-4 picks an option, Enter advances, Backspace goes back.
  // We attach the listener ONCE and keep the latest values in refs so the
  // handler always sees fresh state without re-subscribing every render.
  const stepRef = useRef(currentStep);
  const canAdvanceRef = useRef(canAdvance);
  const stepIndexRef = useRef(stepIndex);
  const isFinalRef = useRef(isFinal);
  const pickRef = useRef(pick);
  const nextRef = useRef(next);
  const backRef = useRef(back);
  useEffect(() => {
    stepRef.current = currentStep;
    canAdvanceRef.current = canAdvance;
    stepIndexRef.current = stepIndex;
    isFinalRef.current = isFinal;
    pickRef.current = pick;
    nextRef.current = next;
    backRef.current = back;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore key events when the user is typing in a text field.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (isFinalRef.current) return;
      const step = stepRef.current;
      if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        const opt = step.options[idx];
        if (opt) pickRef.current(opt.value);
      } else if (e.key === "Enter" && canAdvanceRef.current) {
        nextRef.current();
      } else if (e.key === "Backspace" && stepIndexRef.current > 0) {
        backRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-12 sm:pt-20 pb-24">
      <ProgressBar current={progress.current} total={progress.total} />

      {!isFinal && (
        <div className="fade-in-up" key={currentStep.id}>
          <p className="tag mb-6">
            step {progress.current} of {progress.total}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-3">
            {currentStep.prompt}
          </h1>
          <p className="text-[color:var(--muted)] text-lg mb-10">
            {currentStep.sub}
          </p>
          <p className="why mb-10 max-w-prose">{currentStep.why}</p>

          <ul className="flex flex-col gap-2">
            {currentStep.options.map((opt, i) => {
              const selected = answers[currentStep.id] === opt.value;
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
                      {i + 1}
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
              disabled={stepIndex === 0}
              className="text-[color:var(--muted)] disabled:opacity-30 hover:text-foreground transition-colors"
            >
              ← back
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!canAdvance}
              className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-30 hover:bg-[color:var(--accent-ink)] transition-colors"
            >
              continue →
            </button>
          </div>
          <p className="tag mt-6">
            press 1–4 to choose · enter to continue
          </p>
        </div>
      )}

      {isFinal && (
        <div className="fade-in-up">
          <p className="tag mb-6">
            step {progress.current} of {progress.total}
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
            onEnable={() => setRunPose(true)}
            onComplete={(baseline) => {
              setPose(baseline);
              setRunPose(false);
            }}
            onSkip={() => setRunPose(false)}
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
              {submitting ? "reasoning…" : "begin matching →"}
            </button>
          </div>
        </div>
      )}
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
