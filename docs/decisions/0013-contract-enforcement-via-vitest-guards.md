# 0013 — Contract enforcement via vitest guards

- Status: Accepted
- Date: 2026-09-05

## Context

Surface-level UX contracts in this codebase live as prose in
`docs/design/*.md` (e.g. `arrival.md`). The 2026-08-24 architecture
review scored the project 9/10 on documentation discipline and 8/10 on
UI/UX, with the explicit note that contract work was prose-driven and
relied on code review to catch regressions.

The 2026-09-05 fragile-surface pass raised arrival from ~8 to 8.5
([`docs/reviews/2026-09-05-ux-8-5-pass.md`](../reviews/2026-09-05-ux-8-5-pass.md))
and introduced a regression guard: a vitest test that reads
`src/components/ArrivalScreen.tsx` and `src/app/page.tsx` and fails the
build if any of six forbidden patterns appears. The guard is in
[`src/components/__tests__/arrival-marketplace-guard.test.ts`](../../src/components/__tests__/arrival-marketplace-guard.test.ts);
the patterns it enforces come from the "What arrival must never do" and
the new "Enforcement" sections of `arrival.md`.

Two problems emerged immediately:

1. **Silent drift.** The prose contract and the test contract referenced
   each other only loosely. Adding or removing a forbidden pattern in
   one without the other would not be caught by either. PR #14 closed
   the immediate loop by adding bidirectional links, but the link is
   convention-only — nothing enforces that future guards follow it.
2. **No convention to copy.** The next fragile surface to harden (commit
   disclosure, operator ritual, secondary-surface tone) will need its
   own guard. Without a documented pattern, each new guard will reinvent
   the structure, the JSDoc, and the doc link — or skip them.

AGENTS.md calls out the underlying engineering principle explicitly:
*DRY: shared logic and contracts have one source of truth.* The arrival
contract pair (one doc, one guard) is the smallest viable realisation of
that, and we already built it once. The decision now is whether to
formalise the pair as the project convention.

## Decision

UX contract enforcement follows a **one-doc / one-guard** pattern. Each
named contract has exactly two artefacts:

### 1. The doc

Lives under `docs/design/<name>.md`. Has a `## Enforcement` section
that:

- Names the guard file by absolute repo path.
- Lists every forbidden pattern (or required invariant) the guard
  checks, in the same order as the test source.
- Instructs the reader: *"When adding or removing a pattern, edit both
  this section and the `<FORBIDDEN | REQUIRED>` list at the top of the
  guard test in the same change."*
- Notes that the guard runs in `npm test` (vitest) inside the `verify`
  CI job.

### 2. The guard

Lives under `src/**/__tests__/<name>-guard.test.ts`. The naming
convention is `<contract-name>-guard.test.ts` so it sorts with the other
test files and is greppable by the `-guard` suffix. Each guard:

- Reads the source file(s) it covers from disk via `node:fs`.
- Asserts each one against a named list of patterns (`FORBIDDEN` for
  negative contracts, `REQUIRED` for positive ones).
- Has a JSDoc header that names the doc source of truth and the
  specific anchor (`"What X must never do" and "Enforcement" sections`),
  and notes that future contract guards should follow the same pattern.
- Imports only from `vitest` and `node:fs`/`node:path` — no app code,
  no React, no Next. Guards must be runnable in isolation without the
  build pipeline.

### What is and isn't in scope

**In scope:** surface-level UX contracts where prose → code is the
enforcement. Examples that fit: arrival never-do list, commitment
disclosure wording, operator dashboard tone, empty/error vocabulary,
banned marketplace affordances.

**Out of scope:** domain invariants already covered by the repository
contract suite (`src/episodes/repositories/contract.suite.ts`), ranking
policy property tests, and attestation flow tests. Those enforce
behavioural contracts and have their own conventions.

### When to add a guard

When a contract becomes a *standing prohibition* (e.g. "never show a
browse affordance on `/`") or a *required tone* (e.g. "empty Listening
must say X, not Y"), and the cost of a regression is high enough that
relying on code review is the wrong primitive. PR-time eyeballing is
fine for ephemeral copy decisions; vitest is the right tool for
permanent surface contracts.

## Consequences

- **Adding a UX contract requires two file changes in one PR.** A doc
  section and a guard file. Reviewers can verify the pattern lists
  match without external coordination.
- **The pattern list lives once.** Doc and test still have separate
  copies of the patterns, but they are co-located in a way the JSDoc
  makes obvious. A future improvement (out of scope for this ADR) is to
  generate one from the other — the current pattern keeps both readable
  by humans without a build step.
- **Regression class is now CI-visible.** A copy change that
  reintroduces a forbidden marketplace pattern fails the build, not the
  code review. This raises the score for *Verification & testing* on
  future reviews without changing *Documentation discipline*.
- **Drift is detectable but not prevented.** Nothing stops a future
  contributor from editing one without the other — but the JSDoc says
  they shouldn't, and the doc says the same thing in the other
  direction. The convention is a social contract backed by a CI check
  that runs every PR.
- **Guard files add small test overhead.** Each guard reads 1–3 files
  from disk and runs ~10 assertions. Negligible compared to the full
  vitest suite (395 tests, 3.5s); the marketplace guard adds 4 ms.

## References

- [`docs/design/arrival.md`](../design/arrival.md) — first contract
- [`src/components/__tests__/arrival-marketplace-guard.test.ts`](../../src/components/__tests__/arrival-marketplace-guard.test.ts)
  — first guard
- [`docs/reviews/2026-09-05-ux-8-5-pass.md`](../reviews/2026-09-05-ux-8-5-pass.md)
  — fragile-surface pass that introduced the guard
- PR #12 (`feat/ux-8-5-fragile-surfaces`) — fragile-surface pass
- PR #14 (`docs: link arrival contract to its marketplace-gravity guard`)
  — bidirectional link between doc and test
- [AGENTS.md](../../AGENTS.md) — DRY principle and source-of-truth rules
