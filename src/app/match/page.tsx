"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ReasoningList from "@/matching/ReasoningList";
import StreamProgress from "@/matching/StreamProgress";
import MatchCard from "@/matching/MatchCard";
import type { MatchRun, ReasoningStep } from "@/matching/types";

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-[color:var(--muted)]">loading…</div>}>
      <MatchFlow />
    </Suspense>
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
    if (!sessionId) {
      router.replace("/");
      return;
    }

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

  if (err) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p className="tag mb-3">error</p>
        <h1 className="font-serif text-4xl tracking-tight mb-4">
          The agent couldn&apos;t finish reasoning.
        </h1>
        <p className="text-[color:var(--accent-ink)] mb-6">{err}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          Start over →
        </button>
      </section>
    );
  }

  if (!run) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <div className="flex items-baseline justify-between mb-3">
          <p className="tag">matching</p>
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
        <StreamProgress steps={steps.length} />
        <ReasoningList steps={steps} isStreaming />
        {!streamOpen && (
          <p className="why pulse-soft mt-4">opening stream…</p>
        )}
      </section>
    );
  }

  const top = run.results[0];
  if (!top) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p>No matches found in the attestation pool.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <div className="flex items-baseline justify-between mb-3 fade-in-up">
        <p className="tag">session {run.practitionerId.slice(0, 8)}&hellip;</p>
        <p className="tag flex items-center gap-2 fade-in-up">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]"
          />
          matched
        </p>
      </div>
      <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6 fade-in-up">
        Your match
      </h1>
      <p className="text-lg text-[color:var(--muted)] max-w-prose mb-12 leading-relaxed fade-in-up">
        Here&rsquo;s how the agent thought about your practice. Each step is
        a separate signal &mdash; you can disagree with any of them.
      </p>

      <div className="mb-16">
        <ReasoningList steps={steps} />
      </div>

      <div className="h-px bg-[color:var(--hairline)] mb-12 fade-in-up" />

      <div className="space-y-6">
        <p className="tag fade-in-up-1">recommended</p>
        <div className="fade-in-up-1">
          <MatchCard
            result={top}
            rank={1}
            attestationCount={top.attestationCount}
            attestor={top.attestor}
            attestedAt={top.attestedAt}
          />
        </div>
        {run.results.slice(1, 3).map((r, i) => (
          <div key={r.id} className={i === 0 ? "fade-in-up-2" : "fade-in-up-3"}>
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

      <p className="tag mt-16 text-center fade-in-up-3">
        {run.agentTrace.attestationsConsidered} attestations considered &middot;
        {run.agentTrace.provider === "stub" || run.agentTrace.provider === "0g-compute-fallback"
          ? "scored on declared preferences"
          : `powered by ${run.agentTrace.model}`}
        &middot; prompt {run.agentTrace.promptVersion}
      </p>
    </section>
  );
}
