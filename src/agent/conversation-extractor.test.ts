import { describe, it, expect } from "vitest";
import { extractConstraints, hasConstraints } from "./conversation-extractor";

/**
 * Conversation-extractor corpus test (Track A / Phase A2).
 *
 * Pins the keyword extractor's exact behavior on a realistic set of messages.
 * This is a measurement tool: it documents BOTH what the extractor handles well
 * and where it intentionally narrows to clarification (returns {}). Near-miss
 * cases are spelled out inline so a regression is a visible diff rather than a
 * silent behavior change.
 *
 * Known, pinned limitations (Phase A4 will replace this with LLM extraction):
 *  - Bare "thousand" without a band keyword is ambiguous -> {} (no budget band).
 *  - "1,500" is not a recognized trigger (no 1,000 / 1k substring) -> {}.
 *  - "solitude" is not a social keyword -> {}.
 *  - Vague cost phrasing ("can't spend that much") -> {} (falls back to
 *    clarification).
 */
describe("conversation-extractor corpus", () => {
  describe("budget", () => {
    it("under-1k via 'too expensive'", () => {
      expect(extractConstraints("That's too expensive for me")).toEqual({ budget: "under-1k" });
    });
    it("under-1k via 'cheaper'", () => {
      expect(extractConstraints("Could you find something cheaper?")).toEqual({ budget: "under-1k" });
    });
    it("under-1k via 'under $1,000' (dollar-sign + comma handled)", () => {
      expect(extractConstraints("I want to come in under $1,000")).toEqual({ budget: "under-1k" });
    });
    it("2k-3k via bare '2k' (numeric amount triggers budget group)", () => {
      expect(extractConstraints("I'll budget about 2k for this")).toEqual({ budget: "2k-3k" });
    });
    it("2k-3k via 'can't spend more than 2k'", () => {
      expect(extractConstraints("I can't spend more than 2k")).toEqual({ budget: "2k-3k" });
    });
    it("3k-plus via 'three thousand' (no longer misclassed as 1k-2k)", () => {
      expect(extractConstraints("Around three thousand — I'm ready to splurge")).toEqual({ budget: "3k-plus" });
    });
    it("group trigger without a band resolves to no band (near-miss -> clarification)", () => {
      expect(extractConstraints("The pricing is an issue")).toEqual({});
    });
    it("bare 'thousand' has no unambiguous band -> {}", () => {
      expect(extractConstraints("Around a thousand, give or take")).toEqual({});
    });
    it("formatted amount '1,500' is not a recognized band -> {} (pinned limitation)", () => {
      expect(extractConstraints("About 1,500 if possible")).toEqual({});
    });
    it("vague cost phrasing -> {} (pinned limitation)", () => {
      expect(extractConstraints("I can't spend that much")).toEqual({});
    });
  });

  describe("duration", () => {
    it("shorter w/o a sub-keyword defaults to 5 days", () => {
      expect(extractConstraints("Something shorter, if you have one")).toEqual({ duration: 5 });
    });
    it("shorter + weekend -> 2 days", () => {
      expect(extractConstraints("A weekend would be perfect — shorter is better")).toEqual({ duration: 2 });
    });
    it("shorter + four days -> 4 days", () => {
      expect(extractConstraints("Can you make it four days, something shorter")).toEqual({ duration: 4 });
    });
    it("longer + two weeks -> 14 days", () => {
      expect(extractConstraints("I have more time — let's make it two weeks")).toEqual({ duration: 14 });
    });
    it("extended stay defaults to 1 week", () => {
      expect(extractConstraints("An extended stay")).toEqual({ duration: 7 });
    });
  });
describe("social", () => {
    it("by myself -> solo", () => {
      expect(extractConstraints("Just by myself, ideally")).toEqual({ social: "solo" });
    });
    it("partner -> small-circle", () => {
      expect(extractConstraints("I'd be going with my partner")).toEqual({ social: "small-circle" });
    });
    it("group -> open-circle", () => {
      expect(extractConstraints("A group setting works for me")).toEqual({ social: "open-circle" });
    });
    it("go alone -> solo", () => {
      expect(extractConstraints("I'd rather go alone")).toEqual({ social: "solo" });
    });
    it("'solitude' is not a keyword -> {} (pinned limitation)", () => {
      expect(extractConstraints("Solitude matters more than anything")).toEqual({});
    });
  });

  describe("dates", () => {
    it("September -> 2026-09", () => {
      expect(extractConstraints("September, if possible")).toEqual({ dates: "2026-09" });
    });
    it("October -> 2026-10", () => {
      expect(extractConstraints("Come October")).toEqual({ dates: "2026-10" });
    });
    it("fall -> 2026-10 (default fall month)", () => {
      expect(extractConstraints("Sometime in fall")).toEqual({ dates: "2026-10" });
    });
    it("next month -> computed dynamically", () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const expected = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      expect(extractConstraints("Next month works")).toEqual({ dates: expected });
    });
    it("'maybe' contains 'may' -> spurious 2026-05 (pinned limitation)", () => {
      expect(extractConstraints("Maybe two weeks")).toEqual({ duration: 14, dates: "2026-05" });
    });
  });

  describe("energy", () => {
    it("calm -> settled", () => {
      expect(extractConstraints("I need something calm and restorative")).toEqual({ energy: "settled" });
    });
    it("deeper -> sharp", () => {
      expect(extractConstraints("I need something deeper")).toEqual({ energy: "sharp" });
    });
    it("exhausted -> low", () => {
      expect(extractConstraints("I'm exhausted, need to recover")).toEqual({ energy: "low" });
    });
    it("active + flow -> in-movement", () => {
      expect(extractConstraints("Keep it active, with flow")).toEqual({ energy: "in-movement" });
    });
  });

  describe("combinations", () => {
    it("budget + social", () => {
      expect(extractConstraints("Too expensive, and I really want to go solo")).toEqual({
        budget: "under-1k",
        social: "solo",
      });
    });
    it("energy + date", () => {
      expect(extractConstraints("Quiet, in September, please")).toEqual({
        energy: "settled",
        dates: "2026-09",
      });
    });
  });

  describe("hasConstraints fallback", () => {
    it("false when nothing extracted (ambiguous input -> clarification)", () => {
      expect(hasConstraints(extractConstraints("Hmm, I'm not sure"))).toBe(false);
      expect(hasConstraints({})).toBe(false);
    });
    it("true when any constraint extracted", () => {
      expect(hasConstraints(extractConstraints("Something shorter, please"))).toBe(true);
      expect(hasConstraints({ budget: "under-1k" })).toBe(true);
    });
  });
});