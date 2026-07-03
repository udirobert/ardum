"use client";

// ShareMatch — the viral loop entry point.
//
// After Mira matches the user, this button lets them share the result.
// It generates a shareable URL with the match ID and copies it to the
// clipboard. The match detail page (/match/[id]) already renders as
// Mira's letter — so when someone opens the shared link, they see
// the same personal, agent-driven experience.
//
// The share text is written in Mira's voice — warm, personal, and
// intriguing enough to click. This is the #1 viral moment: the match
// result is deeply personal and visually rich, and sharing it is a
// natural expression of "this got me."

import { useState } from "react";
import type { MatchResult } from "./types";

type ShareMatchProps = {
  match: MatchResult;
};

export default function ShareMatch({ match }: ShareMatchProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/match/${match.id}`
    : "";

  const shareText = `Mira matched me with ${match.retreatTitle} — ${match.retreatLocation}. An agent that actually explains why. ${shareUrl}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback — select the text for manual copy
      setExpanded(true);
    }
  }

  async function shareNative() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Ardum matched me with ${match.retreatTitle}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed — fall back to copy
      }
    }
    copyLink();
  }

  return (
    <div className="mt-6">
      {/* Collapsed state — the invitation */}
      {!expanded && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={shareNative}
            className="px-4 py-2 rounded-sm border border-[color:var(--accent-soft)] hover:bg-[color:var(--surface)] transition-colors text-sm flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copied ? "Copied!" : "Share your match"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-[color:var(--muted)] hover:text-foreground transition-colors"
          >
            preview
          </button>
        </div>
      )}

      {/* Expanded state — preview the share card */}
      {expanded && (
        <div className="border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card fade-in-up">
          <p className="tag mb-4">share card preview</p>

          {/* The card someone would see */}
          <div className="border border-[color:var(--hairline)] rounded-sm p-6 mb-4">
            <p className="font-serif text-2xl tracking-tight mb-2">
              {match.retreatTitle}
            </p>
            <p className="tag mb-4">{match.retreatLocation}</p>
            <p className="text-sm text-[color:var(--muted)] leading-relaxed italic">
              &ldquo;Mira matched me here. An agent that explains why — not a filter.&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[color:var(--hairline)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]" />
              <span className="tag">matched on Ardum</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={shareNative}
              className="px-4 py-2 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
            >
              {copied ? "Copied!" : "Copy share link"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-[color:var(--muted)] hover:text-foreground transition-colors"
            >
              ← back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
