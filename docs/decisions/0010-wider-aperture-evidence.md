# 0010 — Wider aperture evidence (not social mode)

- Status: Accepted
- Date: 2026-07-21

## Context

Early practitioner conversations drift toward an optional **semi-public mode**:
seeing what other users are booking, what people “like them” chose, and aggregate
stats (“x% reported y”). External research tools (Exa, Firecrawl, Tinyfish) are
often named in the same breath.

Those requests usually express a real job: **confidence under uncertainty**
(“Am I choosing well?”, “Will this work for someone in my situation?”, “Am I
alone in wanting this?”). The market’s default answer is social proof — trending
inventory, review counts, “others booked this,” activity feeds. That pattern
optimizes conversion through comparison and urgency. It contradicts Ardum’s
contract: intention-first journey, one primary decision per state, deterministic
ranking, and “not an urgency engine” ([product-vision.md](../product-vision.md)).

This ADR records how Ardum meets the underlying need **without** becoming a
marketplace with a social layer, a review site with an agent wrapper, or a
popularity engine with prettier copy.

## Decision

### 1. Name the product correctly: evidence, not social

Ardum does **not** ship a “semi-public mode,” “community layer,” or “people
like you” browse surface. It ships **wider aperture evidence**: inspectable
signals that help Mira build or restore confidence for *this* episode.

Evidence is always:

- **Attributed** — source type, freshness, and confidence are visible on
  inspection;
- **Subordinate** — never the primary decision; lives in disclosure or at most
  one quiet line in the letter when uncertainty is high;
- **Non-coercive** — no FOMO, no live activity, no “book before others do.”

Practitioners may **opt in** to contribute anonymized patterns from their own
journeys. They never **opt out of being visible** to others by default.

### 2. Three evidence tiers (strict separation)

| Tier | Source | Role | May influence ranking? |
| --- | --- | --- | --- |
| **A — First-party reflection** | Post-commitment check-ins and reflections bound to the practitioner’s episodes | Recognition, preparation, compounding relationship | No — feeds letter tone and post-book care only |
| **B — Anonymized cohort aggregate** | Opt-in, k-anonymized patterns across Ardum episodes (intention shape → outcome themes) | Confidence in disclosure (“among people who named recovery and chose solitude…”) | **No** — explain and normalize only |
| **C — Public web evidence** | Operator sites, public reviews, articles (via evidence adapters: Exa, Fetch, Firecrawl, Tinyfish Search/Fetch) | Verify retreat claims; enrich operator/highlights disclosure | **Only** as normalized evidence inputs already consumed by the ranking policy — never as popularity override |

**Ranking policy remains authoritative.** Evidence tiers B and C may appear in
Mira’s rationale and disclosure. They must not reorder candidates outside the
existing deterministic policy. Popularity, booking velocity, and “what others
picked” are not ranking axes.

Language generation may summarize computed decisions; it cannot invent evidence
([architecture.md](../architecture.md) — Recommendation).

### 3. Where evidence may appear (copy hierarchy)

Per [experience-layer.md](../design/experience-layer.md) and product vision:

1. Mira’s letter (meaning)
2. the human decision (action)
3. status (what Mira is doing)
4. provenance and secondary tools (disclosure)

**Allowed placements:**

| Placement | Tier A | Tier B | Tier C |
| --- | --- | --- | --- |
| Letter (≤1 clause, high uncertainty only) | yes — this practitioner’s prior reflection | yes — if cohort threshold met | rarely — only when it names a specific fit reason, not a stat hero |
| Disclosure (“how I chose this”, “operator & highlights”, “what others found”) | yes | yes | yes |
| Primary CTA or card hero | **never** | **never** | **never** |
| Arrival / intention capture | **never** | **never** | **never** |
| Post-book preparation plan | yes | optional quiet line | optional |

Never reverse the hierarchy. A cohort stat or review count must not sit above
the hold/commit decision.

### 4. Explicit IN boundaries (what we build)

These are **in scope** and differentiated:

- **Opt-in contribution grant** — after booking or reflection, the practitioner
  may grant: “Share anonymized patterns from this journey to help Mira.” Scoped,
  revocable, inspectable — same agency model as holds and commitment
  ([0008-agentic-commitment](0008-agentic-commitment.md)).
- **Cohort normalization copy in Mira’s voice** — e.g. “Among practitioners who
  named burnout recovery and chose solitude, quiet mornings tended to matter
  more than destination.” Framed as pattern, not prescription.
- **Public evidence enrichment** — evidence repository ingests verifiable
  external sources; provenance rows cite source URL, fetched-at, and claim
  type (reported vs inferred).
- **Minimum-density gates** — cohort claims require k-anonymity and a minimum
  cell size (default: **n ≥ 30** per cohort slice; tunable). Below threshold,
  Mira says nothing rather than publishing thin or misleading stats.
- **Provenance labeling** — every wider-aperture claim tags:
  `explicit` | `reported` | `inferred` | `uncertain` (product vision memory
  boundary).
- **Coordination stays the intentional social branch** — named participants,
  scoped sharing, one decision. Multi-party is not a proxy for “social mode.”

### 5. Explicit OUT boundaries (market drift — do not build)

The following are **out of scope** regardless of user requests or competitor
features. Treat as product regressions if proposed in PRs:

| Anti-pattern | Why it is rejected |
| --- | --- |
| **Semi-public / social browse mode** — feed of what others are booking or considering | Marketplace behavior; replaces intention with comparison |
| **Live or recent activity** — “3 people holding this now,” “trending this week” | Urgency engine |
| **Identifiable peer journeys** without explicit invite/coordination | Privacy and trust violation; turns episodes into public profiles |
| **Review counts, star ratings, or leaderboard ordering** as primary UI | Ranked-results search engine |
| **“People like you booked X”** as hero copy or co-primary CTA | Social proof pressure; inverts letter → decision hierarchy |
| **Default opt-out visibility** of intention, hold, or booking state | Memory is a relationship boundary; consent must be grant-based |
| **Popularity-weighted ranking** or “most booked” sort | Violates deterministic ranking policy ownership |
| **User-generated content feed** (photos, tips, threads) | Different product; moderation and engagement mechanics |
| **External tools scraping Ardum user behavior** | Confuses evidence adapters with surveillance |
| **A/B urgency copy** tied to cohort activity | Conversion hack incompatible with north-star metrics |

When user research surfaces these, translate the underlying job (validation,
outcome evidence, normalization) into tier A/B/C evidence — not a new primary
surface.

### 6. Consent and memory boundaries

Operational truth remains in the episode repository
([0007-memory-architecture](0007-memory-architecture.md)). Wider-aperture
evidence follows these rules:

- **Contribution** is a separate, explicit grant on the episode or actor — not
  implied by persistence consent on arrival.
- **Exported / deleted episodes** withdraw their patterns from future aggregate
  recomputation; aggregates are recomputed, not “sticky forever.”
- **Cohort slices** use coarse intention shapes (energy band, social constraint,
  theme tags) — never verbatim statements, never actor ids in practitioner UI.
- **Semantic memory (Cognee)** may recall prose for *this* practitioner; it
  must not become the store of cross-user aggregates. Cohort stats live in a
  dedicated aggregate projection with deterministic rebuild rules.

### 7. External research tools (adapter boundary)

Exa, Firecrawl, Tinyfish (Search, Fetch, Agent), and similar tools are
**evidence-repository adapters** — tier C only.

| Tool class | Permitted use | Forbidden use |
| --- | --- | --- |
| Search / Fetch | Ingest public pages, reviews, operator claims; normalize to evidence records | Build “what users like you did” from the open web |
| Agent / Browser | Verify operator listings, monitor public availability pages | Scrape login-gated social graphs or private user content |
| Any | Cache by URL + content hash + fetched-at | Present unlabeled third-party copy as Mira’s first-person memory |

Adapters live behind the evidence-repository port. Episode commands and UI do
not import provider SDKs ([architecture.md](../architecture.md) — Boundaries).

### 8. Priority and sequencing

Wider-aperture evidence is **secondary product work**. Do not prioritize it
ahead of:

1. Core journey fidelity (one recommendation reveal, grant-based commitment,
   solo-first hold path).
2. Tier A — post-booking reflection loop and check-ins (already woven in
   `mira-voice.ts`; episode-bound, first-party).
3. Evidence repository normalization for **retreat/operator claims** (tier C)
   — valuable at low user density, no cohort cold-start.

Tier B (cohort aggregates) ships only when opt-in volume and k-anonymity
thresholds can produce **true** statements. Until then, Mira stays silent on
cohorts rather than fabricating social proof.

### 9. Success measures

Optimize for:

- confidence restored without adding a primary decision;
- provenance inspectability (practitioner can answer “where did Mira get this?”);
- zero regression on “one decision per state” smoke journeys;
- contribution opt-in rate **without** dark patterns — a healthy opt-in is
  evidence the grant is trusted, not that the UI nagged.

Do **not** optimize for time-on-feed, cohort page views, or “social engagement.”

## Consequences

- New features proposing “social,” “community,” “trending,” or “activity” must
  be reviewed against §5 OUT boundaries before design or implementation.
- Cohort and web evidence surfaces require design review for copy hierarchy
  placement (§3) and provenance labels (§6).
- Ranking policy tests must assert that tier B/C inputs cannot reorder results
  unless explicitly added as a **deterministic, documented** policy axis — not
  popularity.
- Evidence adapters get their own module(s) under the evidence-repository
  boundary; no new top-level “Social” or “Community” route group.
- Product vision “What Ardum is not” gains an explicit line for social-proof
  market patterns (see related edit in `product-vision.md`).

### Implementation (2026-07-21)

- **ADR + Beat 2 spec** — `0010-wider-aperture-evidence.md`,
  `recommendation-reveal.md` wider-aperture section.
- **Tier C** — `src/evidence/repository.ts` (attestation-backed public
  evidence); optional `EVIDENCE_FETCH_*` in `adapters/http-fetch.ts`.
- **Tier B** — `project-cohort.ts`, `listContributionEpisodes()` on episode
  repository, post-booking grant commands + `BookedLanding` UI.
- **API** — `loadWiderApertureStores()` on `GET /api/episodes/[id]` →
  `widerApertureEvidence` on detail payload → conditional disclosure rows in
  `RetreatExplorationView`.
- **Demo seed** — `ARDUM_WIDER_APERTURE_SEED=1` merges dev cohort/public data;
  `/demo/inventory-led` uses seed stores directly.

## Alternatives considered

- **Semi-public mode as a settings toggle.** Rejected: toggles that expose
  others’ activity train marketplace mental models even when “off” for the
  viewer; the wrong metaphor enters the product vocabulary.
- **Full anonymous social feed (Post-retreat stories).** Rejected: UGC feed is a
  different product with moderation, ranking, and engagement loops.
- **Replace deterministic ranking with “what worked for similar people.”**
  Rejected: makes popularity authoritative; breaks recommendation policy
  ownership and inspectability.
- **Ignore user requests entirely.** Rejected: the confidence job is real;
  tier A/B/C evidence addresses it without market mimicry.
- **Only tier C (web scraping), skip tier B.** Accepted as **phase 1** when
  user density is low; tier B remains specified so it does not arrive as an
  accidental social feature later.

## Related

- [product-vision.md](../product-vision.md) — job is not booking; secondary tools; memory boundary
- [architecture.md](../architecture.md) — evidence repository, ranking policy
- [experience-layer.md](../design/experience-layer.md) — disclosure hierarchy
- [0007-memory-architecture.md](0007-memory-architecture.md) — operational vs semantic memory
- [0008-agentic-commitment.md](0008-agentic-commitment.md) — scoped grants
- [recommendation-reveal.md](../design/recommendation-reveal.md) — Beat 2 disclosure rows
