import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Arrival contract — marketplace-gravity guard.
 *
 * Source of truth: docs/design/arrival.md, "What arrival must never do"
 * and "Enforcement" sections. When adding or removing a pattern, edit
 * both this list and the Enforcement section in the same change.
 *
 * Contract: no browse grid, destination search, filters, or catalog CTA
 * on /. Treat marketplace gravity as a regression bug.
 *
 * Runs in `npm test` (vitest) inside the `verify` CI job. Future UX
 * contract guards (commit disclosure, operator ritual, etc.) should
 * follow the same source-of-truth pattern.
 */
const FORBIDDEN = [
  /browse\s+retreats/i,
  /search\s+destination/i,
  /filter\s+by/i,
  /compare\s+prices/i,
  /catalog/i,
  /href=["']\/retreats/i,
];

const ROOTS = [
  join(process.cwd(), "src/components/ArrivalScreen.tsx"),
  join(process.cwd(), "src/app/page.tsx"),
];

describe("arrival marketplace gravity guard", () => {
  for (const file of ROOTS) {
    it(`keeps marketplace affordances out of ${file.split("/").slice(-2).join("/")}`, () => {
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        expect(src, `forbidden pattern ${pattern} in ${file}`).not.toMatch(pattern);
      }
    });
  }
});
