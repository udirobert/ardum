# 0011 — Progressive recognition layer

- Status: Accepted
- Date: 2026-07-21

## Context

Ardum's identity model has one rung: an anonymous signed cookie (`ardum-actor`)
that mints a UUID on first ownership-bearing request and verifies it on every
subsequent request (ADR 0004). The `actors` table declares a `kind` column
(`'anonymous' | 'authenticated'`) and an `external_subject` column, but no
write path ever transitions `kind` to `'authenticated'` or populates
`external_subject`. The authenticated rung is documented but unimplemented.

Recognition today is projector-only and operational: `projectActorMemory`
derives `pastMatches`, `pastBookings`, `energyHistory`, and `isReturning` from
episode state. The home greeting is "Welcome back. We last saw you booked X in
Y." Mira addresses every visitor with the same voice lane line; she never uses
a name, because no name exists.

External feedback: "Mira never actually knows who she is speaking with." The
onchain aspects were made invisible (correct, per ADR 0008), but the absence
of any recognition moment between "anonymous cookie" and "payment identity at
booking" leaves the practitioner with no personalization, no customization,
and no cross-device continuity. The contract describes a progression; the
implementation only has the first step.

## Decision

Build the missing rungs of the ladder ADR 0004 already describes, without
gating arrival on auth. Recognition is **progressive**: each rung is opt-in,
costs nothing in friction until chosen, and never inverts the anonymous-first
arrival contract.

### 1. Voluntary naming — no auth, no friction

The practitioner may tell Mira their name (or a handle) at any moment. Stored
on the `actors` row as `preferred_name` (TEXT, nullable). Mira's voice lane
and the home greeting use it when present; absent, the existing copy is
untouched.

- Surfaces: `/memory` (a quiet editable field), and an optional one-line ask
  after the first intention lands.
- Never required to advance any episode transition.
- Never surfaced to retreats, wallets, or invitees.
- Editable and deletable on `/memory`, same as episode history.

This closes most of the "Mira doesn't know who she's speaking with" feeling
without a single provider integration.

### 2. Wire the existing `external_subject` write path

When Magic (or any future provider) completes login, write the provider
subject back to the `actors` row and flip `kind` to `'authenticated'`. This is
the contract ADR 0004 already specifies; it is unimplemented, not new design.

- The cookie remains the ownership primitive the adapter layer enforces.
- `external_subject` is the *cross-device* anchor: a fresh cookie on a new
  device can resolve to the same actor row via the provider subject.
- Authentication expands continuity; it does not change the episode contract
  (ADR 0004 verbatim).

Implementation: `attachExternalSubject` on the actor profile repository
(`src/identity/actor-profile.ts`) writes the subject. The Magic auth flow
(`src/booking/MagicAuth.tsx`) calls `POST /api/actor/attach` after successful
login and on session restore. Fire-and-forget on failure — the login itself
is not blocked.

### 3. Cross-device restore via the authenticated actor

After step 2, the signed cookie is no longer the only ownership anchor. A
"Continue on another device" moment on `/memory` re-attaches a new cookie
to the existing actor row. This is the *progressive* part of progressive
auth — it appears when the person has a reason to want it, never on first
paint.

Implementation: the practitioner signs in with Magic on the new device,
then signs a canonical message (`Ardum cross-device restore v1\naddress:
<addr>\ntimestamp: <unix-seconds>`) proving wallet ownership. The server
verifies the signature (EIP-191 `personal_sign` via `ethers.verifyMessage`),
looks up the `actors` row by `external_subject`, and re-signs the cookie
against the existing actor id (`setActorCookie`). A 5-minute skew window
prevents replay, matching the agent API (ADR 0009).

Route: `POST /api/actor/restore` (`src/app/api/actor/restore/route.ts`).
UI: `RestoreIdentity.tsx` (lazy-loaded wrapper with `MagicAuthProvider`)
and `RestoreForm.tsx` (sign + submit) on `/memory`, shown only when the
practitioner has no episodes on the current device.

The re-attachment is idempotent: the provider subject is the join key; if
it already maps to an actor, that actor wins and the new cookie is
re-signed against it. No two distinct actor rows are ever merged.

### 4. Preference profile — derived and explicit

`energyHistory` already exists in the projector. Add an explicit preferences
surface on the `actors` row (`profile` JSONB: accommodation, time-of-day,
dietary, accessibility, etc.). Surfaced on `/memory` as "what Mira has
learned about you," editable, deletable. The ranking policy consumes
explicit preferences as a soft tie-breaker (weight 0.10) alongside the
existing intention constraints; derived preferences (from episode history)
remain supplementary and never override an explicit statement.

Implementation: the `Preference fit` axis in `score.ts` compares the
practitioner's `accommodation` and `dietary` preferences against the
retreat's declared offerings (`claims.accommodation`, `claims.dietary`).
Retreats with undeclared offerings score neutral (0.5) so a preference
doesn't penalize retreats with unknown accommodation. The axis is skipped
entirely when the practitioner has no preferences set, preserving
backward compatibility with existing ranking behavior.

This is the customization rung. It turns recognition from "I remember what
you did" into "I know how you like to be met."

### 5. Quiet "sign in to keep this" CTA — post-booking, not pre-intention

After the first booking succeeds, Mira offers: "If you want this to follow
you across devices, I can remember your identity — optional." That is the
moment the person has a reason to want continuity. Never on arrival. This
matches ADR 0008 §6 ("durable identity compounds agency") without inverting
the anonymous-first arrival.

Implementation: the `BookedLanding` component on the episode page shows a
quiet "keep this across devices — optional" section with a link to `/memory`
when the actor is not yet authenticated. The `isAuthenticated` flag is
threaded from the actor profile repository through the episode detail
payload. The CTA never appears for authenticated practitioners or on the
arrival surface.

## Surface hierarchy

Recognition copy follows the existing copy hierarchy (letter → decision →
status → provenance). The practitioner's name is part of Mira's *letter*,
not a header chrome element. It appears:

- in the home greeting when present;
- in the returning-practitioner voice lane on arrival;
- in the `/memory` summary card header;
- never in operator-facing surfaces, invite views, or attestation records.

## Privacy and ownership

- `preferred_name` and `profile` are owned by the actor and deletable on
  `/memory` alongside episode history.
- `external_subject` is the provider's stable identifier; it is not displayed
  to the practitioner and is not shared with retreats or invitees.
- The actor row is the single source of truth for recognition fields; browser
  storage remains a disposable cache (AGENTS.md).
- Deletion of the actor row cascades to episodes (FK on delete cascade,
  already in `001-episodes.sql`).

## What this is not

- Not an auth gate on arrival. The first intention ask is unchanged.
- Not a profile completion wizard. Each field is optional and editable in
  place; no progress bar, no "complete your profile" nudge.
- Not a social layer. Names and preferences are private to the actor; there
  is no directory, no public profile, no "people like you" surface (ADR 0010).
- Not a re-introduction of wallet/chain vocabulary. The provider subject is
  an internal join key; its wire form never reaches primary copy.

## Consequences

- `actors` gains `preferred_name` (TEXT) and `profile` (JSONB) columns.
- A new server-only module owns actor profile read/write; the projector
  consumes `preferred_name` for the greeting and voice lane.
- Magic login (and future providers) write `external_subject` and flip
  `kind` to `'authenticated'` on success.
- `/memory` gains an editable name field and a preferences section.
- The home greeting and the returning voice lane use `preferred_name` when
  present, falling back to the existing copy.
- Cross-device restore re-signs the cookie against an existing actor row
  found by `external_subject`, after verifying wallet ownership via
  EIP-191 `personal_sign`.
- The ranking policy gains a `Preference fit` axis (weight 0.10) that
  nudges rankings when the practitioner has set accommodation or dietary
  preferences. Retreat attestations gain optional `accommodation` and
  `dietary` claim fields.

## Alternatives considered

- **OAuth-first on arrival.** Rejected (ADR 0004 already rejected it):
  abandons the anonymous-to-attached trajectory and taxes first intention
  with friction.
- **Infer a name from email or provider metadata without asking.** Rejected:
  silent naming violates "what the person explicitly said" vs "what Mira
  inferred" (product-vision.md). Names are given, not guessed.
- **Store preferences on the episode, not the actor.** Rejected: preferences
  are cross-episode and cross-intention; storing them per-episode duplicates
  and desynchronizes. The actor row is the natural owner.
- **Skip voluntary naming, ship only cross-device restore.** Rejected: the
  feedback is about recognition in the moment, not only about device
  continuity. Naming is the cheaper, higher-leverage half.

## Related

- [0004-identity-cookie.md](0004-identity-cookie.md) — the cookie contract
  this ADR extends with the authenticated rung
- [0007-memory-architecture.md](0007-memory-architecture.md) — projector vs
  enrichment split; recognition fields join the projector's operational inputs
- [0008-agentic-commitment.md](0008-agentic-commitment.md) §6 — durable
  identity compounds agency; this ADR builds the rungs below payment identity
- [0010-wider-aperture-evidence.md](0010-wider-aperture-evidence.md) —
  recognition is private, not social; names and preferences never become a
  cohort signal
- [product-vision.md](../product-vision.md) — "Claims of cross-device or
  long-term continuity are made only when identity and storage actually
  provide them"
