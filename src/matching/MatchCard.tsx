"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchResult } from "./types";

export default function MatchCard({
  result,
  rank,
}: {
  result: MatchResult;
  rank: number;
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

      <div className="flex flex-wrap items-center gap-4">
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
        <span className="tag break-all">{result.retreatRootHash}</span>
      </div>
    </article>
  );
}
