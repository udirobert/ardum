# 0004 — Identity cookie

- Status: Accepted
- Date: 2026-07-11

## Context

Episodes need a stable ownership primitive the server can verify without
trusting the client. We cannot require accounts for first-time use and we
cannot put actor IDs in URLs (URLs leak into logs, screenshots, browser
history, and external referrer headers).

## Decision

On first use, the server mints an actor UUID and stores a signed identifier
under the `ardum-actor` HttpOnly cookie:

```
Set-Cookie: ardum-actor=<actorId>.<HMAC-SHA256(actorId, secret)>;
             HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000
```

The signing secret is `process.env.ARDUM_ACTOR_SECRET`, falling back to
`process.env.SUPABASE_SERVICE_ROLE_KEY` (both server-only) and finally to a
local-development fallback so the demo mode works without configuration.

Verification (`verifySignedActor` in `src/identity/signature.ts`) uses
`crypto.timingSafeEqual` to compare the supplied signature against the
expected one. Clients never submit actor IDs; road handlers resolve ownership
server-side from the signed cookie (`resolveActor` in `src/identity/actor.ts`).

If the cookie is missing, `resolveActor({ create: false })` returns `null`
and the caller treats the request as anonymous. The first request that wants
ownership (the POST `/api/episodes` capture) resolves with `{ create: true }`
and the cookie is set.

Authenticated identity (Magic, Particle Auth, future providers) attaches an
`external_subject` to the same `actors` row but does not change the episode
ownership contract. The cookie remains the only ownership primitive the
adapter layer enforces.

## Consequences

- No actor IDs in URLs, logs, or referrer headers.
- Signed cookies survive restarts but invalidate on secret rotation;
  rotation is the natural invalidation mechanism.
- Ownership is unambiguous across server restarts and Vercel cold starts.
- During secret rotation, all existing cookies invalidate; episodes remain
  in storage but become inaccessible until an authenticated identity is
  attached.
- The cookie implementation has unit-test coverage for tamper resistance
  (`src/identity/signature.test.ts`); the application-level trust still
  relies on the routing layer's server-side resolution.

## Alternatives considered

- **Browser fingerprint.** Lossy; breaks across devices; collides on
  shared computer use.
- **OAuth-first.** Adds friction for first-time use and abandons the
  anonymous-to-attached trajectory the product vision requires.
- **localStorage actor.** Client-trust model; vulnerable to XSS and to
  per-browser isolation; never works as the only ownership anchor.
