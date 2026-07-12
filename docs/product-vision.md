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

## Agency is earned

Authority is explicit and scoped:

1. remember this intention;
2. monitor stated conditions;
3. place or release a non-binding hold;
4. share approved information with named participants;
5. execute a booking or payment.

Granting one authority never implies another. Every automated action is
inspectable and reversible where the provider permits it.

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

## What Ardum is not

Ardum is not:

- a marketplace organized around places;
- a ranked-results search engine;
- a chatbot wrapped around checkout;
- a dashboard of model reasoning;
- an urgency engine;
- a system that silently converts memory into permission.

Browsing, alternatives, technical provenance, and provider status can exist as
secondary tools. They do not define the primary journey.

## Measures of success

Ardum should optimize for:

- decisions removed or deferred safely;
- time from intention to confidence;
- momentum preserved through uncertainty;
- coordination work absorbed;
- corrections incorporated without restarting;
- avoidable worry after commitment;
- trust demonstrated through accurate, bounded memory.

Conversion is an outcome of confidence, not the north-star metric.
