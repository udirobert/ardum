# 0005 — Automation runner

- Status: Accepted
- Date: 2026-07-11

## Context

Episodes can ask Mira to monitor (availability, price, deadline) and to
honor non-binding holds that expire. Without a runner, monitor observations
do not accumulate and hold expiry only happens when the next practitioner
command arrives — defeating the "Mira is watching" promise and breaking the
commitment the episode models. The runner needs to be invisible to the
practitioner and idempotent so retries are safe.

## Decision

Split monitoring, holds, and coordination behind three provider interfaces
declared in `src/automation/contracts.ts`:

- `MonitoringProvider.observe({ retreatId, listedPriceUsd, checkedAt, observationId })`
- `HoldProvider.create | release | status`
- `CoordinationProvider.createInvite | redeemInvite`

Each has a deterministic local implementation in `src/automation/local.ts`
seeded from the local retreat catalog so the journey is reproducible
end-to-end without external services. Live providers replace the local
adapters without changing the runner or the service layer.

An automation runner (`src/automation/runner.ts` -> `runDueAutomation(now)`)
takes a `Clock` and `IDFactory` and does one thing per episode: list the
episodes whose `next_action_at` has passed (`episodeRepository.listDue`),
apply the appropriate command (`check-monitor` for active monitors), and
let the service layer schedule the next check by updating
`monitor.nextCheckAt` or leaving hold expiry to `withExpiredHold`.

The route handler `src/app/api/internal/automation/route.ts` accepts
`POST` requests guarded by `process.env.AUTOMATION_SECRET` as an
`Authorization: Bearer ...` header; missing or mismatched secrets return
`401 Unauthorized`. External schedulers (Vercel Cron, GitHub Actions cron,
cron-job.org) tick the route on whatever cadence is appropriate.

Injection (`{ clock, ids }` in `applyEpisodeCommand`) keeps the runner
deterministic in tests and reproducible in production.

## Consequences

- Provider implementations can move from deterministic local behavior to
  live APIs without changing the runner or the service layer.
- Tests use injected clocks and ID factories for reproducibility across
  timezones.
- The route is the only externally visible surface; the runner's internals
  can change without coordination.
- The runner's tick is idempotent because every command in the loop carries
  the episode's expectedRevision and falls through to the existing
  optimistic concurrency path.
- The `lastCheckedAt`, `nextCheckAt`, observations, attempts, and hold
  expiry are all stored in the episode itself; nothing lives in a separate
  scheduler state.

## Alternatives considered

- **Background workers per episode.** Premature infra; over-engineering
  given the existing route-handler-and-runner shape.
- **Inline check on every command.** Wasteful; conflates user-issued and
  system-issued work; no provider abstraction to swap later.
- **RabbitMQ / SQS.** Heavy infrastructure for the bounded cadence and
  idempotency we already enforce.
