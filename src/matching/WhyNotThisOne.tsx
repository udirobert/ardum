"use client";

// WhyNotThisOne — interactive counterfactual via Mira dialogue.
//
// The user can ask Mira why a specific retreat wasn't recommended.
// Mira explains the scoring gap in natural language, referencing
// the same axes that drove the original match.
//
// This makes the agent's reasoning fully transparent and interactive.
// Instead of static counterfactual presets, the user drives the
// inquiry — they pick the retreat they're curious about, and Mira
// explains the gap.

import { useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import type { MatchResult } from "./types";

type WhyNotThisOneProps = {
  /** The retreat that was recommended (top match) */
  topMatch: MatchResult;
  /** All other retreats the user could ask about */
  otherRetreats: MatchResult[];
  /** Session ID for counterfactual API calls */
  sessionId: string;
  /** Persistent user ID for Cognee memory feedback */
  userId?: string;
};

type ExplanationState =
  | { status: "idle" }
  | { status: "asking"; retreatId: string }
  | {
      status: "answered";
      retreatId: string;
      retreatTitle: string;
      topScore: number;
      askedScore: number;
      gap: number;
      reasons: string[];
    }
  | { status: "error"; message: string };

export default function WhyNotThisOne({
  topMatch,
  otherRetreats,
  sessionId,
  userId,
}: WhyNotThisOneProps) {
  const [state, setState] = useState<ExplanationState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  async function askWhy(retreat: MatchResult) {
    setState({ status: "asking", retreatId: retreat.id });

    try {
      // Use the counterfactual API to get the full ranking under
      // different weight presets. We compare the asked retreat's
      // score to the top match's score to explain the gap.
      const responses = await Promise.all(
        ["energy", "social", "budget"].map(async (preset) => {
          const res = await fetch("/api/agent/match/counterfactual", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId, preset }),
          });
          if (!res.ok) return null;
          return res.json();
        }),
      );

      // Find the asked retreat's score under each preset
      const reasons: string[] = [];
      const askedScore = retreat.score;
      const topScore = topMatch.score;

      for (let i = 0; i < responses.length; i++) {
        const data = responses[i];
        if (!data) continue;
        const presetName = ["energy", "social comfort", "budget"][i];
        const askedEntry = data.ranked?.find(
          (r: { id: string }) => r.id === retreat.id,
        );
        const topEntry = data.ranked?.find(
          (r: { id: string }) => r.id === topMatch.id,
        );

        if (askedEntry && topEntry) {
          const gap = topEntry.score - askedEntry.score;
          if (gap < 0.02) {
            reasons.push(
              `Under ${presetName}-heavy weighting, ${retreat.retreatTitle} nearly ties with ${topMatch.retreatTitle} (gap: ${gap.toFixed(3)}). If ${presetName} matters most to you, this retreat is a close alternative.`,
            );
          } else if (gap > 0.1) {
            reasons.push(
              `Even when ${presetName} is weighted heavily, ${retreat.retreatTitle} stays behind by ${gap.toFixed(3)} points. The gap isn't about ${presetName}.`,
            );
          } else {
            reasons.push(
              `Under ${presetName}-heavy weighting, the gap narrows to ${gap.toFixed(3)}. ${presetName.charAt(0).toUpperCase() + presetName.slice(1)} is part of why I preferred ${topMatch.retreatTitle}, but not the whole story.`,
            );
          }
        }
      }

      // Add a summary reason
      const overallGap = topScore - askedScore;
      if (overallGap > 0.15) {
        reasons.unshift(
          `The overall gap was ${overallGap.toFixed(3)} points. That's a meaningful difference — I'm confident in the recommendation.`,
        );
      } else if (overallGap > 0.05) {
        reasons.unshift(
          `The overall gap was only ${overallGap.toFixed(3)} points. ${retreat.retreatTitle} was a close second — your preferences could shift either way.`,
        );
      } else {
        reasons.unshift(
          `The gap was just ${overallGap.toFixed(3)} points. Honestly, either retreat would serve you well. I picked ${topMatch.retreatTitle} because of the combined signal, but it's close.`,
        );
      }

      setState({
        status: "answered",
        retreatId: retreat.id,
        retreatTitle: retreat.retreatTitle,
        topScore,
        askedScore,
        gap: overallGap,
        reasons,
      });

      // Fire-and-forget: store the curiosity signal in Cognee memory
      // and trigger improve(). Mira learns what the user is curious
      // about — "they asked why X wasn't recommended" — so future
      // matches can account for that interest.
      if (userId) {
        fetch("/api/memory/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId,
            type: "why-not",
            description: `Practitioner asked why ${retreat.retreatTitle} wasn't recommended instead of ${topMatch.retreatTitle}. Gap was ${overallGap.toFixed(3)}.`,
            details: {
              asked: retreat.retreatTitle,
              top: topMatch.retreatTitle,
              gap: overallGap.toFixed(3),
            },
          }),
        }).catch(() => {});
      }
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Couldn't reason about that.",
      });
    }
  }

  // ── Collapsed state — the invitation to ask ────────────────────────
  if (!expanded) {
    return (
      <div className="mt-8 border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
        <div className="flex items-start gap-4">
          <MiraOrb size={40} state="calm" className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="text-sm leading-relaxed mb-3">
              Curious about another retreat? Ask me why I didn&apos;t recommend it.
            </p>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm text-[color:var(--accent)] hover:text-[color:var(--accent-ink)] transition-colors"
            >
              Why not this one? →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded state — pick a retreat + see explanation ──────────────
  return (
    <div className="mt-8 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
      <div className="flex items-start gap-4 mb-6">
        <MiraOrb size={40} state="speaking" className="flex-shrink-0 mt-1" />
        <div className="flex-1">
          <p className="text-sm leading-relaxed mb-4">
            Pick a retreat and I&apos;ll explain the gap.
          </p>
          <div className="flex flex-wrap gap-2">
            {otherRetreats.map((retreat) => (
              <button
                key={retreat.id}
                type="button"
                onClick={() => askWhy(retreat)}
                disabled={state.status === "asking"}
                className={`px-3 py-1.5 rounded-sm text-xs border transition-colors ${
                  state.status === "answered" && state.retreatId === retreat.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-background"
                    : "border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] text-[color:var(--muted)] hover:text-foreground"
                }`}
              >
                {retreat.retreatTitle}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Asking state */}
      {state.status === "asking" && (
        <div className="flex items-center gap-3 ml-14">
          <MiraOrb size={24} state="thinking" />
          <span className="tag">Reasoning through the gap…</span>
        </div>
      )}

      {/* Answered state — Mira's explanation */}
      {state.status === "answered" && (
        <div className="ml-14 fade-in-up">
          <div className="flex items-start gap-3 mb-4">
            <MiraOrb size={32} state="speaking" className="flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              {state.reasons.map((reason, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
                >
                  {reason}
                </p>
              ))}
            </div>
          </div>

          {/* Score visualization */}
          <div className="mt-6 ml-11">
            <div className="flex items-center gap-4 mb-2">
              <span className="tag w-32">{topMatch.retreatTitle}</span>
              <div className="flex-1 h-2 bg-[color:var(--hairline)] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[color:var(--accent)]"
                  style={{ width: `${state.topScore * 100}%` }}
                />
              </div>
              <span className="tag tabular-nums">{state.topScore.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="tag w-32">{state.retreatTitle}</span>
              <div className="flex-1 h-2 bg-[color:var(--hairline)] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[color:var(--accent-soft)]"
                  style={{ width: `${state.askedScore * 100}%` }}
                />
              </div>
              <span className="tag tabular-nums">{state.askedScore.toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {state.status === "error" && (
        <div className="ml-14">
          <p className="text-sm text-[color:var(--accent-ink)]">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            className="text-xs text-[color:var(--muted)] hover:text-foreground mt-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Collapse */}
      <button
        type="button"
        onClick={() => {
          setExpanded(false);
          setState({ status: "idle" });
        }}
        className="mt-4 ml-14 text-xs text-[color:var(--muted)] hover:text-foreground transition-colors"
      >
        ← back
      </button>
    </div>
  );
}
