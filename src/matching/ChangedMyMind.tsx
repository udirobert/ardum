"use client";

// ChangedMyMind — agent-mediated re-matching.
//
// The user can tell Mira at any point that their situation changed.
// Mira asks what changed (energy, budget, or social), the user
// picks a new value, and Mira re-runs the match with the updated
// signals — without making the user re-do the entire intake.
//
// The agent holds context across the entire journey. This is the
// key agentic differentiator: the agent remembers who you are and
// adapts to your changing reality.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MiraOrb from "@/components/MiraOrb";
import type { PractitionerProfile } from "@/calibration/schema";

type ChangedMyMindProps = {
  sessionId: string;
  userId?: string;
};

type Signal = "energy" | "budget" | "social";

type Step = "closed" | "asking" | "updating" | "redirecting";

const OPTIONS: Record<Signal, { value: string; label: string }[]> = {
  energy: [
    { value: "settled", label: "Settled" },
    { value: "in-movement", label: "In movement" },
    { value: "low", label: "Low" },
    { value: "sharp", label: "Sharp" },
  ],
  budget: [
    { value: "under-1k", label: "Under $1,000" },
    { value: "1k-2k", label: "$1,000 – $2,000" },
    { value: "2k-3k", label: "$2,000 – $3,000" },
    { value: "3k-plus", label: "$3,000+" },
  ],
  social: [
    { value: "solo", label: "Mostly alone" },
    { value: "small-circle", label: "Small circle" },
    { value: "open-circle", label: "Open circle" },
    { value: "communal", label: "Communal" },
  ],
};

const MIRA_ASK: Record<Signal, string> = {
  energy: "What's your energy like now?",
  budget: "What's the new budget window?",
  social: "How's your social battery?",
};

const MIRA_ACK: Record<Signal, string> = {
  energy: "Got it. Let me re-think with your new energy.",
  budget: "Understood. Re-matching with the new budget.",
  social: "Noted. Re-running with your updated social comfort.",
};

export default function ChangedMyMind({ sessionId, userId }: ChangedMyMindProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [signal, setSignal] = useState<Signal | null>(null);
  const [newValue, setNewValue] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<PractitionerProfile | null>(null);

  // Fetch the current profile when the user opens the panel
  useEffect(() => {
    if (step === "asking" && !currentProfile) {
      fetch(`/api/profile?session=${encodeURIComponent(sessionId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.profile) setCurrentProfile(data.profile);
        })
        .catch(() => {
          /* profile fetch is best-effort */
        });
    }
  }, [step, currentProfile, sessionId]);

  async function updateAndRematch() {
    if (!signal || !newValue || !currentProfile) return;
    setStep("redirecting");

    // Update the profile on the server
    const updated: PractitionerProfile = {
      ...currentProfile,
      [signal]: newValue as never,
      createdAt: new Date().toISOString(),
    };

    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, profile: updated }),
      });
    } catch {
      // Best-effort — the match stream waits for the profile
    }

    // Fire-and-forget: store the preference shift in Cognee memory and
    // trigger improve() to enrich the graph. This closes the feedback
    // loop — Mira learns from every "I changed my mind" without the
    // user visiting a settings page.
    if (userId) {
      fetch("/api/memory/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "changed-mind",
          description: `Practitioner changed their ${signal} from "${currentProfile[signal]}" to "${newValue}".`,
          details: { signal, from: currentProfile[signal], to: newValue },
        }),
      }).catch(() => {});
    }

    // Navigate to a fresh match with the same session
    router.push(`/match?session=${sessionId}&retry=${Date.now()}`);
  }

  // ── Closed state — the invitation ──────────────────────────────────
  if (step === "closed") {
    return (
      <div className="mt-8 border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
        <div className="flex items-start gap-4">
          <MiraOrb size={40} state="calm" className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="text-sm leading-relaxed mb-3">
              Something changed? Tell me. I&apos;ll re-think the match without
              making you start over.
            </p>
            <button
              type="button"
              onClick={() => setStep("asking")}
              className="text-sm text-[color:var(--accent)] hover:text-[color:var(--accent-ink)] transition-colors"
            >
              I changed my mind →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Asking state — pick what changed ───────────────────────────────
  if (step === "asking") {
    return (
      <div className="mt-8 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
        <div className="flex items-start gap-4 mb-6">
          <MiraOrb size={40} state="speaking" className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="text-sm leading-relaxed mb-4">
              What changed?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(["energy", "budget", "social"] as Signal[]).map((sig) => (
                <button
                  key={sig}
                  type="button"
                  onClick={() => setSignal(sig)}
                  className={`px-3 py-1.5 rounded-sm text-xs border transition-colors capitalize ${
                    signal === sig
                      ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-background"
                      : "border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] text-[color:var(--muted)] hover:text-foreground"
                  }`}
                >
                  {sig === "social" ? "social comfort" : sig}
                </button>
              ))}
            </div>

            {/* Show options for the selected signal */}
            {signal && (
              <div className="fade-in-up">
                <p className="text-sm leading-relaxed mb-3">
                  {MIRA_ASK[signal]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {OPTIONS[signal].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setNewValue(opt.value);
                        setStep("updating");
                      }}
                      className={`px-3 py-1.5 rounded-sm text-xs border transition-colors ${
                        newValue === opt.value
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-background"
                          : "border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setStep("closed");
            setSignal(null);
            setNewValue(null);
          }}
          className="ml-14 text-xs text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          ← never mind
        </button>
      </div>
    );
  }

  // ── Updating state — Mira acknowledges and re-matches ─────────────
  if (step === "updating" && signal) {
    return (
      <div className="mt-8 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
        <div className="flex items-start gap-4">
          <MiraOrb size={40} state="speaking" className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="text-sm leading-relaxed mb-4 mira-line">
              {MIRA_ACK[signal]}
            </p>
            <button
              type="button"
              onClick={updateAndRematch}
              className="px-5 py-2.5 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
            >
              Re-think the match →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Redirecting state ──────────────────────────────────────────────
  return (
    <div className="mt-8 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
      <div className="flex items-center gap-4">
        <MiraOrb size={40} state="thinking" />
        <p className="text-sm leading-relaxed">
          Re-thinking with your updated {signal}…
        </p>
      </div>
    </div>
  );
}
