"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MatchResult } from "./types";

export default function MatchCard({
  result,
  rank,
  attestationCount,
  attestor,
  attestedAt,
}: {
  result: MatchResult;
  rank: number;
  attestationCount?: number;
  attestor?: string;
  attestedAt?: string;
}) {
  const pct = Math.round(result.score * 100);
  const [copied, setCopied] = useState(false);

  async function copyShareLink() {
    // The detail page at /match/[id] is independently shareable — it loads
    // the attestation by rootHash from 0G Storage. So we can copy the URL
    // even from the in-memory session view.
    const url = `${window.location.origin}/match/${result.retreatRootHash}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: select + copy via a temporary textarea.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  // First wallet to attest this retreat — the trust anchor. Shown only when
  // we have it; falls back to the rootHash otherwise.
  const attestorLine = attestor
    ? `attested by ${shortAddress(attestor)}`
    : null;

  return (
    <article className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-8 sm:p-10 fade-in-up">
      <header className="flex items-start justify-between gap-6 mb-6">
        <div>
          <p className="tag mb-2">match #{rank}</p>
          <h3 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
            {result.retreatTitle}
          </h3>
          <p className="text-[color:var(--muted)] mt-1">
            {result.retreatLocation} · {result.durationDays} days · $
            {result.priceUsd.toLocaleString()} · cohort of {result.capacity}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-serif text-4xl tabular-nums">{pct}</p>
          <p className="tag">fit score</p>
        </div>
      </header>

      <p className="font-serif text-xl italic mb-6 leading-snug max-w-prose">
        {result.headline}
      </p>

      <p className="text-[color:var(--muted)] mb-8 max-w-prose">
        {result.retreatDescription}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {result.practiceStyle.map((s) => (
          <span
            key={s}
            className="text-xs px-2.5 py-1 rounded-sm border border-[color:var(--hairline)] text-[color:var(--muted)]"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Link
          href={`/match/${result.id}`}
          className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          See full reasoning →
        </Link>
        <button
          type="button"
          onClick={copyShareLink}
          className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
        >
          {copied ? "✓ copied" : "Copy share link"}
        </button>
        <button
          type="button"
          disabled
          title="Direct booking is the next integration."
          className="px-5 py-2.5 rounded-sm border border-dashed border-[color:var(--hairline)] text-[color:var(--muted)] cursor-not-allowed"
        >
          Book this retreat (soon)
        </button>
      </div>

      <AttestationFooter
        attestationCount={attestationCount}
        attestor={attestorLine}
        attestedAt={attestedAt}
        rootHash={result.retreatRootHash}
      />
    </article>
  );
}

function AttestationFooter({
  attestationCount,
  attestor,
  attestedAt,
  rootHash,
}: {
  attestationCount?: number;
  attestor: string | null;
  attestedAt?: string;
  rootHash: string;
}) {
  return (
    <div className="pt-5 border-t border-[color:var(--hairline)] flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <p className="tag">
        {attestationCount === 1
          ? "1 attestation"
          : `${attestationCount ?? "—"} attestations`}
        {attestor ? ` · ${attestor}` : ""}
      </p>
      {attestedAt && (
        <p className="tag">
          first attested {new Date(attestedAt).toLocaleDateString()}
        </p>
      )}
      <p className="tag break-all ml-auto opacity-70">{rootHash}</p>
    </div>
  );
}

function shortAddress(addr: string): string {
  if (!addr.startsWith("0x") || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
