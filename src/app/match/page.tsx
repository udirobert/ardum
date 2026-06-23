"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ReasoningList from "@/matching/ReasoningList";
import MatchCard from "@/matching/MatchCard";
import type { MatchRun } from "@/matching/types";

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

  const [run, setRun] = useState<MatchRun | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        // The match is computed server-side on POST /api/agent/match.
        // On this page we re-fetch via a small server action so SSR can
        // hydrate the reasoning even if the user reloads.
        const res = await fetch(`/api/match-result?session=${sessionId}`);
        if (!res.ok) {
          // Not yet ready — retry shortly.
          setTimeout(poll, 250);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setRun(json.run);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Match failed.");
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  if (err) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p className="text-[color:var(--accent-ink)]">{err}</p>
      </section>
    );
  }

  if (!run) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
        <p className="tag mb-3">matching</p>
        <h1 className="font-serif text-4xl tracking-tight mb-6">
          Reading the attestation pool…
        </h1>
        <p className="why pulse-soft">agent reasoning…</p>
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
      <p className="tag mb-3">session {run.practitionerId.slice(0, 8)}…</p>
      <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
        Reasoning first. Recommendation second.
      </h1>
      <p className="text-lg text-[color:var(--muted)] max-w-prose mb-12 leading-relaxed">
        Here&apos;s how the agent thought about your match. Each step is a
        separate signal — you can disagree with any of them, and the match
        will shift accordingly.
      </p>

      <div className="mb-16">
        <ReasoningList steps={top.reasoning} />
      </div>

      <div className="space-y-6">
        <p className="tag">recommended</p>
        <MatchCard result={top} rank={1} />
        {run.results.slice(1, 3).map((r, i) => (
          <div key={r.id} className="opacity-80">
            <MatchCard result={r} rank={i + 2} />
          </div>
        ))}
      </div>

      <p className="tag mt-16 text-center">
        {run.agentTrace.attestationsConsidered} attestations considered ·
        provider: {run.agentTrace.provider} · prompt {run.agentTrace.promptVersion}
      </p>
    </section>
  );
}
