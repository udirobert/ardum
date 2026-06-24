"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchResult } from "./types";

export default function MatchCard({
  result,
  rank,
  attestationCount,
  attestor,
  attestedAt,
  compact,
  agentTrace,
}: {
  result: MatchResult;
  rank: number;
  attestationCount?: number;
  attestor?: string;
  attestedAt?: string;
  compact?: boolean;
  agentTrace?: MatchRunAgentTrace;
}) {
  const pct = Math.round(result.score * 100);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copyShareLink() {
    const url = `${window.location.origin}/match/${result.retreatRootHash}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
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

  const attestorLine = attestor
    ? `attested by ${shortAddress(attestor)}`
    : null;

  if (compact && !expanded) {
    return (
      <article className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 fade-in-up hover-lift surface-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="tag mb-1">match #{rank}</p>
            <h3 className="font-serif text-xl tracking-tight leading-tight truncate">
              {result.retreatTitle}
            </h3>
            <p className="text-sm text-[color:var(--muted)] mt-0.5 truncate">
              {result.retreatLocation} &middot; {result.durationDays} days
              &middot; ${result.priceUsd.toLocaleString()} &middot; cohort of {result.capacity}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-serif text-2xl tabular-nums">{pct}</p>
            <p className="tag">fit score</p>
          </div>
        </div>

        <p className="text-sm italic text-[color:var(--accent-ink)] mt-3 leading-snug max-w-prose">
          {result.headline}
        </p>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs px-3 py-1.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
          >
            See full reasoning &rarr;
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className="text-xs px-3 py-1.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
          >
            {copied ? "\u2713 copied" : "Copy share link"}
          </button>
        </div>

        {agentTrace && (
          <p className="tag mt-4 opacity-70">
            <AgentTraceLine trace={agentTrace} />
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-8 sm:p-10 fade-in-up hover-lift surface-card">
      <header className="flex items-start justify-between gap-6 mb-6">
        <div>
          <p className="tag mb-2">match #{rank}</p>
          <h3 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
            {result.retreatTitle}
          </h3>
          <p className="text-[color:var(--muted)] mt-1">
            {result.retreatLocation} &middot; {result.durationDays} days &middot; $
            {result.priceUsd.toLocaleString()} &middot; cohort of {result.capacity}
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

      {(!compact || expanded) && (
        <>
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
        </>
      )}

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Link
          href={`/match/${result.id}`}
          className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          See full reasoning &rarr;
        </Link>
        <button
          type="button"
          onClick={copyShareLink}
          className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
        >
          {copied ? "\u2713 copied" : "Copy share link"}
        </button>
        <a
          href={`mailto:?subject=Ardum match: ${encodeURIComponent(result.retreatTitle)}&body=I found a retreat match on Ardum: ${encodeURIComponent(result.retreatTitle)} in ${encodeURIComponent(result.retreatLocation)} (${result.durationDays} days, $${result.priceUsd}). Full reasoning: ${typeof window !== "undefined" ? window.location.origin : "https://ardum.vercel.app"}/match/${encodeURIComponent(result.id)}`}
          className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
        >
          Share via email
        </a>
      </div>

      <AttestationFooter
        attestationCount={attestationCount}
        attestor={attestorLine}
        attestedAt={attestedAt}
        rootHash={result.retreatRootHash}
      />

      {agentTrace && (
        <p className="tag mt-4 opacity-70">
          <AgentTraceLine trace={agentTrace} />
        </p>
      )}
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
          : `${attestationCount ?? "\u2014"} attestations`}
        {attestor ? ` \u00b7 ${attestor}` : ""}
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
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

// Local re-export of the agent trace shape — kept loose to avoid a circular
// import with the types module. The provider union matches matching/types.ts.
type MatchRunAgentTrace = {
  provider: "0g-compute" | "local" | "0g-compute-fallback";
  model?: string;
  promptVersion: string;
};

function AgentTraceLine({ trace }: { trace: MatchRunAgentTrace }) {
  const isLocal = trace.provider === "local" || trace.provider === "0g-compute-fallback";
  const subject = isLocal
    ? "local scorer"
    : `${trace.model ?? trace.provider}`;
  const note =
    trace.provider === "0g-compute-fallback"
      ? " (0G Compute unavailable)"
      : "";
  return (
    <>
      agent &middot; {subject}{note} &middot; prompt {trace.promptVersion}
    </>
  );
}
