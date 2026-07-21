# Product vision

## The job is not booking

People do not want reservations, confirmation pages, or logistics. They want
rest, reconnection, celebration, recovery, or change. Booking is one possible
implementation of that intention.

Most travel products begin with inventory and require a person to translate
their life into dates, destinations, filters, comparisons, and transactions.
Ardum begins with the life intention and keeps responsibility for translating
it into action.

## The product

Ardum is a persistent guide named Mira. Mira helps a person articulate what
they are trying to make space for, remembers the relevant context with
permission, and advances the intention without demanding premature certainty.

The core object is a living episode:

- the intention and how it has changed;
- current circumstances and constraints;
- facts, inferences, and unresolved questions;
- recommendations considered and corrected;
- conditions being monitored;
- temporary holds and their expiry;
- people participating in the decision;
- commitments and later reflections.

A recommendation, retreat, or booking belongs to an episode. None of them is
the episode itself.

Mira's orb reflects **journey posture** — what she is doing for the episode
(watching, holding, coordinating) and how much tension the journey carries —
not guessed user emotion. Posture is projected from operational episode state
and surfaced in API responses; see [design/mira-presence.md](design/mira-presence.md).

## Interaction contract

Every state presents one primary human decision.

Mira should act autonomously when the action is reversible, authorized, and
bounded. Mira should ask when human preference, consent, or commitment is
required. Reasoning and provenance remain available, but they do not compete
with the next decision.

Examples:

- “What are you trying to make space for?”
- “You said you need a quiet week before October. Is timing or solitude more
  important if both cannot be perfect?”
- “This is the strongest current fit. I am uncertain about the final group
  size. I can watch that for you.”
- “A non-binding hold is available for 48 hours. Nothing will be charged.”
- “Two people still need to respond. I will keep the hold active until
  tomorrow.”
- “A re-ranking under different priorities is available at any point. It
  is read-only. A hold is never changed by it.”
- “The pieces that matter now agree. I can secure this for you.”

## Agency is earned

Authority is explicit and scoped:

1. remember this intention;
2. monitor stated conditions;
3. place or release a non-binding hold;
4. share approved information with named participants;
5. execute a booking or payment.

Granting one authority never implies another. Every automated action is
inspectable and reversible where the provider permits it.

Authority compounds only by explicit grant. Returning practitioners who already
have a durable payment identity should not re-walk infrastructure theater;
they should face the same human decision with less ceremony.

## Division of labor (agentic era)

| Who | Owns |
|---|---|
| **Person** | Intention, values under tradeoff, consent, final commitment |
| **Mira** | Clarification, ranking, monitoring, holds, coordination ops, payment plumbing, evidence, recovery |
| **System** | Provenance, reversibility, scoped permissions, inspectability |

Anything the person is asked to do that is not preference or consent is product
debt. Agentic does not mean chatty: state (the episode), not a chat log, is the
spine. Autonomy runs within bounds; the person is not co-piloting rails.

## Commitment is a grant, not an execution walkthrough

Booking is a **terminal commitment of authority**, not a phase of the app and
not a protocol walkthrough. The person grants a scoped action; Mira executes
inside that grant.

The primary path is a short ceremony:

1. **Ready?** — confidence and tradeoffs are clear enough to proceed.
2. **Identity only if missing** — progressive sign-in when no durable payment
   identity exists; not a wallet tutorial.
3. **Confirm amount and bounds** — deposit amount, hold-until-arrival (or
   plain refund rule), and that Mira will not spend more without asking.

Rails (account upgrade, cross-chain routing, escrow, attestation storage,
chain names, wallet addresses) are **true and inspectable**. They are never
the story on the primary path. They live under secondary disclosure such as
“How this is secured,” details, and logs — consistent with “not a chatbot
wrapped around checkout.”

Ambient progress uses Mira’s journey posture (`resolving` → `arriving`) and
calm human status (“Securing your place…” → “You’re booked.”), not named
infra phases. Ritual can remain (for example a breath cycle) only when labels
stay human; practice language may not re-center the stack.

Success lands on **preparation**, not a receipt. The prep plan is the default
payoff; provenance stays a quiet line. Conversion is an outcome of confidence;
worry collapse after commitment is the product win.

The full decision record for gates, solo path, and surface hierarchy is
[0008-agentic-commitment](docs/decisions/0008-agentic-commitment.md). Experience
detail is in [design/experience-layer.md](design/experience-layer.md).

## Hold, solo, and coordination

A non-binding hold is the planning primitive: time-bounded, non-charging,
inspectable. After a hold, the journey branches:

```text
recommend
  → hold
       → secure my place          (solo / no others required — primary path)
       → invite someone who must agree  (optional multi-party branch)
       → watch / revise / release
```

**Solo is first-class.** Coordination is an optional branch of the hold, not
the only door to commitment. A social preference of solitude must never force
an invitation that cannot complete. Multi-party agreement remains required when
the person has opened that branch and others must still respond.

## Secondary tools stay secondary

Lenses, counterfactuals, alternatives, technical provenance, and provider
status exist to build or restore confidence. They never mutate a hold and never
compete with the one primary decision. When a hold is active and uncertainty is
low, secondary tools shrink into disclosure. When uncertainty is high or the
person asks “what if,” they expand.

Copy hierarchy on every journey surface:

1. Mira’s letter (meaning)
2. the human decision (action)
3. status (what Mira is doing)
4. provenance (how it is secured)

Never reverse that order.

On **arrival**, Mira's question is bound to the orb lane — spatially in the
field's lower third, temporally tied to speaking/listening activity, optically
receded via ambient 2D field + veil while the person types. The first intention
ask has no form card; see [experience-layer](design/experience-layer.md).

## Memory is a relationship boundary

Operational truth belongs to the episode repository. Semantic memory can help
Mira recognize patterns and language, but it is lossy context rather than a
ledger. The projector/observe/enrich split that backs this contract — including
which routes use projector-only output and which use cognee enrichment — is in
[0007-memory-architecture](docs/decisions/0007-memory-architecture.md).

The product must distinguish:

- what the person explicitly said;
- what a provider or evidence source reported;
- what Mira inferred;
- what remains uncertain.

People can inspect, revise, export, or delete retained information. Claims of
cross-device or long-term continuity are made only when identity and storage
actually provide them.

## Recognition is progressive

Mira meets every practitioner anonymously first. Recognition is earned in
rungs, never gated on arrival:

1. **Voluntary naming** — the practitioner may tell Mira their name at any
   moment; it joins the home greeting and the voice lane. No auth, no
   friction, no requirement.
2. **Authenticated actor** — when a provider (Magic, future) completes login,
   the provider subject writes back to the actor row, enabling cross-device
   continuity. The cookie remains the ownership primitive; the subject is
   the join key across devices.
3. **Preference profile** — explicit preferences (accommodation, time-of-day,
   dietary, accessibility) live on the actor row, surfaced on `/memory` as
   "what Mira has learned about you," editable and deletable.
4. **Quiet continuity CTA** — after the first booking, Mira may offer to
   remember identity across devices. Never on arrival.

Names and preferences are private to the actor. There is no directory, no
public profile, no "people like you" surface. Full decision record:
[0011-progressive-recognition](docs/decisions/0011-progressive-recognition.md).

## What Ardum is not

Ardum is not:

- a marketplace organized around places;
- a ranked-results search engine;
- a chatbot wrapped around checkout;
- a dashboard of model reasoning;
- an urgency engine;
- a social-proof or activity-feed layer (“people like you booked…”, trending,
  live holds, semi-public browse of others’ journeys);
- a system that silently converts memory into permission;
- a wallet, chain, or storage onboarding funnel on the primary path.

Browsing, alternatives, technical provenance, and provider status can exist as
secondary tools. They do not define the primary journey. Infra differentiators
may prove trust to partners and skeptics in secondary surfaces; they do not tax
the practitioner path for confidence.

When practitioners want normalization or outcome reassurance, Ardum answers with
**wider aperture evidence** in Mira’s voice — opt-in anonymized cohort
patterns, first-party reflections, and verifiable public sources — never a
social mode or popularity surface. Full decision record:
[0010-wider-aperture-evidence](docs/decisions/0010-wider-aperture-evidence.md).

## Agent-as-distribution

Ardum's booking infrastructure is exposed as agent-callable A2MCP endpoints.
Any AI agent with a funded wallet can discover retreats, execute bookings, and
help operators list retreats — without a browser, a cookie, or human wallet
interaction. See [0009-agent-api](decisions/0009-agent-api.md).

This is distribution engineered into the product: the agent API is the channel,
not SEO or paid acquisition. An agent discovers Ardum, integrates the API, and
starts booking retreats for its users. The agent's users become Ardum users
without ever visiting ardum.famile.xyz. The product IS the channel.

The agent flow is:

1. Agent captures a user's intention via the Ardum API
2. Agent clarifies constraints (energy, budget, social)
3. Agent requests a recommendation — gets a retreat match
4. Agent places a non-binding hold
5. Agent executes an on-chain USDC deposit to escrow
6. Agent signs and submits the booking attestation

The user never touches a wallet, sees a chain name, or pays gas. The agent
executes the full commitment autonomously.

For operators, the agent intake endpoint (`POST /api/agent/attest`) lets an
agent collect retreat details in natural language, validate them, and generate
a pre-fill URL. The operator's experience: chat with agent → click link → form
is pre-filled → sign in with Google → publish. No crypto knowledge needed.

This expands the TAM beyond direct consumer bookings: any AI agent with a
funded wallet can act as a travel concierge, using Ardum as the commitment and
settlement layer.

## Measures of success

Ardum should optimize for:

- decisions removed or deferred safely;
- time from intention to confidence;
- momentum preserved through uncertainty;
- coordination work absorbed;
- corrections incorporated without restarting;
- avoidable worry after commitment;
- trust demonstrated through accurate, bounded memory;
- infrastructure steps the person never had to learn.

Conversion is an outcome of confidence, not the north-star metric.
