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

// One short warm line when the practitioner has memory worth naming.
// Kept distinct from matchLetter() — the letter is for the episode
// page; the home greeting is "you've been here, here's where you
// left things" and nothing more. Booking beats match because it is
// the more concrete marker of an ended journey.
//
// ADR 0011: when the practitioner has given Mira their name, the
// greeting uses it. The name is an explicit statement by the person,
// never inferred from email or provider metadata.
async function buildHomeGreeting(
  actorId: string,
): Promise<string | null> {
  const [episodes, profile] = await Promise.all([
    episodeRepository.listOwned(actorId),
    actorProfileRepository.get(actorId),
  ]);
  // Projector-only result — no cognee call. semantic argument omitted.
  const memory = await projectActorMemory(actorId, episodes);
  if (!memory.isReturning && !profile.preferredName) return null;
  const name = profile.preferredName;
  const booking = memory.pastBookings[0];
  if (booking) {
    return name
      ? `Welcome back, ${name}. We last saw you booked ${booking.title} in ${booking.location}.`
      : `Welcome back. We last saw you booked ${booking.title} in ${booking.location}.`;
  }
  const last = memory.pastMatches[0];
  if (last) {
    return name
      ? `Welcome back, ${name}. Last time you were considering ${last.title} in ${last.location}.`
      : `Welcome back. Last time you were considering ${last.title} in ${last.location}.`;
  }
  return name ? `Welcome back, ${name}.` : "Welcome back.";
}

export default async function Home() {
  const actorId = await resolveActor();
  const greeting = actorId ? await buildHomeGreeting(actorId) : null;
  return <ArrivalScreen greeting={greeting} />;
}
