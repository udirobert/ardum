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
import { projectActorMemory } from "@/memory/enrich";
import { actorProfileRepository } from "@/identity/actor-profile";
import ArrivalScreen from "@/components/ArrivalScreen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actorId = await resolveActor();
  let greeting: string | null = null;
  let preferredName: string | null = null;
  if (actorId) {
    const [episodes, profile] = await Promise.all([
      episodeRepository.listOwned(actorId),
      actorProfileRepository.get(actorId),
    ]);
    preferredName = profile.preferredName;
    const memory = await projectActorMemory(actorId, episodes);
    const booking = memory.pastBookings[0];
    const last = memory.pastMatches[0];
    const name = preferredName;
    if (memory.isReturning || name) {
      if (booking) {
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
  return <ArrivalScreen greeting={greeting} preferredName={preferredName} />;
}
