"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import ReasoningList from "@/matching/ReasoningList";
import StreamProgress from "@/matching/StreamProgress";
import MatchCard from "@/matching/MatchCard";
import Counterfactual from "@/matching/Counterfactual";
import LensComparison from "@/matching/LensComparison";
import ClearHistoryLink from "@/matching/ClearHistoryLink";
import WhyNotThisOne from "@/matching/WhyNotThisOne";
import ChangedMyMind from "@/matching/ChangedMyMind";
import ShareMatch from "@/matching/ShareMatch";
import MaskReveal from "@/components/MaskReveal";
import MiraOrb from "@/components/MiraOrb";
import AestheticJourney from "@/aesthetics/AestheticJourney";
import { saveMatchResult } from "@/lib/client-session";
import { clearFingerprint } from "@/lib/fingerprint";
import type { MatchRun, ReasoningStep } from "@/matching/types";
import type { UserPreference, AestheticVector } from "@/aesthetics/image-pool";

// Memory context received from the SSE stream's first event. Mirrors the
// MemoryContext shape from src/lib/cognee.ts but client-safe (no rawRecall).
type StreamMemory = {
  isReturning: boolean;
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
  provider: string;
};

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-[color:var(--muted)]">loading…</div>}>
      <MatchFlow />
    </Suspense>
  );
}

// Quiet provenance line shown directly under the match header. Says
// the part out loud: this recommendation was reasoned by 0G Compute over
// attestations stored on 0G Storage. Without 0G, the user would never
// have reached this view — the stream errors instead of falling back.
// Persistent header chip shown during streaming. Tracks the LLM's live
// state (tokens received, seconds elapsed) so the user has a felt sense
// of activity that's distinct from the reasoning list. Replaces the
// in-list "generating · streaming from <model>" steps that used to make
// LLM heartbeat indistinguishable from real reasoning.
function ComputeChip({
  progress,
  streamOpen,
}: {
  progress: { tokens: number; elapsedMs: number; model: string } | null;
  streamOpen: boolean;
}) {
  const tokens = progress?.tokens ?? 0;
  const elapsed = progress?.elapsedMs ?? 0;
  const seconds = (elapsed / 1000).toFixed(1);
  const model = progress?.model;
  const stage = !streamOpen
    ? "opening stream…"
    : tokens === 0
      ? "connected · awaiting tokens…"
      : `${tokens.toLocaleString()} tokens · ${seconds}s`;
  return (
    <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-[color:var(--hairline)] rounded-sm px-3 py-2 bg-[color:var(--surface)] surface-card">
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft"
      />
      <span className="tag">
        <span className="text-foreground">0G Compute Router</span>
        {model ? ` · ${model}` : ""}
      </span>
      <span aria-hidden className="text-[color:var(--hairline)]">|</span>
      <span className="tag tabular-nums">{stage}</span>
    </div>
  );
}

function ZeroGProvenance({ trace }: { trace: MatchRun["agentTrace"] }) {
  return (
    <div className="mb-12 drop-in inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-[color:var(--hairline)] rounded-sm px-3 py-2 bg-[color:var(--surface)]">
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"
      />
      <span className="tag">
        <span className="text-foreground">0G Compute Router</span>
        {trace.model ? ` · ${trace.model}` : ""}
      </span>
      <span aria-hidden className="text-[color:var(--hairline)]">|</span>
      <span className="tag">
        <span className="text-foreground">0G Storage</span>
        {" · "}
        {trace.attestationsConsidered} retreat
        {trace.attestationsConsidered === 1 ? "" : "s"} considered
      </span>
    </div>
  );
}

function MatchFlow() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionId = sp.get("session");
  const userId = sp.get("user");
  const profileB64 = sp.get("p");

  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [run, setRun] = useState<MatchRun | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [progress, setProgress] = useState<{
    tokens: number;
    elapsedMs: number;
    model: string;
  } | null>(null);
  const [aestheticPref, setAestheticPref] = useState<UserPreference | null>(null);
  const [journeyActive, setJourneyActive] = useState(true);
  const [memory, setMemory] = useState<StreamMemory | null>(null);

  // Keep latest state visible inside the EventSource handlers without
  // re-subscribing on every render.
  const stepsRef = useRef<ReasoningStep[]>([]);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  const runRef = useRef<MatchRun | null>(null);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  const aestheticPrefRef = useRef<UserPreference | null>(null);
  useEffect(() => {
    aestheticPrefRef.current = aestheticPref;
  }, [aestheticPref]);

  useEffect(() => {
    if (!sessionId) return;

    const url = `/api/agent/match/stream?session=${encodeURIComponent(sessionId)}${userId ? `&user=${encodeURIComponent(userId)}` : ""}${profileB64 ? `&p=${encodeURIComponent(profileB64)}` : ""}`;
    const es = new EventSource(url);

    es.addEventListener("open", () => setStreamOpen(true));

    es.addEventListener("memory", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as StreamMemory;
        setMemory(payload);
      } catch (parseErr) {
        console.error("bad memory event", parseErr);
      }
    });

    es.addEventListener("reasoning", (e) => {
      try {
        const step = JSON.parse((e as MessageEvent).data) as ReasoningStep;
        setSteps((s) => [...s, step]);
      } catch (parseErr) {
        console.error("bad reasoning event", parseErr);
      }
    });

    es.addEventListener("compute-progress", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          tokens: number;
          elapsedMs: number;
          model: string;
        };
        setProgress(payload);
      } catch (parseErr) {
        console.error("bad compute-progress event", parseErr);
      }
    });

    es.addEventListener("done", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as { run: MatchRun };
        setRun(payload.run);
        if (sessionId) {
          saveMatchResult(sessionId, payload.run, stepsRef.current);
        }
        // Save aesthetic preference to sessionStorage for the match
        // detail page to pick up and weave into Mira's letter.
        if (aestheticPrefRef.current) {
          try {
            sessionStorage.setItem(
              `aesthetic-pref-${sessionId}`,
              JSON.stringify(aestheticPrefRef.current),
            );
          } catch {
            /* sessionStorage might be full or unavailable */
          }
        }
      } catch (parseErr) {
        console.error("bad done event", parseErr);
      }
      es.close();
    });

    es.addEventListener("end", (e) => {
      // Server sent an end event (abnormal termination, no 'done').
      if ((e as MessageEvent).data) {
        try {
          const payload = JSON.parse((e as MessageEvent).data) as {
            ok?: boolean;
          };
          if (!payload.ok) setErr("The agent couldn't finish reasoning.");
        } catch {
          /* no payload */
        }
      }
      if (!runRef.current) es.close();
    });

    es.addEventListener("error", (e) => {
      // EventSource fires 'error' on network drops AND on non-2xx status.
      // We only surface a real error if we never received a 'done' event.
      if ((e as MessageEvent).data) {
        try {
          const payload = JSON.parse((e as MessageEvent).data) as {
            message?: string;
          };
          setErr(payload.message ?? "Stream error.");
          es.close();
        } catch {
          /* generic event with no payload */
        }
      }
    });

    return () => es.close();
  }, [sessionId, userId, profileB64, router]);

  if (!sessionId) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p className="tag mb-3">no session</p>
        <h1 className="font-serif text-4xl tracking-tight mb-4">
          No match session found.
        </h1>
        <p className="text-[color:var(--muted)] max-w-prose mb-8 leading-relaxed">
          Start by telling the agent about your practice — it only takes a
          few questions.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          Start matching →
        </button>
      </section>
    );
  }

  if (err) {
    const isZeroGIssue = /0G Compute/i.test(err);
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p className="tag mb-3">
          {isZeroGIssue ? "0g compute unavailable" : "error"}
        </p>
        <h1 className="font-serif text-4xl tracking-tight mb-4">
          {isZeroGIssue
            ? "The reasoning engine didn’t respond."
            : "The agent couldn’t finish reasoning."}
        </h1>
        <p className="text-[color:var(--accent-ink)] mb-3 max-w-prose leading-relaxed">
          {err}
        </p>
        {isZeroGIssue && (
          <p className="why mb-8 max-w-prose">
            Ardum reasons on 0G Compute or it doesn’t recommend — there’s
            no silent fallback. Try again, or refresh your calibration.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setSteps([]);
              setRun(null);
              setStreamOpen(false);
              // Re-mount the effect by tweaking the URL hash.
              router.replace(`/match?session=${encodeURIComponent(sessionId)}&retry=${Date.now()}`);
            }}
            className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            Try again →
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
          >
            Recalibrate
          </button>
        </div>
      </section>
    );
  }

  if (!run) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <ComputeChip progress={progress} streamOpen={streamOpen} />

        {/* Memory banner — if Mira remembers this practitioner from Cognee,
            show a recognition line while the agent reasons. This is the
            "AI that doesn't forget" moment, visible before the match lands.
            Pass the live aesthetic vector so the orb's marble veins already
            reflect the user's aesthetic (warm, cool, light, dark) even during
            the reasoning phase. */}
        {memory && memory.isReturning && memory.provider !== "none" && (
          <MemoryBanner memory={memory} aestheticVector={aestheticPref?.vector ?? null} />
        )}

        {/* Aesthetic journey — runs alongside the reasoning stream.
            The user interacts with images + sound while the agent
            thinks. Their reactions build a preference vector that
            gets woven into Mira's match letter. */}
        {journeyActive && (
          <div className="mt-8 mb-8">
            <AestheticJourney
              onComplete={(pref) => {
                setAestheticPref(pref);
                setJourneyActive(false);
              }}
            />
          </div>
        )}

        {/* Reasoning stream — visible below the journey, or as the
            primary view once the journey completes */}
        <h1 className="font-serif text-4xl tracking-tight mb-6 mt-3">
          {steps.length === 0
            ? "Reading your profile…"
            : "Reasoning out loud…"}
        </h1>
        <div className="relative">
          <div
            className="absolute -inset-20 rounded-full breathing-glow pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 50% 40% at 50% 20%, rgba(168,90,58,0.12) 0%, transparent 70%)",
            }}
          />
          <StreamProgress steps={steps.length} />
          <ReasoningList steps={steps} isStreaming />
        </div>
      </section>
    );
  }

  const top = run.results[0];
  if (!top) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p className="tag mb-4">no matches</p>
        <h1 className="font-serif text-4xl tracking-tight mb-4">
          Nothing quite fit.
        </h1>
        <p className="text-[color:var(--muted)] max-w-prose mb-8 leading-relaxed">
          The agent considered {run.agentTrace.attestationsConsidered} attestations
          but couldn&apos;t find a strong enough match for your practice profile.
          Try adjusting your energy, budget, or social preferences.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          Recalibrate →
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <MaskReveal>
        <div className="flex items-baseline justify-between mb-3 drop-in">
        <p className="tag">session {run.practitionerId.slice(0, 8)}&hellip;</p>
        <p className="tag flex items-center gap-2 drop-in">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"
          />
          matched
        </p>
      </div>
      <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6 drop-in">
        Your match
      </h1>
      <p className="text-lg text-[color:var(--muted)] max-w-prose mb-6 leading-relaxed drop-in">
        Here&rsquo;s how the agent thought about your practice. Each step is
        a separate signal &mdash; you can disagree with any of them.
      </p>
      <ZeroGProvenance trace={run.agentTrace} />

      <div className="mb-16">
        <ReasoningList steps={steps} />
      </div>

      <div className="h-px bg-[color:var(--hairline)] mb-12 drop-in" />

      <div className="space-y-6">
        <p className="tag drop-in-1">recommended</p>
        <div className="drop-in-1">
          <MatchCard
            result={top}
            rank={1}
            attestationCount={top.attestationCount}
            attestor={top.attestor}
            attestedAt={top.attestedAt}
          />
        </div>

        {/* Share your match — the viral loop entry point */}
        <div className="drop-in-2">
          <ShareMatch match={top} />
        </div>

        {run.results.slice(1, 3).map((r, i) => (
          <div key={r.id} className={i === 0 ? "drop-in-2" : "drop-in-3"}>
            <MatchCard
              result={r}
              rank={i + 2}
              attestationCount={r.attestationCount}
              attestor={r.attestor}
              attestedAt={r.attestedAt}
              compact
            />
          </div>
        ))}
      </div>

      {/* I changed my mind — agent-mediated re-matching */}
      <div className="drop-in-3">
        <ChangedMyMind sessionId={run.practitionerId} userId={userId ?? undefined} />
      </div>

      {/* Why not this one? — interactive counterfactual via Mira */}
      <div className="drop-in-3">
        <WhyNotThisOne
          topMatch={top}
          otherRetreats={run.results.slice(1)}
          sessionId={run.practitionerId}
          userId={userId ?? undefined}
        />
      </div>

      <div className="drop-in-3">
        <Counterfactual
          sessionId={run.practitionerId}
          currentTopId={top.id}
          currentTopScore={top.score}
          userId={userId ?? undefined}
        />
      </div>

      <div className="drop-in-3">
        <LensComparison
          sessionId={run.practitionerId}
          currentTopId={top.id}
          userId={userId ?? undefined}
        />
      </div>

      <p className="tag mt-16 text-center drop-in-3">
        {run.agentTrace.attestationsConsidered} retreats verified on{" "}
        <span className="text-foreground">0G Storage</span> &middot;
        reasoned by{" "}
        <span className="text-foreground">0G Compute Router</span>
        {run.agentTrace.model ? ` · ${run.agentTrace.model}` : ""} &middot;
        prompt {run.agentTrace.promptVersion}
      </p>

      <div className="mt-6 text-center drop-in-3">
        <ClearHistoryLink onClear={clearFingerprint} />
      </div>

      {/* Link to the memory transparency page */}
      {memory && memory.isReturning && memory.provider !== "none" && (
        <div className="mt-4 text-center drop-in-3">
          <Link
            href="/memory"
            className="tag hover:text-foreground transition-colors"
          >
            what does Mira remember about me? →
          </Link>
        </div>
      )}
      </MaskReveal>
    </section>
  );
}

// Memory banner — shown while the agent reasons, if Mira has memory of
// this practitioner from Cognee. The "AI that doesn't forget" moment.
// Uses the "thinking" orb state to signal Mira is actively recalling.
// The aestheticVector (if available) tints the marble veins so the orb
// already reflects the user's aesthetic even before the journey completes.
function MemoryBanner({ memory, aestheticVector }: { memory: StreamMemory; aestheticVector?: AestheticVector | null }) {
  const lastBooking = memory.pastBookings[0];
  const lastMatch = memory.pastMatches[0];
  const lastEnergy = memory.energyHistory[memory.energyHistory.length - 1];
  const lastNote = memory.pastNotes[0];

  let recognition = "I remember you from a previous visit.";
  if (lastBooking) {
    recognition = `You've been to ${lastBooking.title} in ${lastBooking.location}.`;
  } else if (lastMatch) {
    recognition = `Last time I recommended ${lastMatch.title} in ${lastMatch.location}.`;
  }

  if (lastEnergy) {
    recognition += ` Your energy was ${lastEnergy} then.`;
  }

  return (
    <aside className="mt-6 mb-6 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-5 fade-in-up surface-card">
      <div className="flex items-start gap-4">
        <MiraOrb size={36} state="thinking" aestheticVector={aestheticVector} />
        <div className="flex-1">
          <p className="tag mb-1 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft"
            />
            Mira remembers you
          </p>
          <p className="text-sm leading-relaxed max-w-prose">
            {recognition}
            {lastNote && (
              <>
                {" "}
                You mentioned: <em>&ldquo;{lastNote}&rdquo;</em>
              </>
            )}
          </p>
          {memory.pastMatches.length > 1 && (
            <p className="tag mt-2 opacity-70">
              {memory.pastMatches.length} past recommendations ·{" "}
              {memory.pastBookings.length} booked
            </p>
          )}
          <p className="tag mt-2 opacity-60">
            powered by Cognee · hybrid graph-vector memory
          </p>
        </div>
      </div>
    </aside>
  );
}
