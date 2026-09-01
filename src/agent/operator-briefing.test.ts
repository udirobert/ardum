import { describe, expect, it } from "vitest";
import { operatorBriefing } from "./operator-briefing";
import type { BriefingRetreat } from "./operator-briefing";

function retreat(
  title: string,
  demand?: { totalMatches: number; activeHolds: number; bookings: number },
): BriefingRetreat {
  return { title, demand };
}

describe("operatorBriefing", () => {
  it("returns null for an operator with no retreats", () => {
    expect(operatorBriefing([])).toBeNull();
  });

  it("stays warm and generic when nothing is moving", () => {
    const b = operatorBriefing([retreat("Stillwater", {
      totalMatches: 0,
      activeHolds: 0,
      bookings: 0,
    })])!;
    expect(b.headline).toMatch(/watching/);
    expect(b.lines).toHaveLength(0);
  });

  it("leads with bookings, then holds, then matches", () => {
    const b = operatorBriefing([
      retreat("Stillwater", { totalMatches: 4, activeHolds: 1, bookings: 2 }),
      retreat("Mountain Air", { totalMatches: 1, activeHolds: 0, bookings: 0 }),
    ])!;
    expect(b.headline).toMatch(/bookings have landed/);
    expect(b.lines[0]).toMatch(/bookings across 2 retreats|booking/);
    const holdsLine = b.lines.find((l) => l.match(/holding spots|Holds are/));
    expect(holdsLine).toBeTruthy();
    expect(b.lines.some((l) => l.match(/most fitting intentions/))).toBe(true);
  });

  it("names the strongest retreat for matches", () => {
    const b = operatorBriefing([
      retreat("Stillwater", { totalMatches: 2, activeHolds: 0, bookings: 0 }),
      retreat("Mountain Air", { totalMatches: 7, activeHolds: 0, bookings: 0 }),
    ])!;
    expect(b.lines.some((l) => l.includes("Mountain Air"))).toBe(true);
  });

  it("notes quiet retreats without scolding", () => {
    const b = operatorBriefing([
      retreat("Stillwater", { totalMatches: 3, activeHolds: 0, bookings: 0 }),
      retreat("Mountain Air", { totalMatches: 0, activeHolds: 0, bookings: 0 }),
    ])!;
    const quiet = b.lines.find((l) => l.includes("Mountain Air"));
    expect(quiet).toMatch(/still watching/);
    expect(quiet).not.toMatch(/fail|worry|problem/i);
  });

  it("never leaks individual data — only counts the cards already show", () => {
    const b = operatorBriefing([
      retreat("Stillwater", { totalMatches: 5, activeHolds: 2, bookings: 1 }),
    ])!;
    const all = [b.headline, ...b.lines].join(" ");
    // Aggregate counts only; no names, no intention text, no wallet shapes.
    expect(all).not.toMatch(/practitioner named|said|wants to/i);
  });
});
