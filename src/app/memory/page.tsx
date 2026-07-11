"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MiraOrb from "@/components/MiraOrb";
import type { Episode } from "@/episodes/model";

export default function MemoryPage() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/episodes", { cache: "no-store" });
    const data = (await response.json()) as { episodes?: Episode[] };
    setEpisodes(data.episodes ?? []);
  }

  useEffect(() => {
    fetch("/api/episodes", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { episodes?: Episode[] }) => setEpisodes(data.episodes ?? []))
      .catch(() => setEpisodes([]));
  }, []);

  async function remove(episodeId: string) {
    if (!window.confirm("Delete this intention and its history? This cannot be undone.")) {
      return;
    }
    await fetch(`/api/episodes/${episodeId}`, { method: "DELETE" });
    setMessage("The intention and its operational history were deleted.");
    await load();
  }

  function exportEpisode(episode: Episode) {
    const blob = new Blob([JSON.stringify(episode, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `ardum-intention-${episode.id}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 py-16">
      <Link href="/" className="tag hover:text-foreground">
        ← back
      </Link>
      <div className="flex items-center gap-4 mt-8 mb-8">
        <MiraOrb size={56} state="calm" />
        <div>
          <p className="font-serif text-2xl">Mira</p>
          <p className="tag">your intention &amp; privacy</p>
        </div>
      </div>
      <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-4">
        What I am keeping in mind.
      </h1>
      <p className="text-[color:var(--muted)] text-lg leading-relaxed mb-10">
        Operational history belongs to each intention. It is stored behind an
        anonymous ownership cookie, not in a public URL. You can inspect,
        export, or delete it here.
      </p>

      {message && (
        <p className="mb-6 text-sm text-[color:var(--accent-ink)]" role="status">
          {message}
        </p>
      )}

      {episodes === null ? (
        <p aria-live="polite">Loading retained intentions…</p>
      ) : episodes.length === 0 ? (
        <div className="border border-[color:var(--hairline)] rounded-sm p-6 bg-[color:var(--surface)]">
          <p className="font-serif text-2xl mb-2">Nothing retained.</p>
          <p className="text-sm text-[color:var(--muted)]">
            Mira will ask before giving a new intention a persistent home.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {episodes.map((episode) => {
            const current = episode.intentions.at(-1)!;
            return (
              <article
                key={episode.id}
                className="border border-[color:var(--hairline)] rounded-sm p-6 bg-[color:var(--surface)]"
              >
                <p className="tag mb-2">
                  {episode.status} · revision {episode.revision}
                </p>
                <h2 className="font-serif text-2xl tracking-tight mb-4">
                  {current.statement}
                </h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-5">
                  <dt className="text-[color:var(--muted)]">Added</dt>
                  <dd>{new Date(episode.createdAt).toLocaleString()}</dd>
                  <dt className="text-[color:var(--muted)]">Used for</dt>
                  <dd>Clarification, recommendation, monitoring, and coordination</dd>
                  <dt className="text-[color:var(--muted)]">Constraints</dt>
                  <dd>
                    {Object.entries(current.constraints)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" · ") || "None yet"}
                  </dd>
                </dl>
                <details className="mb-5">
                  <summary className="tag cursor-pointer">
                    show intention history and events
                  </summary>
                  <div className="mt-4 space-y-4 text-sm">
                    {episode.intentions.map((revision) => (
                      <div key={revision.version}>
                        <p className="font-medium">Revision {revision.version}</p>
                        <p>{revision.statement}</p>
                        <p className="text-[color:var(--muted)]">
                          {revision.changeReason}
                        </p>
                      </div>
                    ))}
                    {episode.events.map((event) => (
                      <p key={event.id} className="text-[color:var(--muted)]">
                        {new Date(event.createdAt).toLocaleDateString()} ·{" "}
                        {event.summary}
                      </p>
                    ))}
                  </div>
                </details>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href={`/episode/${episode.id}`}
                    className="text-sm text-[color:var(--accent)]"
                  >
                    Continue →
                  </Link>
                  <button
                    type="button"
                    onClick={() => exportEpisode(episode)}
                    className="text-sm text-[color:var(--muted)]"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(episode.id)}
                    className="text-sm text-[color:var(--muted)]"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-[color:var(--hairline)]">
        <h2 className="font-serif text-2xl mb-3">Boundaries</h2>
        <ul className="space-y-2 text-sm text-[color:var(--muted)]">
          <li>Browser data is a cache, not authority.</li>
          <li>Semantic recall may add context but cannot change episode facts.</li>
          <li>Invitation links never contain private intention text.</li>
          <li>Deleting an intention removes its local operational history.</li>
        </ul>
      </div>
    </section>
  );
}
