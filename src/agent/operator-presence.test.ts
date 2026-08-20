import { describe, expect, it } from "vitest";
import { operatorPresence } from "./operator-presence";

describe("operatorPresence", () => {
  it("projects steady when there is no demand", () => {
    expect(
      operatorPresence({ totalMatches: 0, activeHolds: 0, bookings: 0 }),
    ).toEqual({ posture: "steady", valence: 0 });
  });

  it("projects watching once intentions match", () => {
    expect(
      operatorPresence({ totalMatches: 4, activeHolds: 0, bookings: 0 }),
    ).toEqual({ posture: "watching", valence: 0 });
  });

  it("projects gathering while holds are live", () => {
    expect(
      operatorPresence({ totalMatches: 4, activeHolds: 1, bookings: 0 }),
    ).toEqual({ posture: "gathering", valence: 0.1 });
  });

  it("projects arriving once a booking lands — bookings outrank holds", () => {
    expect(
      operatorPresence({ totalMatches: 4, activeHolds: 2, bookings: 1 }),
    ).toEqual({ posture: "arriving", valence: 0 });
  });
});
