// Server component — replaces the previous "use client" page so the
// returning-practitioner summary card renders in the initial HTML
// (smoke-ui.mjs pins that testid on first paint).
//
// Why server: the actor cookie is read with resolveActor (server-only),
// the episode repo is server-only too, and smoke-ui.mjs asserts the
// summary card's data-testid lands in the first byte stream of GET
// /memory. Doing the projection server-side gives us that, plus a
// no-flicker first paint for returning practitioners.
//
// Why projector-only: the summary card only uses operational fields
// (pastBookings, pastMatches — see AGENTS.md "Semantic memory is
// supplementary and lossy"). pastNotes from Cognee are free-form
// prose the home page also skips. Same reasoning as the home greeting.
//
// The interactive episode list (Delete + Export buttons) is
// delegated to MemoryView, a "use client" island. The list itself
// is read-only from the server, so the only boundary crossings are
// window.confirm, Blob, and useRouter().refresh() after delete.

import { resolveActor } from "@/identity/actor";
import { episodeRepository } from "@/episodes/repository";
import { projectActorMemory } from "@/memory/enrich";
import { activeEpisodePresence } from "@/episodes/detail-payload";
import MemoryView from "@/app/memory/MemoryView";
import MiraOrb from "@/components/MiraOrb";
import { STEADY_PRESENCE } from "@/agent/mira-presence";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const actorId = await resolveActor();
  // If there's no ownership cookie, the page is a privacy explainer:
  // no summary card, the "Nothing retained" empty state will render
  // (because listOwned for an unknown actor returns []). Same shape
  // as a first-time visitor.
  const episodes = actorId
    ? await episodeRepository.listOwned(actorId)
    : [];
  const memory = actorId
    ? // Projector-only result; no Cognee recall on this surface.
      await projectActorMemory(actorId, episodes)
    : null;
  const miraPresence = activeEpisodePresence(episodes) ?? STEADY_PRESENCE;

  return (
    <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 py-16">
      <Link href="/" className="tag hover:text-foreground">
        ← back
      </Link>
      <div className="flex items-center gap-4 mt-8 mb-8">
        <MiraOrb size={56} presence={miraPresence} />
        <div>
          <p className="font-serif text-2xl">Mira</p>
          <p className="tag">your intention &amp; privacy</p>
        </div>
      </div>
      <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-4">
        What I am keeping in mind.
      </h1>
      <p className="text-[color:var(--muted)] text-lg leading-relaxed mb-4">
        Operational history belongs to each intention. It is stored behind an
        anonymous ownership cookie, not in a public URL. You can inspect,
        export, or delete it here.
      </p>
      <p className="why mb-10">
        Each entry below is what Mira is allowed to remember — your intention,
        what you have clarified, and the steps that followed. Nothing here is
        shared with retreats, wallets, or invitees.
      </p>

      {/* Server-rendered recognition summary card. Lands in initial
          HTML so smoke-ui.mjs's data-testid="memory-summary" check
          finds it on first paint, not after client hydration. The
          card only renders when projector.isReturning is true; a
          fresh visitor sees the privacy explainer above plus the
          "Nothing retained" empty state from MemoryView below. */}
      {memory?.isReturning && (
        <aside
          aria-label="what our previous visits looked like"
          aria-live="polite"
          data-testid="memory-summary"
          className="border-l-2 border-[color:var(--accent-soft)] pl-5 mb-8"
        >
          <div className="flex items-start gap-3 mb-3">
            <MiraOrb size={40} presence={miraPresence} />
            <p className="tag pt-2">what our previous visits looked like</p>
          </div>
          <div className="space-y-2 leading-relaxed">
            <p>
              You have surfaced{" "}
              <strong>{memory.pastMatches.length}</strong> recommendation
              {memory.pastMatches.length === 1 ? "" : "s"} so far.
              {memory.pastMatches[0] && (
                <>
                  {" "}
                  Most recently,{" "}
                  <span className="italic text-[color:var(--accent-ink)]">
                    {memory.pastMatches[0].title}
                  </span>{" "}
                  in {memory.pastMatches[0].location}.
                </>
              )}
            </p>
            {memory.pastBookings[0] && (
              <p>
                You committed to{" "}
                <span className="italic text-[color:var(--accent-ink)]">
                  {memory.pastBookings[0].title}
                </span>{" "}
                in {memory.pastBookings[0].location}.
              </p>
            )}
            {memory.energyHistory.length >= 2 && (
              <p className="text-sm text-[color:var(--muted)]">
                Energy over time:{" "}
                {memory.energyHistory.slice(-3).join(" → ")}.
              </p>
            )}
          </div>
        </aside>
      )}

      <MemoryView episodes={episodes} />
    </section>
  );
}
