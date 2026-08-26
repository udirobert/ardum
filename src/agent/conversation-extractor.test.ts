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

  // ──────────────────────────────────────────────────────────────────────
  // Expanded corpus — realistic practitioner reactions, edge cases, and
  // pinned limitations. The goal is to document what the keyword extractor
  // actually does on the messy language a practitioner would type in the
  // voice lane, so a regression or an A4 LLM replacement is a visible diff.
  // ──────────────────────────────────────────────────────────────────────

  describe("realistic reactions (full voice-lane sentences)", () => {
    it("too pricey, want solo -> social only ('pricey' not a trigger word — pinned)", () => {
      // "pricey" contains "price" so it enters the budget group, but no
      // band keyword matches ("too pricey" ≠ "too expensive") → no band.
      // Only social is extracted.
      expect(extractConstraints("This is too pricey for me right now, and I'd rather go alone")).toEqual({
        social: "solo",
      });
    });
    it("need calm, September, cheaper -> energy + date + budget", () => {
      expect(extractConstraints("I need something calm and restorative in September, and cheaper if possible")).toEqual({
        energy: "settled",
        budget: "under-1k",
        dates: "2026-09",
      });
    });
    it("longer with partner, 2k budget -> duration + social + budget", () => {
      expect(extractConstraints("I want something longer, going with my partner, about 2k")).toEqual({
        duration: 7,
        social: "small-circle",
        budget: "2k-3k",
      });
    });
    it("exhausted, weekend, alone -> energy + duration(7!) + social (pinned: 'weekend' contains 'week' → longer branch)", () => {
      // "weekend" contains "week", which triggers the "longer" branch
      // (defaulting to 7 days) instead of the "shorter" branch (2 days).
      // This is a real false positive — pinned until the extractor adds
      // word-boundary checks or an LLM replacement (Phase A4).
      expect(extractConstraints("I'm exhausted — a weekend would be great, just by myself")).toEqual({
        energy: "low",
        duration: 7,
        social: "solo",
      });
    });
    it("active flow, October, group -> energy + date + social", () => {
      expect(extractConstraints("Keep it active with flow, October, group setting")).toEqual({
        energy: "in-movement",
        dates: "2026-10",
        social: "open-circle",
      });
    });
  });

  describe("negation and contrast", () => {
    it("'not expensive' still triggers budget group (no negation handling — pinned)", () => {
      // The extractor has no negation logic. "not expensive" contains
      // "expensive" and triggers the budget group, then falls through to
      // no band because no band keyword matches. This is a known limitation.
      expect(extractConstraints("It's not expensive, but I want something shorter")).toEqual({
        duration: 5,
      });
    });
    it("'don't want to go alone' still triggers solo (no negation — pinned)", () => {
      // "alone" is a social keyword. No negation handling, so "don't want
      // to go alone" still returns solo. This is a real fragility.
      expect(extractConstraints("I don't want to go alone")).toEqual({
        social: "solo",
      });
    });
    it("'not shorter, I want longer' -> duration 5 (shorter checked first — pinned)", () => {
      // Both "shorter" and "longer" are present. The if/else checks
      // shorter first, so shorter wins → duration 5. No negation handling.
      expect(extractConstraints("Not shorter, I want something longer")).toEqual({
        duration: 5,
      });
    });
  });

  describe("budget edge cases", () => {
    it("under $1k with space before k -> under-1k", () => {
      expect(extractConstraints("Under $1k would be ideal")).toEqual({ budget: "under-1k" });
    });
    it("affordable -> under-1k", () => {
      expect(extractConstraints("Something more affordable")).toEqual({ budget: "under-1k" });
    });
    it("less than 2000 -> under-1k ('less' matches under-1k branch — pinned)", () => {
      // "less" matches the under-1k branch. This is a false positive.
      expect(extractConstraints("Less than 2000")).toEqual({ budget: "under-1k" });
    });
    it("premium -> {} (not a budget group trigger word — pinned)", () => {
      // "premium" is a 3k-plus band keyword, but it's inside the budget
      // group which is only entered when a trigger word ("expensive",
      // "price", "cost", etc.) is present. "premium" alone doesn't
      // trigger the group → no budget extracted. This is a real gap.
      expect(extractConstraints("I'm fine with premium")).toEqual({});
    });
    it("luxury -> {} (not a budget group trigger word — pinned)", () => {
      // Same issue as "premium" — "luxury" is a band keyword inside the
      // budget group, but not a trigger for the group itself.
      expect(extractConstraints("Looking for something luxurious")).toEqual({});
    });
    it("bare 'budget' word triggers group but no band -> {} ", () => {
      expect(extractConstraints("My budget is flexible")).toEqual({});
    });
    it("dollar amount with no comma: $3000 -> 3k-plus", () => {
      expect(extractConstraints("Around $3000")).toEqual({ budget: "3k-plus" });
    });
    it("dollar amount with comma: $2,000 -> 2k-3k", () => {
      expect(extractConstraints("About $2,000")).toEqual({ budget: "2k-3k" });
    });
    it("'cost' trigger without band -> {}", () => {
      expect(extractConstraints("The cost seems reasonable")).toEqual({});
    });
  });

  describe("duration edge cases", () => {
    it("3 days -> {} (no 'shorter' trigger word — pinned)", () => {
      // "3 days" is a shorter-branch sub-keyword, but the shorter branch
      // requires a trigger word ("shorter", "short", "quick", etc.).
      // "Something like 3 days would be perfect" has none → no duration.
      expect(extractConstraints("Something like 3 days would be perfect")).toEqual({});
    });
    it("long weekend -> 7 ('weekend' contains 'week' → longer branch — pinned)", () => {
      // "A long weekend would work" — "weekend" contains "week", which
      // triggers the "longer" branch → defaults to 7 days. The "longer"
      // branch is checked before the shorter branch's "weekend" sub-keyword
      // because "longer"/"week" is the else-if, and "shorter"/"short" is
      // the if — but "short" is not in the message. So "week" wins.
      expect(extractConstraints("A long weekend would work")).toEqual({ duration: 7 });
    });
    it("14 days -> {} (no 'longer' trigger word — pinned)", () => {
      // "14 days" is a longer-branch sub-keyword, but the longer branch
      // requires a trigger word ("longer", "more time", "extended",
      // "week"). "I can do 14 days" has none → no duration.
      expect(extractConstraints("I can do 14 days")).toEqual({});
    });
    it("one week defaults to 7 (via 'week' keyword)", () => {
      expect(extractConstraints("About a week would be great")).toEqual({ duration: 7 });
    });
    it("'quick' defaults to 5", () => {
      expect(extractConstraints("Something quick")).toEqual({ duration: 5 });
    });
    it("no duration keywords -> no duration", () => {
      expect(extractConstraints("The timing doesn't work")).toEqual({});
    });
  });

  describe("social edge cases", () => {
    it("private -> solo", () => {
      expect(extractConstraints("I need something private")).toEqual({ social: "solo" });
    });
    it("just me -> solo", () => {
      expect(extractConstraints("Just me, no one else")).toEqual({ social: "solo" });
    });
    it("friend -> small-circle", () => {
      expect(extractConstraints("Going with a friend")).toEqual({ social: "small-circle" });
    });
    it("couple -> small-circle", () => {
      expect(extractConstraints("A couples retreat")).toEqual({ social: "small-circle" });
    });
    it("community -> open-circle", () => {
      expect(extractConstraints("I want community")).toEqual({ social: "open-circle" });
    });
    it("'with someone' -> small-circle", () => {
      expect(extractConstraints("Going with someone close")).toEqual({ social: "small-circle" });
    });
    it("no social keyword -> no social", () => {
      expect(extractConstraints("I prefer quiet settings")).toEqual({ energy: "settled" });
    });
  });

  describe("dates edge cases", () => {
    it("all 12 months parse correctly", () => {
      const months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
      ];
      for (let i = 0; i < months.length; i++) {
        const result = extractConstraints(`Sometime in ${months[i]}`);
        const expected = `2026-${String(i + 1).padStart(2, "0")}`;
        expect(result).toEqual({ dates: expected });
      }
    });
    it("autumn -> 2026-10 (alias for fall)", () => {
      expect(extractConstraints("In autumn, ideally")).toEqual({ dates: "2026-10" });
    });
    it("'may' as month vs 'maybe' false positive (pinned)", () => {
      // "maybe" contains "may" — spurious date extraction. This is
      // documented as a known limitation.
      expect(extractConstraints("Maybe something cheaper")).toEqual({
        budget: "under-1k",
        dates: "2026-05",
      });
    });
    it("no date keywords -> no dates", () => {
      expect(extractConstraints("I don't care about timing")).toEqual({});
    });
  });

  describe("energy edge cases", () => {
    it("peaceful -> settled", () => {
      expect(extractConstraints("I want something peaceful")).toEqual({ energy: "settled" });
    });
    it("gentle -> settled", () => {
      expect(extractConstraints("Something gentle")).toEqual({ energy: "settled" });
    });
    it("rest -> settled", () => {
      expect(extractConstraints("I need to rest")).toEqual({ energy: "settled" });
    });
    it("transformative -> sharp", () => {
      expect(extractConstraints("I want something transformative")).toEqual({ energy: "sharp" });
    });
    it("challenging -> sharp", () => {
      expect(extractConstraints("Something challenging")).toEqual({ energy: "sharp" });
    });
    it("healing -> low", () => {
      expect(extractConstraints("I need healing")).toEqual({ energy: "low" });
    });
    it("dynamic -> in-movement", () => {
      expect(extractConstraints("Something dynamic")).toEqual({ energy: "in-movement" });
    });
    it("no energy keywords -> no energy", () => {
      expect(extractConstraints("I want a different place")).toEqual({});
    });
  });

  describe("multi-constraint combinations (3+ axes)", () => {
    it("budget + social + duration", () => {
      expect(extractConstraints("Too expensive, going solo, something shorter")).toEqual({
        budget: "under-1k",
        social: "solo",
        duration: 5,
      });
    });
    it("energy + social + date", () => {
      expect(extractConstraints("Calm, with a partner, in October")).toEqual({
        energy: "settled",
        social: "small-circle",
        dates: "2026-10",
      });
    });
    it("budget + energy + social + date", () => {
      expect(extractConstraints("Cheaper, something restorative, alone, in September")).toEqual({
        budget: "under-1k",
        energy: "settled",
        social: "solo",
        dates: "2026-09",
      });
    });
    it("budget + duration(7!) + social + energy (pinned: 'weekend' contains 'week')", () => {
      // "a weekend" contains "week" → triggers the longer branch → 7,
      // not 2. This is the same false positive as the single-constraint
      // "weekend" case above. Pinned until word-boundary checks land.
      expect(extractConstraints("Under 1k, a weekend, by myself, exhausted")).toEqual({
        budget: "under-1k",
        duration: 7,
        social: "solo",
        energy: "low",
      });
    });
  });

  describe("empty / noise / unparseable", () => {
    it("empty string -> {}", () => {
      expect(extractConstraints("")).toEqual({});
    });
    it("whitespace only -> {}", () => {
      expect(extractConstraints("   ")).toEqual({});
    });
    it("single word, no keywords -> {}", () => {
      expect(extractConstraints("Okay")).toEqual({});
    });
    it("emoji and punctuation only -> {}", () => {
      expect(extractConstraints("🧘 ✨")).toEqual({});
    });
    it("long vague sentence -> {}", () => {
      expect(extractConstraints("I'm not really sure what I want but something feels off about this one")).toEqual({});
    });
    it("question back to Mira -> {}", () => {
      expect(extractConstraints("What do you think?")).toEqual({});
    });
  });

  describe("case insensitivity", () => {
    it("ALL CAPS budget", () => {
      expect(extractConstraints("TOO EXPENSIVE")).toEqual({ budget: "under-1k" });
    });
    it("MixedCase social", () => {
      expect(extractConstraints("Going With My Partner")).toEqual({ social: "small-circle" });
    });
    it("camelCase energy", () => {
      expect(extractConstraints("iNeedSomethingCalm")).toEqual({ energy: "settled" });
    });
  });

  describe("word boundary fragility (pinned)", () => {
    it("'restless' contains 'rest' -> settled (false positive, pinned)", () => {
      // "restless" contains "rest" — spurious energy extraction. A word-
      // boundary check would fix this but the current substring match
      // doesn't have one. Pinned as a known limitation.
      expect(extractConstraints("I feel restless")).toEqual({ energy: "settled" });
    });
    it("'pricing' contains 'price' -> budget group, no band -> {}", () => {
      expect(extractConstraints("Let's discuss pricing")).toEqual({});
    });
    it("'groups' contains 'group' -> open-circle", () => {
      expect(extractConstraints("I prefer small groups")).toEqual({ social: "open-circle" });
    });
  });
});