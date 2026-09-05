# 2026-09-05 — Operator flow 9.0 pass (planning)

Branch: not started
Status: planning only. Live operator observation is the gate.

> Companion to [`2026-09-05-ux-8-5-pass.md`](2026-09-05-ux-8-5-pass.md),
> which raised the practitioner (arrival/commit) flow from ~8 to 8.5.
> The operator flow currently sits at an estimated **7.5–8 / 10**
> against the 2026-08-24 review's 8/10 UI/UX score (with "workbench
> density" flagged as the main gap). Target: 9.0.

## Why this is a planning doc, not an implementation

The 8.5 arrival pass taught us the right ordering:

1. Live / local observation of the flow against an honest user
2. Identify the fragile surfaces from that observation
3. Fix the highest-leverage few
4. Codify the standing prohibitions via vitest guards (ADR 0013)

The operator flow is harder to observe locally than the practitioner
flow: it requires a Google social login (Particle Auth + ZeroDev Kernel)
or an injected EVM wallet, and a real on-chain attestation on Arbitrum
Sepolia. We can read the code and the design plan, but a code-reading
pass alone is what produced the 2026-08-24 finding — not enough to push
the score without live confirmation.

So this document:

- Maps the operator surface as it stands today (code-read verified).
- Names the fragile surfaces I've identified by reading.
- Names the contracts that should become vitest guards per ADR 0013.
- Lists the live observation needed before any change ships.

## The operator surface (read-verified)

The operator journey is four pages plus a three-step form:

| Page | File | Read |
|---|---|---|
| `/attest` (intake landing) | `src/app/attest/page.tsx` (36 lines) | 2026-09-05 |
| `/attest` three-step form | `src/attestation/UploadForm.tsx` (415 lines) | 2026-09-05 |
| `/operator` (dashboard) | `src/app/operator/page.tsx` (382 lines) | 2026-09-05 |
| `/operator/[retreatRootHash]` | `src/app/operator/[retreatRootHash]/page.tsx` | 2026-09-05 |
| `/operator/[retreatRootHash]/bookings/[episodeId]` | `src/app/operator/[retreatRootHash]/bookings/[episodeId]/page.tsx` | 2026-09-05 |

Plus the agent counterpart `POST /api/agent/attest` which can pre-fill
the form via query params (`?title=…&location=…`).

## Fragile surfaces observed by code reading

These are the spots where I expect live observation to find either
confirming or refuting evidence. Numbering is for cross-reference in
the follow-up PR; not a priority order.

### F1 — UploadForm mid-step state has no recovery path

`UploadForm` holds three steps of state in component-level `useState`.
Refreshing the page, navigating away, or closing the tab loses all
input. The result panel ("Published") does have a "List another →"
button that resets state, but there is no save-as-draft, no deep-link
to a specific step, and no "are you sure you want to leave" guard on
the browser navigation.

For a one-shot form, this is fine. For a retreat operator who needs to
look up the price or capacity, this is friction that the
`/api/agent/attest` pre-fill was designed to avoid — but only for the
agent path. A human operator hitting the form cold has no escape hatch.

**Hypothesis:** this matters more for first-time operators than for
repeat operators. Need observation.

### F2 — Submitting vs signing states collapse to one label

Both `submitting` and `signingStep === "Publishing your retreat…"` map
the submit button text to "Publishing…". The wallet signature prompt
takes 5–15 s; during that window the user has no signal the request is
even running on their end. The signing copy is set on
`setSigningStep` before the `personal_sign` call, but the submit button
doesn't read it — it reads `signingStep ?? submitting ? "Publishing…" :
"Publish retreat →"`.

**Hypothesis:** users will mistake the silent signing prompt for a
broken submit and try again, double-signing. The EIP-191 signature is
deterministic, so the second signature overwrites the first in the
state, but the UX is still wrong.

### F3 — Sign-in visual hierarchy at step 3

Step 3 surfaces two sign-in paths:

- Google (Particle Auth + ZeroDev Kernel) — labelled "recommended"
- Injected crypto wallet (EIP-191 personal_sign) — labelled "advanced"

The visual treatment is identical (both buttons sit in `space-y-3`
inside a card with a horizontal hairline divider). For an operator
without a wallet, the "advanced" path needs to disappear or move down.
For an operator who already has a wallet, "recommended" should be
their path.

**Hypothesis:** the framing is correct; the visual hierarchy isn't
quite carrying it. Likely needs an `OperatorWalletButton` to render as
the primary and `WalletButton` as a hairline-only secondary, with the
"advanced" label re-styled to feel optional.

### F4 — Step 2 chip row density

Four multi-select chip rows stacked (practice style 11 options ×
energy fit 4 × social fit 4 × breath phase 4). On a 375 px mobile
viewport, this is a long scroll. Operators on phones do exist (small
retreats in Bali, Costa Rica, etc.).

**Hypothesis:** collapse to a sticky bottom-sheet picker on mobile, or
break step 2 into two sub-steps (practice shape + practice energy).
Need observation on mobile.

### F5 — Empty / error vocabulary is generic

The error states on `/attest` and the dashboard fall back to
`providerFailureLine(...)` from `mira-voice.ts`. The booking detail
page uses raw `Could not load booking.` as the error message. There's
no contract yet for what failure copy should say on operator surfaces;
the practitioner flow has `noFitLine`, `offlineLine`, `memoryDeletedLine`,
but operator failure vocabulary isn't named.

This is exactly the kind of thing ADR 0013 is designed to encode once
observed: a doc + a guard. But I don't know what the right shape is
without observation.

### F6 — Dashboard "Sort" affordance

The dashboard offers a sort toggle (`activity` / `recent`) as plain
text buttons. For a small operator with 1 retreat, this is irrelevant.
For one with 10+ retreats, the difference is meaningful.

**Hypothesis:** the toggle should be hidden when `retreats.length <= 2`
and visible otherwise. Trivial fix, low priority.

### F7 — Booking detail "back to <title>" link

The booking detail page's back link uses `detail.retreat.title` as the
link text (`← back to {detail.retreat.title}`). For long retreat
titles this can wrap awkwardly. Probably needs truncation or a fixed-
width back affordance.

**Hypothesis:** minor visual nit; surface only matters if retreat
titles grow.

## Standing prohibitions to codify via vitest guards

Per ADR 0013, the following contracts have stable shape and should each
get a `docs/design/*.md` + `src/**/__tests__/<name>-guard.test.ts` pair.
Each one would need its own small PR; this list is the inventory, not
the order.

| Contract | Doc location | Guard target(s) | What it forbids |
|---|---|---|---|
| Operator never says "wallet" / "crypto" / "chain" on the primary path | `docs/design/operator.md` (new) | `src/app/attest/page.tsx`, `src/app/operator/page.tsx`, `src/attestation/UploadForm.tsx` | Words that surface the rail; the agent-callable pre-fill path can name them |
| Operator empty vocabulary is named | `docs/design/operator.md` (new) | Same files | Generic "Could not load X" copy when a named failure line exists |
| Booking detail never shows verbatim intention | `docs/design/operator.md` (new) | `src/app/operator/[retreatRootHash]/bookings/[episodeId]/page.tsx` | Any reference to `statement` or `intention.statement` in JSX; only `intentionShape` (coarse labels) is allowed |
| Dashboard density contract (no kpi bloat, no charts) | `docs/design/operator.md` (new) | `src/app/operator/page.tsx` | Imports from `recharts`, `chart.js`, etc.; CSS that adds sparkline styles |

**Order I'd ship them (post-observation):** OP-1 (no rail vocabulary),
OP-3 (no verbatim intention leak) first — both are privacy/contract
risks. OP-2 and OP-4 are tone/density — pleasant but not blocking.

## Live observation needed before any change ships

The fragile surfaces above are hypotheses from code reading. Before any
of them turn into a fix, the operator flow needs to be observed end-to-end
by a real human (or by `ego-browser` scripted against the deployed
preview at `https://ardum.famile.xyz`) in three modes:

1. **Cold operator (Google path).** Sign in with a fresh Google
   account, list a retreat, see it appear on the dashboard, click into
   it, see an empty state, navigate back.
2. **Returning operator.** Same Google account, second retreat, see
   the briefing with two retreats, sort by activity vs. recent.
3. **Failed path.** Disconnect mid-flow (refresh at step 1, sign-in
   rejection at step 3, network error on submit). Note which surfaces
   show what.

The current state on Vercel is `ea7a28c` (pre-PR #15). The proposed
follow-up branch should be based on the merged `main` after this
planning doc lands.

## Open follow-ups from the 8.5 pass still owed

These belong to the practitioner flow but block the operator flow's
"morning ritual" copy when there are cross-references:

- PR #12 test-plan manual UI checks for `/operator` briefing hero
  (still listed in [`2026-09-05-ux-8-5-pass.md`](2026-09-05-ux-8-5-pass.md)
  as deferred). Should clear before claiming operator 9.0.
- The `providerFailureLine` extension for operator failure vocabulary
  (the F5 hypothesis) — depends on observation, but the inventory is
  listed above.

## References

- [`2026-09-05-ux-8-5-pass.md`](2026-09-05-ux-8-5-pass.md) — companion
  retrospective for the practitioner pass
- [`2026-08-24-product-architecture-review.md`](2026-08-24-product-architecture-review.md)
  — the 8.6 composite; "workbench density" is the gap this pass targets
- [`docs/plans/operator-value-surface.md`](../plans/operator-value-surface.md)
  — the design thesis the operator pages implement
- [ADR 0013](0013-contract-enforcement-via-vitest-guards.md) — the
  one-doc / one-guard pattern the standing prohibitions will use
- [ADR 0012](0012-demand-layer-business-model.md) — "demand visibility
  is what operators pay for"; this pass tightens that surface
- [ADR 0008](0008-agentic-commitment.md) — rails stay invisible on
  primary paths (the OP-1 guard enforces this on operator paths too)
