// Operator briefing — Mira-authored summary for the /operator surface.
//
// The "morning ritual": one voice-authored read of the operator's demand,
// rendered above the retreat list. Pure projection, mirrors
// mira-presence.ts / preparation-presence.ts — aggregates from the same
// demand counts the retreat cards show, never individual practitioner
// data (the density gate, ADR 0010, applies with full force here: the
// briefing may only speak in counts the operator can already see on
// their own cards).
//
// Register: advocate, not dashboard. Mira works for the operator the
// way she works for the practitioner — she watched, here's what she saw.

export type BriefingRetreat = {
  title: string;
  demand?: {
    totalMatches: number;
    activeHolds: number;
    bookings: number;
  };
};

export type OperatorBriefing = {
  /** One-sentence headline — the whole ritual in a single read. */
  headline: string;
  /** Supporting lines, ordered by relevance. Empty when nothing to say. */
  lines: string[];
};

export function operatorBriefing(retreats: BriefingRetreat[]): OperatorBriefing | null {
  if (retreats.length === 0) return null;

  const demands = retreats.map((r) => ({
    title: r.title,
    matches: r.demand?.totalMatches ?? 0,
    holds: r.demand?.activeHolds ?? 0,
    bookings: r.demand?.bookings ?? 0,
  }));

  const totalMatches = demands.reduce((n, d) => n + d.matches, 0);
  const totalHolds = demands.reduce((n, d) => n + d.holds, 0);
  const totalBookings = demands.reduce((n, d) => n + d.bookings, 0);

  // Nothing moving yet — say so warmly, without fake activity.
  if (totalMatches === 0 && totalHolds === 0 && totalBookings === 0) {
    return {
      headline:
        "I'm watching all of your retreats. When someone's intention fits, you'll be the first to know.",
      lines: [],
    };
  }

  const lines: string[] = [];

  // Bookings lead — the loop closing is the headline event.
  if (totalBookings > 0) {
    const booked = demands.filter((d) => d.bookings > 0);
    lines.push(
      booked.length === 1
        ? `${booked[0].title} has ${booked[0].bookings} ${booked[0].bookings === 1 ? "booking" : "bookings"} in place.`
        : `${totalBookings} ${totalBookings === 1 ? "booking" : "bookings"} across ${booked.length} retreats.`,
    );
  }

  // Holds second — demand one step before conversion.
  if (totalHolds > 0) {
    const holding = demands
      .filter((d) => d.holds > 0)
      .sort((a, b) => b.holds - a.holds);
    lines.push(
      holding.length === 1
        ? `${holding[0].holds} ${holding[0].holds === 1 ? "person is" : "people are"} holding spots at ${holding[0].title} right now.`
        : `Holds are spread across ${holding.length} retreats — ${holding[0].title} leads with ${holding[0].holds}.`,
    );
  }

  // Matches third — the earliest signal, the one nobody else shows.
  if (totalMatches > 0) {
    const strongest = [...demands]
      .filter((d) => d.matches > 0)
      .sort((a, b) => b.matches - a.matches)[0];
    lines.push(
      `${strongest.title} is drawing the most fitting intentions — ${strongest.matches} so far.`,
    );
  }

  // Quiet retreats — honest, never scolding.
  const quiet = demands.filter(
    (d) => d.matches === 0 && d.holds === 0 && d.bookings === 0,
  );
  if (quiet.length > 0) {
    lines.push(
      quiet.length === 1
        ? `${quiet[0].title} hasn't drawn a fitting intention yet. I'm still watching.`
        : `${quiet.length} retreats haven't drawn a fitting intention yet. I'm still watching them all.`,
    );
  }

  const headline =
    totalBookings > 0
      ? `Good morning. ${totalBookings === 1 ? "One booking has" : `${totalBookings} bookings have`} landed through Mira — here's where things stand.`
      : totalHolds > 0
        ? `Good morning. ${totalHolds === 1 ? "One person is" : `${totalHolds} people are`} holding space with you right now.`
        : "Good morning. Interest is forming — here's what I've seen.";

  return { headline, lines };
}
