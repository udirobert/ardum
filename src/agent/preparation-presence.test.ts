import { describe, expect, it } from "vitest";
import {
  daysSinceBooking,
  preparationPresence,
} from "./preparation-presence";

const NOW = new Date("2026-08-20T12:00:00.000Z");
const iso = (daysAgo: number) =>
  new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

describe("daysSinceBooking", () => {
  it("counts whole days elapsed", () => {
    expect(daysSinceBooking(iso(3), NOW)).toBe(3);
  });

  it("never goes negative for future dates (clock skew)", () => {
    expect(daysSinceBooking(iso(-2), NOW)).toBe(0);
  });

  it("returns 0 for unparseable timestamps rather than throwing", () => {
    expect(daysSinceBooking("not-a-date", NOW)).toBe(0);
  });
});

describe("preparationPresence", () => {
  it("radiates on booking day — the arriving moment", () => {
    expect(preparationPresence(iso(0), NOW)).toEqual({
      posture: "arriving",
      valence: 0,
    });
  });

  it("holds through the first two days", () => {
    expect(preparationPresence(iso(1), NOW).posture).toBe("holding");
    expect(preparationPresence(iso(2), NOW).posture).toBe("holding");
  });

  it("gathers at the mid-arc anticipation peak", () => {
    expect(preparationPresence(iso(3), NOW)).toEqual({
      posture: "gathering",
      valence: 0.1,
    });
  });

  it("resolves from day four as the plan completes", () => {
    expect(preparationPresence(iso(4), NOW).posture).toBe("resolving");
    expect(preparationPresence(iso(9), NOW).posture).toBe("resolving");
  });
});
