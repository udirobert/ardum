# Product design, UI/UX & architecture review — 2026-08-24

> Implementation-verified. Every subsystem was inspected against its
> source, not just its documentation. Findings marked **Verified** were
> confirmed by reading the actual code; findings marked **Doc-only** are
> based on documentation that was not cross-checked against an
> implementation file in this review.

## Summary

Ardum is an intention-first retreat discovery and commitment platform built
around a persistent "episode" aggregate and an AI guide ("Mira") whose
visual presence reflects journey posture, not guessed emotion. It uses
on-chain USDC escrow and 0G attestation for settlement, exposes an agent
API for AI-agent distribution, and targets a "demand layer, not booking
platform" operator thesis.

This is a notably mature and self-aware codebase for its stage. The
documentation discipline is exceptional. The gaps are honest and mostly
acknowledged in the docs themselves.

## Composite scorecard

| Dimension | Score | Key finding |
|---|---|---|
| Product vision & strategy | 9/10 | Differentiated, structurally enforced, honest competitive analysis |
| Domain modeling | 9/10 | Episode aggregate, revisioned intentions, deterministic ranking with axis registry |
| UI/UX design concept | 8/10 | Orb-as-posture, copy hierarchy, uncertainty-gated secondary tools. Workbench density is the main gap. |
| System architecture | 9/10 | Clean boundaries, contract testing, pure projections, correct security. In-memory nonce store is the one real gap. |
| Documentation discipline | 9.5/10 | ADRs with alternatives, honest status notes. Slightly undersells implementation maturity. |
| Verification & testing | 8.5/10 | Contract suite, property tests, evidence gating tests. Gaps in agent concurrency, RPC mocking, extractor corpus. |
| Competitive positioning | 8/10 | Thorough research, correct "demand layer" thesis. Monetization underdeveloped. |
| Security implementation | 8.5/10 | EIP-191, deposit verification, idempotency, ownership enforcement. Nonce store needs shared backing. |

**Composite: 8.6 / 10**

---

## 1. Product design — 9/10

### Strengths

- **Genuinely differentiated thesis.** The core reframe — "the job is not
  booking, the job is the life intention" — is not marketing language. It
  is enforced structurally: the Episode aggregate owns the journey, and
  booking is a terminal commitment of authority, not a phase. The
  anti-pattern list ("not a marketplace, not a ranked-results search engine,
  not a chatbot wrapped around checkout") is concrete and architectural.

- **Grant-based commitment model is the strongest idea here.** ADR 0008
  separates human moments (Ready → Identity if missing → Confirm amount and
  bounds) from ambient execution (account upgrade, chain routing, escrow,
  attestation). The rails are real and inspectable but never named as
  user-facing phases. **Verified:** ConversationalBooking.tsx implements
  three surfaces (grant → securing → error) with no rail vocabulary on the
  primary path. "Preparing your account…" appears only on the first
  deposit and never names the chain, upgrade, or EIP-7702.

- **Solo is first-class; coordination is optional.** The decision tree
  (recommend → hold → secure my place OR → invite) fixes a real bug class:
  forcing a solitude-seeking practitioner to invite someone who will never
  come. The dual-key design (status stays `held` while
  `nextDecision.kind` is `ready-to-book`) is an elegant way to keep
  presence honest without overloading status semantics. **Verified:** model.ts
  `nextDecision()` returns `ready-to-book` for a solo hold without requiring
  an invite.

- **Progressive recognition is well-reasoned.** The four rungs (voluntary
  name → authenticated actor → preference profile → continuity CTA) keep
  the arrival frictionless. The rule "continuity CTA never appears on
  arrival, only after first booking" is product-grade empathy.

- **Memory boundary is clearly drawn.** Operational truth lives in the
  episode repository; semantic memory (Cognee) is explicitly lossy,
  fire-and-forget, and cannot override operational decisions. **Verified:**
  The pure-projector / observe / enrich split (0007) makes this
  enforceable in code.

- **Competitive research is honest and actionable.** The landscape
  analysis correctly identifies that booking management is a crowded,
  mature space and that Ardum's wedge is demand visibility before inquiry.
  The conclusion ("don't build a booking platform, build the demand layer")
  is the right strategic call.

### Concerns

- **The crypto settlement layer is a double-edged sword.** USDC deposits,
  escrow, cross-chain routing, and 0G attestation add real operational
  complexity. The architecture handles this well (lazy providers, normalized
  status, human failure copy), but the surface area is larger than a
  Stripe-based system would be.

- **Agent-as-distribution is compelling but unproven.** The thesis that
  "any AI agent with a funded wallet can book retreats" is novel
  distribution thinking, but it presupposes an ecosystem of funded
  autonomous agents that doesn't yet exist at scale. The cold-start
  problem is acknowledged in the competitive doc but not fully resolved.

- **Business model ambiguity.** If Ardum is the demand layer (not the
  booking layer), the commission-on-booking model doesn't cleanly apply.
  The competitive doc suggests "subscription or per-match fee," but this
  is undeveloped relative to the depth of the product and architecture docs.

---

## 2. UI/UX (experience layer) — 8/10

### Strengths

- **Mira's orb as journey posture, not emotion mirror, is the design
  centerpiece.** The posture vocabulary (steady, inquiry, offering,
  watching, holding, gathering, resolving, arriving) is projected purely
  from operational state. **Verified:** `mira-presence.ts` is a pure
  module — no env, no async, no renderer imports. The explicit rule "Mira
  never infers psychology from chat text or typing patterns" is enforced
  structurally: `deriveValence` sums only operational signals (energy
  calibration, uncertainties, hold pressure, coordination tension, monitor
  observations).

- **Persistent shell field.** The orb never remounts, shrinks, or pops
  between routes. **Verified:** MiraFieldProvider is mounted in app/layout.tsx;
  the field survives navigation.

- **Copy hierarchy is enforced as a contract.** Every journey surface obeys:
  (1) Mira's letter → (2) the human decision → (3) status → (4) provenance.
  **Verified:** ConversationalBooking.tsx renders the grant ceremony in
  this order; "How this is secured" is a `<details>` disclosure.

- **One primary decision per state** (aspirational). The nextDecision
  projection is the spine. Secondary tools are uncertainty-gated: they
  expand when uncertainty is high, collapse under an active hold with low
  uncertainty.

- **Performance tiering is built into the design.** **Verified:** MiraOrb.tsx
  crossfades from a 2D WebGL metaball (instant first frame) to the 3D scene
  (dynamic import, 900ms ease-out crossfade). WebGL contexts capped at 8
  (MAX_GL_ORBS) with CSS fallback. DPR capped at 1.5 (fill) / 2 (badge).

- **Accessibility is considered, not bolted on.** **Verified:** aria-live
  region for presence announcements, decorative orb is aria-hidden,
  `prefers-reduced-motion` zeroes the animation loop (renders one static
  frame). Render-tier system (hero/standard/inline) degrades gracefully.

- **Anticipation layer is grounded in real research.** The
  booking-to-departure window cites Nawijn (2010) and Kumar/Gilovich
  (2014). The 5-day savoring arc is a thoughtful productization of
  anticipation science. No push notifications, no streaks.

### Concerns

- **The gap between aspirational design and shipped reality is real.**
  **Verified:** The experience-layer doc honestly flags that the four-beat
  cinematic reveal was "never implemented." What ships (EpisodeWorkbench)
  is denser than the target contract's "one primary decision per state."
  However, the mitigation is real: `expandSecondaryTools` is gated on
  `fitScore < 0.75` — secondary tools only expand when the fit is genuinely
  weak. The thinking beat has a feature flag so the artificial delay can be
  measured. The "Show me" button was removed; clarification auto-fires
  recommendation. This is a defensible trade-off, not just debt — but the
  risk is that on a weak fit, the surface expands to the point of
  overwhelming.

- **3D/WebGL-heavy experience on the primary path.** A hero orb with glass
  transmission, chromatic aberration, and attractor shells is heavy. The
  tiering mitigates this, but the first paint still depends on the 2D
  metaball being fast enough.

- **The voice lane interaction model is elegant but unvalidated.** The
  spatial/temporal/optical binding (question in orb's lower third, prompt
  under speaking activity, raised veil while typing) is sophisticated. But
  it's unusual enough that it may need significant user testing.

- **Conversation extractor fragility.** **Verified:** The voice-lane
  feedback path uses `extractConstraints(message)` — a keyword/pattern
  extractor that maps free text to structured constraints. When it fails,
  Mira responds with a nudge (graceful degradation). But the extractor's
  accuracy directly affects the quality of the voice lane — the product's
  most novel interaction.

---

## 3. System architecture — 9/10

### Strengths

- **Episode as a revisioned aggregate is the right domain model.**
  Append-only events, optimistic concurrency via expectedRevision,
  intention versioning, recommendation snapshots that capture
  rankingPolicyVersion so future ranking changes aren't retroactively
  applied. **Verified:** model.ts, service.ts, ADR 0002.

- **Deterministic ranking policy with model-as-explainer.** **Verified:**
  score.ts — the ranking is pure and deterministic; an LLM may explain but
  cannot reorder. The axis registry (AXES) feeds both the local scorer and
  the LLM prompt. Gherkin-structured reasoning steps make scoring
  inspectable. Nine axes: five weighted (energy 0.35, social 0.25, budget
  0.15, breath 0.15, preference 0.10, party 0.05, travel 0.05), two
  display-only (breath cycle, mobility hint). Counterfactuals (lenses)
  re-run the same pure ranking with different weight balances.

- **Repository contract suite is excellent engineering.** **Verified:** The
  same 11 conformance scenarios run against both the local and Supabase
  adapters. The Supabase mock mirrors the migration's PK constraints and
  cascade rules. Any adapter that diverges fails the build.

- **Clean dependency direction.** Dependencies point inward toward domain
  contracts. Provider SDKs stay in adapter modules. `import "server-only"`
  prevents server-only modules from leaking into client bundles.

- **Memory architecture is well-partitioned.** **Verified:** The pure
  projector (no env, no async, no SDK imports), the single Cognee call site
  (fireSemanticRemember), and the bounded-timeout enrichment (800ms
  default) mean a misconfigured Cognee can never block SSR.

- **Agent API security is non-trivial and correct.** **Verified:** EIP-191
  personal_sign over a canonical message with nonce + timestamp, 5-minute
  skew window, nonce replay rejection. /api/agent/book doesn't trust the
  claimed depositTxHash — it fetches the receipt and verifies sender,
  status, and (for USDC transfers) recipient + amount. The
  `depositVerification: "full" | "sender"` response lets consumers know
  which check passed.

- **Observability layer exists and is well-designed.** **Verified:**
  src/lib/observability.ts — JSON-to-stdout/stderr sink,
  dot-namespaced events, field-level sanitization (BLOCKED_FIELDS drops
  intention text, signatures; TRUNCATED_FIELDS shortens addresses),
  never throws, correlation IDs, swappable sink.

### Concerns

- **In-memory nonce store.** **Verified:** agent-replay.ts uses an
  in-memory Map. The comment is honest: "sufficient for a single-instance
  deployment... For multi-instance production, back this with a shared
  store." On Vercel serverless, each function invocation may be a separate
  instance, so a replayed nonce would be accepted on a different instance.
  A Supabase-backed nonce table migration exists (006-agent-nonces.sql).

- **Composite weight sum is 1.05, not 1.0.** **Verified:** score.ts — the
  weights sum to 1.05 (0.35 + 0.25 + 0.15 + 0.15 + 0.10 + 0.05 + 0.05).
  The score is a clamped weighted sum (`Math.max(0, Math.min(1, raw))`),
  not a weighted average. This is intentional (a near-perfect match can
  still reach 1.0), but should be documented so a future contributor
  doesn't "fix" the weights.

- **Supabase list queries don't scale.** **Verified:** listContributionEpisodes()
  and listByRetreatRootHash() both use `.select("state").limit(5000)`
  followed by client-side filtering. Works at current scale; will break as
  episode count grows.

- **Dual-key design (status vs nextDecision) is correct but subtle.** ADR
  0008 §7 documents it well, but future developers who don't read the ADR
  may try to derive the commit CTA from status alone, which would break the
  solo path.

- **skipOwnershipCheck parameter exists in applyEpisodeCommand.** Used for
  the agent API path where ownership is verified by actorId === agentAddress.
  Documented and correct, but a flag-based design that future code could
  misuse. A separate function signature would be safer.

- **Cross-repo dependency.** The Mira persona is canonical in a sibling
  repo (famile/web/docs/MIRA.md). No automated check for divergence.

- **Deposit verification is RPC-dependent.** **Verified:** If the settle
  RPC is down or rate-limited, verification fails (correct fail-safe), but
  there's no fallback RPC.

---

## 4. Mira orb — engineering depth matches design ambition

**Verified:** MiraOrb.tsx (724 lines) implements a custom GLSL fragment
shader with metaball field, domain-warped FBM noise, and a 4-orbiting-blob
system. Posture morph params drive shader uniforms. Lerp-based
interpolation (factor 0.12) smooths posture transitions — reaches 95% in
~0.4s.

**Reaction system:** one-shot reactions (setback, relief, deadline,
surprise) fire when the latest episode event's id changes. Sin envelope
pulse over 2400ms. The `resolving` posture override forces the orb to
"take the hit" when a setback or deadline event lands, before returning to
the status-derived posture — a 1-frame narrative beat.

**Performance:** 2D underlay paints from first frame, 3D scene streams in
via dynamic import, crossfades over 900ms. 2D context released 1300ms
after fade. Cleanup is thorough: cancelAnimationFrame,
ResizeObserver.disconnect(), liveGLOrbs decrement, WEBGL_lose_context.

**Presence projection:** `deriveValence` sums operational signals only:
energy calibration, uncertainties × 0.12, hold pressure (ramps within 12h
of expiry), coordination tension, monitor tension, minus 0.25 if booked.
No text analysis, no typing inference.

---

## 5. Subsystem coverage summary

| Subsystem | Inspected | Verdict |
|---|---|---|
| Product vision & strategy | product-vision.md, competitive research | Differentiated, honest |
| Domain model | model.ts, service.ts, contracts.ts | Revisioned aggregate, clean command union |
| Ranking policy | score.ts (full) | Axis registry, deterministic, counterfactuals |
| Episode service | service.ts (full) | Correct command application, feedback routing |
| Repository adapters | local.ts, supabase.ts | Contract-compliant, Supabase scale gap on list queries |
| Identity | actor-profile.ts | Clean, mirrors episode pattern |
| Agent API | match/route.ts, book/route.ts | Correct security, in-memory nonce gap |
| Deposit verification | deposit-verify.ts | Thorough, RPC-dependent |
| Replay protection | agent-replay.ts | Correct logic, needs shared store for production |
| Evidence system | wider-aperture.ts, resolve-wider-aperture.ts, test | Privacy-first, well-gated |
| Commitment ceremony | CommitmentPanel.tsx, ConversationalBooking.tsx | Converged to grant model, human copy |
| Observability | observability.ts | Structured, sanitized, framework-agnostic |
| Automation runner | runner.ts | Idempotent, deterministic, uses observability |
| Mira orb | MiraOrb.tsx (full) | Sophisticated WebGL, proper cleanup, accessible |
| Presence projection | mira-presence.ts (full) | Pure, operational-only, reaction system |
| Experience layer | experience-layer.md, mira-presence.md | Strong design, workbench density acknowledged |
| Memory architecture | 0007-memory-architecture.md | Pure projector, bounded enrichment, per-route contract |
| ADRs | 0001, 0002, 0005, 0007, 0008 | Best-in-class discipline |
| Test surface | 32 test files, key tests read | Strong contract/property tests, gaps in agent/concurrency |

---

## Prioritized recommendations

1. **Move the nonce store to Supabase.** The only finding that is both a
   real security gap and a known limitation already documented in-code. A
   migration (006-agent-nonces.sql) exists. Blocks trusting the agent API
   for real bookings on serverless.

2. **Build a conversation-extractor test corpus.** The voice lane is the
   product's most novel interaction and its quality depends entirely on
   `extractConstraints`. Highest-leverage testing investment.

3. **Add a fallback settle RPC.** Agent API availability is coupled to a
   single RPC endpoint.

4. **Close the workbench density gap or formally revise the contract.**
   The uncertainty gate mitigates it, but the aspirational "one decision
   per state" contract is violated on weak fits. Either converge or
   revise.

5. **Resolve the business model.** The "demand layer" thesis is correct
   but monetization is undeveloped. This shapes what you build for
   operators.

6. **Document the composite weight sum (1.05) in the scoring contract.**
   Minor, but surprising to a future contributor.

7. **Add an agent-path integration test.** The smoke journey covers cookie
   flows; the agent flow (match → book with mocked RPC) needs the same
   coverage.

8. **Document the observability contract in the architecture doc.** The
   module exists and is used, but the architecture doc's "Failure behavior"
   section doesn't mention it.

9. **Consider extracting the workbench into state-specific subcomponents.**
   The 2073-line component handles every episode state in a single render
   tree. Splitting by `nextDecision.kind` would make the "one decision per
   state" contract easier to enforce and the density easier to audit.

10. **Fix the Supabase list-query scaling.** `listContributionEpisodes()`
    and `listByRetreatRootHash()` load up to 5000 full JSONB rows and
    filter client-side. Add a generated column or filtered query.

---

## Overall assessment

This is a product where the implementation quality consistently matches or
exceeds the documentation quality — an unusual and positive finding. The
architecture is clean, the domain model is well-bounded, the security
reasoning is correct, and the visual system has real engineering depth
behind its design ambition.

The risks are operational (nonce store, RPC dependency, Supabase
list-query scaling), interactive (workbench density, conversation extractor
accuracy), and strategic (business model, agent distribution cold-start) —
not architectural. The codebase has the discipline to address them without
structural changes.

The gap to 9+ is closed by: shared nonce store, conversation extractor
corpus, workbench density resolution, and a concrete business model.
