"use client";

import { useState } from "react";
import WalletButton from "./WalletButton";
import type { Attestation } from "./schema";

// A minimal attestation write form. In v0 the form just collects the
// fields and POSTs to /api/attestations; the SDK upload runs server-side
// and the wallet is recorded as the attestor.

export default function UploadForm() {
  const [attestor, setAttestor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ rootHash: string; storedOn: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [priceUsd, setPriceUsd] = useState(1800);
  const [capacity, setCapacity] = useState(12);
  const [practiceStyle, setPracticeStyle] = useState("vinyasa, meditation");
  const [energyFit, setEnergyFit] = useState("settled, low");
  const [socialFit, setSocialFit] = useState("solo, small-circle");
  const [breathPhase, setBreathPhase] = useState("extended, even");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!attestor) {
      setError("Connect a wallet first — attestations are signed by it.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const rootHash = await deriveRootHash({
        title,
        location,
        durationDays,
        attestor,
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
          practiceStyle: practiceStyle.split(",").map((s) => s.trim()).filter(Boolean),
          energyFit: energyFit.split(",").map((s) => s.trim()).filter(Boolean),
          socialFit: socialFit.split(",").map((s) => s.trim()).filter(Boolean),
          breathPhase: breathPhase.split(",").map((s) => s.trim()).filter(Boolean),
        },
        attestor,
        createdAt: new Date().toISOString(),
      };
      const res = await fetch("/api/attestations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attestation }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      setResult(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 max-w-xl">
      <div>
        <p className="tag mb-2">attestor</p>
        <WalletButton onConnect={setAttestor} />
      </div>

      <Field label="title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
        />
      </Field>

      <Field label="description">
        <textarea
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none resize-y"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="location">
          <input
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
          />
        </Field>
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

      <Field label="practice style (comma-separated)">
        <input
          value={practiceStyle}
          onChange={(e) => setPracticeStyle(e.target.value)}
          className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
        />
      </Field>

      <Field label="energy fit (comma-separated)">
        <input
          value={energyFit}
          onChange={(e) => setEnergyFit(e.target.value)}
          className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
        />
      </Field>

      <Field label="social fit (comma-separated)">
        <input
          value={socialFit}
          onChange={(e) => setSocialFit(e.target.value)}
          className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
        />
      </Field>

      <Field label="breath phase (comma-separated)">
        <input
          value={breathPhase}
          onChange={(e) => setBreathPhase(e.target.value)}
          className="w-full bg-transparent border border-[color:var(--hairline)] rounded-sm px-4 py-2.5 focus:border-[color:var(--accent)] outline-none"
        />
      </Field>

      {error && (
        <p className="text-[color:var(--accent-ink)] text-sm">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="why max-w-md">
          Attestations are stored on 0G Storage. The wallet signature
          proves who wrote this claim.
        </p>
        <button
          type="submit"
          disabled={submitting || !attestor}
          className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          {submitting ? "writing…" : "Write attestation →"}
        </button>
      </div>

      {result && (
        <div className="border border-[color:var(--accent-soft)] bg-[color:var(--surface)] rounded-sm p-5 fade-in-up">
          <p className="tag mb-1">written · {result.storedOn}</p>
          <p className="font-serif text-xl">{title}</p>
          <p className="tag mt-2 break-all">{result.rootHash}</p>
        </div>
      )}
    </form>
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

// In production the rootHash comes from the 0G Storage SDK after upload —
// it's the content-addressed identifier. For v0 we derive a stable hash
// locally so the demo can run without keys.
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
