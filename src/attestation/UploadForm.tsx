"use client";

import { useEffect, useState } from "react";
import WalletButton from "./WalletButton";
import { canonicalAttestationMessage } from "./sign";
import type { Attestation } from "./schema";

// Guided attestation flow. The wallet signs the canonical payload
// (EIP-191 personal_sign) before posting — the server verifies the signature
// recovers to attestation.attestor before handing it to 0G Storage.
//
// Three steps, one question at a time, "why" copy on every step:
//   1. The retreat — title, location, duration, price, capacity
//   2. The practice — description, style, who it fits (multi-select)
//   3. Write it    — optional breath cycle, then sign & write

type PracticeStyle = string;
type EnergyFit = "settled" | "in-movement" | "low" | "sharp";
type SocialFit = "solo" | "small-circle" | "open-circle" | "communal";
type BreathPhase = "shallow" | "even" | "extended" | "dynamic";

const PRACTICE_STYLES = [
  "vinyasa",
  "power vinyasa",
  "hatha",
  "ashtanga",
  "yin",
  "restorative",
  "pranayama",
  "meditation",
  "kriya",
  "breath",
  "strength",
] as const;

const ENERGY_OPTS: { value: EnergyFit; label: string }[] = [
  { value: "settled", label: "Settled" },
  { value: "in-movement", label: "In movement" },
  { value: "low", label: "Low" },
  { value: "sharp", label: "Sharp" },
];

const SOCIAL_OPTS: { value: SocialFit; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "small-circle", label: "Small circle" },
  { value: "open-circle", label: "Open circle" },
  { value: "communal", label: "Communal" },
];

const BREATH_OPTS: { value: BreathPhase; label: string }[] = [
  { value: "shallow", label: "Shallow" },
  { value: "even", label: "Even" },
  { value: "extended", label: "Extended" },
  { value: "dynamic", label: "Dynamic" },
];

export default function UploadForm() {
  const [attestor, setAttestor] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [signingStep, setSigningStep] = useState<string | null>(null);
  const [result, setResult] = useState<{ rootHash: string; storedOn: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — The retreat
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [priceUsd, setPriceUsd] = useState(1800);
  const [capacity, setCapacity] = useState(12);

  // Step 2 — The practice
  const [description, setDescription] = useState("");
  const [practiceStyle, setPracticeStyle] = useState<PracticeStyle[]>([]);
  const [energyFit, setEnergyFit] = useState<EnergyFit[]>([]);
  const [socialFit, setSocialFit] = useState<SocialFit[]>([]);
  const [breathPhase, setBreathPhase] = useState<BreathPhase[]>([]);

  // Step 3 — Optional breath cycle (advanced)
  const [includeCycle, setIncludeCycle] = useState(false);
  const [cycleInhale, setCycleInhale] = useState(4);
  const [cycleRetain, setCycleRetain] = useState(4);
  const [cycleExhale, setCycleExhale] = useState(4);
  const [cycleSustain, setCycleSustain] = useState(0);
  const [cycleRepeat, setCycleRepeat] = useState(8);

  function toggle<T>(arr: T[], value: T, set: (next: T[]) => void) {
    set(
      arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value]
    );
  }

  const canStep1 =
    title.trim().length > 0 &&
    location.trim().length > 0 &&
    durationDays > 0 &&
    priceUsd >= 0 &&
    capacity > 0;
  const canStep2 =
    description.trim().length > 0 &&
    practiceStyle.length > 0 &&
    energyFit.length > 0 &&
    socialFit.length > 0 &&
    breathPhase.length > 0;
  const canWrite = !!attestor && canStep1 && canStep2;

  async function write(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError(null);
    try {
      const rootHash = await deriveRootHash({
        title,
        location,
        durationDays,
        attestor: attestor!,
      });
      const attestation: Attestation = {
        rootHash,
        kind: "retreat",
        title,
        description,
        claims: {
          location,
          durationDays,
          priceUsd,
          capacity,
          practiceStyle,
          energyFit,
          socialFit,
          breathPhase,
          breathCycle: includeCycle
            ? {
                unit: "seconds",
                pre: [{ inhale: cycleInhale, exhale: cycleExhale }],
                cycle: [
                  {
                    repeat: cycleRepeat,
                    inhale: cycleInhale,
                    retain: cycleRetain,
                    exhale: cycleExhale,
                    sustain: cycleSustain,
                  },
                ],
                ratio: `${cycleInhale}:${cycleRetain}:${cycleExhale}:${cycleSustain}`,
              }
            : undefined,
        },
        attestor: attestor!,
        createdAt: new Date().toISOString(),
      };

      setSigningStep("waiting for wallet signature…");
      const message = canonicalAttestationMessage(attestation);
      const signature = await personalSign(message, attestor!);
      setSigningStep(null);

      const res = await fetch("/api/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attestation, signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      setResult(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
      setSigningStep(null);
    }
  }

  // Keyboard: Enter advances, Backspace goes back.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Enter" && step === 0 && canStep1) setStep(1);
      else if (e.key === "Enter" && step === 1 && canStep2) setStep(2);
      else if (e.key === "Backspace" && step > 0 && !submitting) setStep(step - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canStep1, canStep2, submitting]);

  if (result) {
    return (
      <section className="border border-[color:var(--accent-soft)] bg-[color:var(--surface)] rounded-sm p-8 fade-in-up max-w-2xl surface-card">
        <p className="tag mb-1">written · {result.storedOn}</p>
        <h2 className="font-serif text-3xl tracking-tight mb-3">{title}</h2>
        <p className="why mb-3">
          Attested by{" "}
          <span className="tag not-italic">
            {attestor?.slice(0, 6)}…{attestor?.slice(-4)}
          </span>
          . It&apos;s now part of the matching pool.
        </p>
        <p className="tag break-all">{result.rootHash}</p>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setStep(0);
            setTitle("");
            setLocation("");
            setDescription("");
            setPracticeStyle([]);
            setEnergyFit([]);
            setSocialFit([]);
            setBreathPhase([]);
          }}
          className="mt-6 px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors"
        >
          Attest another →
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={write} className="max-w-2xl">
      <ProgressBar step={step} total={3} />

      {step === 0 && (
        <div className="fade-in-up" key="step-0">
          <p className="tag mb-6">step 1 of 3 · the retreat</p>
          <h2 className="font-serif text-4xl tracking-tight leading-tight mb-3">
            Where is the retreat?
          </h2>
          <p className="why mb-8 max-w-prose">
            We need the basics so practitioners can find it. Title is the
            name the retreat goes by; location is the place, not the
            country.
          </p>

          <div className="space-y-5">
            <Field label="title">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sidemen Restoration Retreat"
                className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
              />
            </Field>
            <Field label="location">
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Sidemen, Bali"
                className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="duration (days)">
                <input
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
                />
              </Field>
              <Field label="price (USD)">
                <input
                  type="number"
                  min={0}
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(Number(e.target.value))}
                  className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
                />
              </Field>
              <Field label="capacity">
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center justify-between mt-10">
            <span />
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!canStep1}
              className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-30 hover:bg-[color:var(--accent-ink)] transition-colors"
            >
              continue →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="fade-in-up" key="step-1">
          <p className="tag mb-6">step 2 of 3 · the practice</p>
          <h2 className="font-serif text-4xl tracking-tight leading-tight mb-3">
            What was the practice like?
          </h2>
          <p className="why mb-8 max-w-prose">
            The more honestly you describe who it suits, the better the
            agent can match it. Multi-select everywhere — most retreats fit
            several kinds of practitioners.
          </p>

          <div className="space-y-6">
            <Field label="description">
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One paragraph. The shape of the days, what makes it distinctive, who it isn't for."
                className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none resize-y"
              />
            </Field>

            <ChipRow
              label="practice style"
              why="Agents reason over structured tags, not prose. Pick everything that genuinely applies."
              options={PRACTICE_STYLES.map((s) => ({ value: s, label: s }))}
              selected={practiceStyle}
              onToggle={(v) => toggle(practiceStyle, v, setPracticeStyle)}
            />

            <ChipRow
              label="energy fit"
              why="Energy state is the strongest single signal. Be generous — settled is the most common fit."
              options={ENERGY_OPTS}
              selected={energyFit}
              onToggle={(v) => toggle(energyFit, v as EnergyFit, setEnergyFit)}
            />

            <ChipRow
              label="social fit"
              why="Cohort shape is the most over-looked signal. 'Solo' doesn't mean 'lonely' — it means 'small or silent'."
              options={SOCIAL_OPTS}
              selected={socialFit}
              onToggle={(v) => toggle(socialFit, v as SocialFit, setSocialFit)}
            />

            <ChipRow
              label="breath phase"
              why="What breathwork register does the retreat operate in? Most retreats sit in 1–2 of these."
              options={BREATH_OPTS}
              selected={breathPhase}
              onToggle={(v) =>
                toggle(breathPhase, v as BreathPhase, setBreathPhase)
              }
            />
          </div>

          <div className="flex items-center justify-between mt-10">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="text-[color:var(--muted)] hover:text-foreground transition-colors"
            >
              ← back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canStep2}
              className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-30 hover:bg-[color:var(--accent-ink)] transition-colors"
            >
              continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fade-in-up" key="step-2">
          <p className="tag mb-6">step 3 of 3 · write it</p>
          <h2 className="font-serif text-4xl tracking-tight leading-tight mb-3">
            Sign and write to 0G Storage.
          </h2>
          <p className="why mb-8 max-w-prose">
            Your wallet signature proves you wrote this claim. The server
            verifies the signature before storing anything.
          </p>

          <div className="mb-8">
            <p className="tag mb-2">attestor</p>
            <WalletButton onConnect={setAttestor} />
          </div>

          <details className="mb-8 border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] surface-card">
            <summary className="cursor-pointer px-5 py-3 select-none">
              <span className="tag">
                Optional · add a breath cycle (advanced)
              </span>
            </summary>
            <div className="px-5 pb-5 pt-2 space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeCycle}
                  onChange={(e) => setIncludeCycle(e.target.checked)}
                />
                <span className="text-sm">
                  Include a structured breath cycle (Nafas-shaped)
                </span>
              </label>
              {includeCycle && (
                <div className="grid grid-cols-5 gap-3">
                  <Field label="inhale (s)">
                    <input
                      type="number"
                      min={0}
                      value={cycleInhale}
                      onChange={(e) =>
                        setCycleInhale(Number(e.target.value))
                      }
                      className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-3 py-2 focus:border-[color:var(--accent)] outline-none"
                    />
                  </Field>
                  <Field label="retain (s)">
                    <input
                      type="number"
                      min={0}
                      value={cycleRetain}
                      onChange={(e) =>
                        setCycleRetain(Number(e.target.value))
                      }
                      className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-3 py-2 focus:border-[color:var(--accent)] outline-none"
                    />
                  </Field>
                  <Field label="exhale (s)">
                    <input
                      type="number"
                      min={0}
                      value={cycleExhale}
                      onChange={(e) =>
                        setCycleExhale(Number(e.target.value))
                      }
                      className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-3 py-2 focus:border-[color:var(--accent)] outline-none"
                    />
                  </Field>
                  <Field label="sustain (s)">
                    <input
                      type="number"
                      min={0}
                      value={cycleSustain}
                      onChange={(e) =>
                        setCycleSustain(Number(e.target.value))
                      }
                      className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-3 py-2 focus:border-[color:var(--accent)] outline-none"
                    />
                  </Field>
                  <Field label="repeats">
                    <input
                      type="number"
                      min={1}
                      value={cycleRepeat}
                      onChange={(e) =>
                        setCycleRepeat(Number(e.target.value))
                      }
                      className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-3 py-2 focus:border-[color:var(--accent)] outline-none"
                    />
                  </Field>
                </div>
              )}
            </div>
          </details>

          {error && (
            <p className="text-[color:var(--accent-ink)] text-sm mb-4">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-[color:var(--muted)] hover:text-foreground transition-colors"
            >
              ← back
            </button>
            <button
              type="submit"
              disabled={!canWrite || submitting}
              className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
            >
              {signingStep
                ? "signing…"
                : submitting
                ? "writing…"
                : "Sign & write attestation →"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-12">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-px flex-1 transition-colors ${
            i <= step ? "bg-[color:var(--accent)]" : "bg-[color:var(--hairline)]"
          }`}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="tag block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ChipRow<T extends string>({
  label,
  why,
  options,
  selected,
  onToggle,
}: {
  label: string;
  why: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="tag">{label}</span>
      </div>
      <p className="why mb-3 max-w-prose">{why}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`text-sm px-3 py-1.5 rounded-sm border transition-colors ${
                on
                  ? "border-[color:var(--accent)] bg-[color:var(--surface)] text-foreground"
                  : "border-[color:var(--hairline)] text-[color:var(--muted)] hover:border-[color:var(--accent-soft)] hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function deriveRootHash({
  title,
  location,
  durationDays,
  attestor,
}: {
  title: string;
  location: string;
  durationDays: number;
  attestor: string;
}): Promise<string> {
  const payload = `${title}|${location}|${durationDays}|${attestor}|${Date.now()}`;
  const buf = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0g-${hex.slice(0, 32)}`;
}

// EIP-191 personal_sign via the injected wallet. Returns the 0x-prefixed
// signature. Throws on user rejection.
async function personalSign(
  message: string,
  account: string
): Promise<string> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No injected wallet.");
  return (await eth.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;
}
