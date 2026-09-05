// Server component — derives the returning-practitioner greeting
// from the projected memory and hands it to ArrivalScreen (a client
// component) as a plain string prop.
//
// Why projector-only here: the home greeting only uses operational
// fields (pastBookings, pastMatches) — pastNotes from Cognee are
// free-form prose that has no business surfacing on the home
// surface. Skipping Cognee enrichment keeps SSR strictly operational
// and bounds the render cost on first paint (no waiting on a remote
// recall with no timeout).
//
// Why server-side at all: the actor cookie is read with
// `resolveActor`, which is server-only, and the episode repo is
// server-only too. Doing this server-side also means the greeting
// renders on first paint (no flash of "What are you trying to make
// space for?" → "Welcome back" flicker).

import { resolveActor } from "@/identity/actor";
import { episodeRepository } from "@/episodes/repository";
import { activeEpisodePresence } from "@/episodes/detail-payload";
import { projectActorMemory } from "@/memory/enrich";
import { actorProfileRepository } from "@/identity/actor-profile";
import ArrivalScreen from "@/components/ArrivalScreen";
import type { Episode } from "@/episodes/model";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actorId = await resolveActor();
  let greeting: string | null = null;
  let preferredName: string | null = null;
  let episodeBootstrap:
    | { episode: Episode | null; presence: ReturnType<typeof activeEpisodePresence> }
    | undefined;
  if (actorId) {
    const [episodes, profile] = await Promise.all([
      episodeRepository.listOwned(actorId),
      actorProfileRepository.get(actorId),
    ]);
    preferredName = profile.preferredName;
    const activeEpisode =
      episodes.find((item) => item.status !== "completed") ?? null;
    episodeBootstrap = {
      episode: activeEpisode,
      presence: activeEpisodePresence(episodes),
    };
    const memory = await projectActorMemory(actorId, episodes);
    const booking = memory.pastBookings[0];
    const last = memory.pastMatches[0];
    const name = preferredName;
    // The greeting bridges the active intention to past context — it
    // doesn't lead with a retreat. The intention is what the person is
    // holding now; the past match is color, not the headline.
    const intention = activeEpisode?.intentions.at(-1)?.statement;
    if (memory.isReturning || name) {
      const intentionPhrase = intention
        ? intention.length <= 60
          ? intention
          : `${intention.slice(0, 57)}…`
        : null;
      if (intentionPhrase && last) {
        greeting = name
          ? `Welcome back, ${name}. You're holding "${intentionPhrase}" — last time you were considering ${last.title} in ${last.location}.`
          : `Welcome back. You're holding "${intentionPhrase}" — last time you were considering ${last.title} in ${last.location}.`;
      } else if (intentionPhrase && booking) {
        greeting = name
          ? `Welcome back, ${name}. You're holding "${intentionPhrase}" — last time you booked ${booking.title} in ${booking.location}.`
          : `Welcome back. You're holding "${intentionPhrase}" — last time you booked ${booking.title} in ${booking.location}.`;
      } else if (intentionPhrase) {
        greeting = name
          ? `Welcome back, ${name}. You're holding "${intentionPhrase}".`
          : `Welcome back. You're holding "${intentionPhrase}".`;
      } else if (booking) {
        greeting = name
          ? `Welcome back, ${name}. We last saw you booked ${booking.title} in ${booking.location}.`
          : `Welcome back. We last saw you booked ${booking.title} in ${booking.location}.`;
      } else if (last) {
        greeting = name
          ? `Welcome back, ${name}. Last time you were considering ${last.title} in ${last.location}.`
          : `Welcome back. Last time you were considering ${last.title} in ${last.location}.`;
      } else {
        greeting = name ? `Welcome back, ${name}.` : "Welcome back.";
      }
    }
  }
  // Always bootstrap — even with no actor cookie — so first paint is the
  // intention ask (or returning resume), not a centered "Mira" loading
  // flash while the client fetches. Arrival contract: input must not wait.
  return (
    <ArrivalScreen
      greeting={greeting}
      preferredName={preferredName}
      episodeBootstrap={
        episodeBootstrap ?? { episode: null, presence: null }
      }
    />
  );
}
