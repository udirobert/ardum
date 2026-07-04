"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MiraOrb from "@/components/MiraOrb";
import EnergyTimeline from "@/components/EnergyTimeline";
import MemoryGraph from "@/components/MemoryGraph";
import { getOrCreateUserId, clearUserId, clearFingerprint } from "@/lib/fingerprint";

// Memory transparency page — "What does Mira remember about me?"
//
// This is the UX differentiator: the user can see exactly what Mira's
// Cognee memory holds, run improve() to enrich the graph, and forget()
// to wipe everything. No black box.
//
// The four Cognee lifecycle verbs are all visible here:
//   recall  → GET /api/memory (shown as the memory list)
//   improve → POST /api/memory { action: "improve" }
//   forget  → POST /api/memory { action: "forget" }
//   remember → happens automatically on intake + match (not user-triggered)

type MemoryData = {
  isReturning: boolean;
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
  provider: string;
  configured: boolean;
};

export default function MemoryPage() {
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"idle" | "improving" | "forgetting">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const userIdRef = useRef<string>("");

  useEffect(() => {
    const id = getOrCreateUserId();
    userIdRef.current = id;
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    fetch(`/api/memory?userId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        setMemory(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  async function handleImprove() {
    const uid = userIdRef.current;
    if (!uid) return;
    setAction("improving");
    setMessage(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "improve", userId: uid }),
      });
      const data = await res.json();
      setMessage(data.message ?? "Memory enriched.");
    } catch {
      setMessage("Something went wrong enriching memory.");
    }
    setAction("idle");
  }

  async function handleForget() {
    const uid = userIdRef.current;
    if (!uid) return;
    setAction("forgetting");
    setMessage(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "forget", userId: uid }),
      });
      const data = await res.json();
      setMessage(data.message ?? "Memory cleared.");
      // Also clear local memory
      clearUserId();
      clearFingerprint();
      // Update the displayed state
      setMemory({
        isReturning: false,
        energyHistory: [],
        pastMatches: [],
        pastBookings: [],
        pastNotes: [],
        provider: "none",
        configured: memory?.configured ?? false,
      });
    } catch {
      setMessage("Something went wrong clearing memory.");
    }
    setAction("idle");
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-20 pb-24">
        <div className="flex items-center gap-4 mb-8">
          <MiraOrb size={44} state="thinking" />
          <div>
            <p className="font-serif text-xl tracking-tight">Mira</p>
            <p className="tag">recalling…</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-12 sm:pt-20 pb-24">
      <Link
        href="/"
        className="tag hover:text-foreground transition-colors"
      >
        ← back to matching
      </Link>

      <div className="flex items-center gap-4 mb-8 mt-8">
        <MiraOrb size={56} state="calm" />
        <div>
          <p className="font-serif text-2xl tracking-tight">Mira</p>
          <p className="tag">your guide</p>
        </div>
      </div>

      <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-4">
        What I remember about you.
      </h1>
      <p className="text-[color:var(--muted)] text-lg mb-10 max-w-prose leading-relaxed">
        This is my memory — everything I know about your practice, your
        preferences, and the retreats we&apos;ve explored together. Stored in
        a hybrid graph-vector knowledge layer. You can enrich it or wipe it
        at any time.
      </p>

      {/* Status indicator */}
      <div className="mb-8 inline-flex items-center gap-2 border border-[color:var(--hairline)] rounded-sm px-3 py-2 bg-[color:var(--surface)] surface-card">
        <span
          aria-hidden
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            memory?.configured
              ? "bg-[color:var(--accent)]"
              : "bg-[color:var(--muted)]"
          }`}
        />
        <span className="tag">
          {memory?.configured
            ? "Cognee memory layer · connected"
            : "Cognee not configured · demo mode"}
        </span>
      </div>

      {/* Memory contents */}
      {memory && memory.isReturning ? (
        <div className="space-y-8">
          {/* Energy trajectory — the sparkline */}
          {memory.energyHistory.length > 0 && (
            <MemorySection title="Your energy over time">
              <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
                <EnergyTimeline energyHistory={memory.energyHistory} />
              </div>
              <p className="why mt-3 max-w-prose">
                I&apos;ve seen your energy {memory.energyHistory.length > 1 ? "shift" : "once"} across {memory.energyHistory.length === 1 ? "one visit" : `${memory.energyHistory.length} visits`}. This helps me
                recommend retreats that meet you where you are, not where you
                were.
              </p>
            </MemorySection>
          )}

          {/* Past matches */}
          {memory.pastMatches.length > 0 && (
            <MemorySection title="Retreats I&apos;ve recommended">
              <ul className="space-y-2">
                {memory.pastMatches.map((m, i) => (
                  <li
                    key={i}
                    className="border border-[color:var(--hairline)] rounded-sm p-4 bg-[color:var(--surface)]"
                  >
                    <p className="font-serif text-lg">{m.title}</p>
                    <p className="tag mt-1">
                      {m.location} · match score {(m.score * 100).toFixed(0)}%
                    </p>
                  </li>
                ))}
              </ul>
            </MemorySection>
          )}

          {/* Past bookings */}
          {memory.pastBookings.length > 0 && (
            <MemorySection title="Retreats you&apos;ve booked">
              <ul className="space-y-2">
                {memory.pastBookings.map((b, i) => (
                  <li
                    key={i}
                    className="border border-[color:var(--hairline)] rounded-sm p-4 bg-[color:var(--surface)]"
                  >
                    <p className="font-serif text-lg">{b.title}</p>
                    <p className="tag mt-1">{b.location}</p>
                  </li>
                ))}
              </ul>
            </MemorySection>
          )}

          {/* Notes */}
          {memory.pastNotes.length > 0 && (
            <MemorySection title="Things you&apos;ve told me">
              <ul className="space-y-2">
                {memory.pastNotes.map((n, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-[color:var(--accent)] pl-4 py-1"
                  >
                    <p className="text-sm italic">&ldquo;{n}&rdquo;</p>
                  </li>
                ))}
              </ul>
            </MemorySection>
          )}

          {/* Knowledge graph — the visual that makes Cognee tangible */}
          <MemorySection title="The knowledge graph">
            <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
              <MemoryGraph
                data={{
                  energyHistory: memory.energyHistory,
                  pastMatches: memory.pastMatches,
                  pastBookings: memory.pastBookings,
                  pastNotes: memory.pastNotes,
                }}
              />
            </div>
            <p className="why mt-3 max-w-prose">
              Your memory lives in a hybrid graph-vector store. Every intake,
              match, and booking becomes nodes and edges that I can traverse.
              The more you use Ardum, the richer the graph becomes — and the
              more precisely I can match you.
            </p>
          </MemorySection>
        </div>
      ) : (
        <div className="border border-[color:var(--hairline)] rounded-sm p-8 bg-[color:var(--surface)] surface-card">
          <p className="font-serif text-xl mb-3">A blank page.</p>
          <p className="why max-w-prose">
            {memory?.configured
              ? "I don't have any memories of you yet. Complete the intake and I'll start remembering — your energy, your matches, your bookings, the things you tell me. Every visit adds to the graph."
              : "Cognee isn't configured right now, so I'm running in demo mode with browser-only memory. Set COGNEE_BASE_URL and COGNEE_API_KEY to give me a real memory layer."}
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
          >
            Start your intake →
          </Link>
        </div>
      )}

      {/* Actions: improve + forget */}
      <div className="mt-16 pt-8 border-t border-[color:var(--hairline)]">
        <h2 className="font-serif text-2xl tracking-tight mb-4">
          Memory controls
        </h2>
        <p className="why max-w-prose mb-6">
          You own your memory. Enrich it to let me find deeper connections,
          or wipe it completely — I&apos;ll start fresh, no hard feelings.
        </p>

        {message && (
          <p className="text-sm text-[color:var(--accent-ink)] mb-4 fade-in-up max-w-prose">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleImprove}
            disabled={action !== "idle" || !memory?.configured}
            className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm disabled:opacity-40"
          >
            {action === "improving" ? "Enriching…" : "Enrich my memory"}
          </button>
          <button
            type="button"
            onClick={handleForget}
            disabled={action !== "idle"}
            className="px-5 py-2.5 rounded-sm border border-dashed border-[color:var(--hairline)] text-[color:var(--muted)] hover:text-foreground hover:border-[color:var(--accent-ink)] transition-colors text-sm disabled:opacity-40"
          >
            {action === "forgetting" ? "Forgetting…" : "Forget everything"}
          </button>
        </div>

        <p className="tag mt-4 opacity-70">
          powered by Cognee · remember / recall / improve / forget
        </p>
      </div>
    </section>
  );
}

function MemorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="tag mb-3">{title}</p>
      {children}
    </div>
  );
}
