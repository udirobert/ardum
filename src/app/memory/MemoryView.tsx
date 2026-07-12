"use client";

// Client island for /memory. Receives the actor's episodes (and the
// delete/export confirmation message state) as props from the server
// component. The server already rendered the first paint — including
// the recognition summary card above this section — so we only need
// this island for the actions that genuinely require the browser:
//
//   - window.confirm for the irreversible delete
//   - Blob + URL.createObjectURL for the JSON export
//   - useRouter().refresh() after delete so the next render shows
//     the post-delete projection (server re-runs with the same cookie,
//     the deleted episode is gone from listOwned, the summary card
//     drops to isReturning=false)
//
// The list itself is read-only — Continue is a plain Link to /episode/[id].

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Episode } from "@/episodes/model";

type Props = {
  episodes: Episode[];
};

export default function MemoryView({ episodes }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // isRefreshing stays true while the server re-render is in flight
  // after a successful delete. Combined with `pending` (the DELETE
  // fetch in flight) into `isBusy` so rapid double-clicks during the
  // refresh window cannot fire a second delete before the refreshed
  // list has landed. router.refresh() is fire-and-forget — without
  // this gate, a practitioner who clicks Delete twice in quick
  // succession could send a second DELETE that 404s against the
  // already-deleted id.
  const [isRefreshing, startTransition] = useTransition();
  const isBusy = pending || isRefreshing;

  async function remove(episodeId: string) {
    if (!window.confirm("Delete this intention and its history? This cannot be undone.")) {
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/episodes/${episodeId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setMessage("Could not delete. Please try again.");
        return;
      }
      setMessage("The intention and its operational history were deleted.");
      // Server re-runs listOwned + projection with the same cookie;
      // the deleted episode drops out and the summary card falls to
      // isReturning=false when no other history remains. Wrapped in
      // startTransition so isRefreshing stays true until the
      // re-rendered server payload has been applied to the client.
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setPending(false);
    }
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
    <>
      {message && (
        <p
          className="mb-6 text-sm text-[color:var(--accent-ink)]"
          role="status"
        >
          {message}
        </p>
      )}

      {episodes.length === 0 ? (
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
                  <dd>
                    Clarification, recommendation, monitoring, and coordination
                  </dd>
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
                      <p
                        key={event.id}
                        className="text-[color:var(--muted)]"
                      >
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
                    disabled={isBusy}
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(episode.id)}
                    className="text-sm text-[color:var(--muted)]"
                    disabled={isBusy}
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
    </>
  );
}
