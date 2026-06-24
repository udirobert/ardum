"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ReasoningList from "@/matching/ReasoningList";
import StreamProgress from "@/matching/StreamProgress";
import MatchCard from "@/matching/MatchCard";
import Counterfactual from "@/matching/Counterfactual";
import LensComparison from "@/matching/LensComparison";
import ClearHistoryLink from "@/matching/ClearHistoryLink";
import MaskReveal from "@/components/MaskReveal";
import { saveMatchResult } from "@/lib/client-session";
import { clearFingerprint } from "@/lib/fingerprint";
import type { MatchRun, ReasoningStep } from "@/matching/types";

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
        {trace.attestationsConsidered} attestation
        {trace.attestationsConsidered === 1 ? "" : "s"} considered
      </span>
    </div>
  );
}

function MatchFlow() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionId = sp.get("session");

  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [run, setRun] = useState<MatchRun | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);

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

  useEffect(() => {
    if (!sessionId) return;

    const url = `/api/agent/match/stream?session=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);

    es.addEventListener("open", () => setStreamOpen(true));

    es.addEventListener("reasoning", (e) => {
      try {
        const step = JSON.parse((e as MessageEvent).data) as ReasoningStep;
        setSteps((s) => [...s, step]);
      } catch (parseErr) {
        console.error("bad reasoning event", parseErr);
      }
    });

    es.addEventListener("done", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as { run: MatchRun };
        setRun(payload.run);
        if (sessionId) {
          saveMatchResult(sessionId, payload.run, stepsRef.current);
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
  }, [sessionId, router]);

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
        <div className="flex items-baseline justify-between mb-3">
          <p className="tag flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft"
            />
            streaming from 0G Compute Router
          </p>
          {steps.length > 0 && (
            <p className="tag tabular-nums fade-in-up">
              {steps.length} {steps.length === 1 ? "step" : "steps"} so far
            </p>
          )}
        </div>
        <h1 className="font-serif text-4xl tracking-tight mb-6">
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
        {!streamOpen && (
          <p className="why pulse-soft mt-4">opening stream to 0G Compute…</p>
        )}
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
            agentTrace={run.agentTrace}
          />
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
              agentTrace={run.agentTrace}
            />
          </div>
        ))}
      </div>

      <div className="drop-in-3">
        <Counterfactual
          sessionId={run.practitionerId}
          currentTopId={top.id}
          currentTopScore={top.score}
        />
      </div>

      <div className="drop-in-3">
        <LensComparison
          sessionId={run.practitionerId}
          currentTopId={top.id}
        />
      </div>

      <p className="tag mt-16 text-center drop-in-3">
        {run.agentTrace.attestationsConsidered} attestations on{" "}
        <span className="text-foreground">0G Storage</span> &middot;
        reasoned by{" "}
        <span className="text-foreground">0G Compute Router</span>
        {run.agentTrace.model ? ` · ${run.agentTrace.model}` : ""} &middot;
        prompt {run.agentTrace.promptVersion}
      </p>

      <div className="mt-6 text-center drop-in-3">
        <ClearHistoryLink onClear={clearFingerprint} />
      </div>
      </MaskReveal>
    </section>
  );
}
