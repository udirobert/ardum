// Live-Supabase replay of runRepositoryContract(). Closes the gap ADR 0003
// calls out: the in-process mock covers PK uniqueness and FK cascade but
// does NOT cover SQL type coercion, RPC semantics, PostgREST content
// negotiation, or RLS policies. This file exercises every behavior the
// mock cannot, against the real database.
//
// Gated strictly on PROD_URL + PROD_KEY env vars (no fallback to the app's
// regular SUPABASE_URL — that env is normally present in this sandbox and
// would otherwise turn every `npm test` run into a live-Supabase run). The
// user-facing entry is scripts/test-supabase-live.mjs; npm scripts can
// also run it directly:
//
//   npm test                                       # skips this suite
//   PROD_URL=... PROD_KEY=... npm test             # runs
//   PROD_URL=... PROD_KEY=... \
//     node scripts/test-supabase-live.mjs           # runs

import { afterAll, beforeAll, describe } from "vitest";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runRepositoryContract } from "./contract.suite";
import * as supabase from "./supabase";
import { setSupabaseAdminForTest } from "@/lib/supabase";
import type { Episode } from "../model";
import type { EpisodeRepository, InviteRecord } from "../repository";

const PROD_URL = process.env.PROD_URL ?? "";
const PROD_KEY = process.env.PROD_KEY ?? "";
const LIVE = Boolean(PROD_URL && PROD_KEY);

describe.skipIf(!LIVE)("Supabase live: episode repository contract", () => {
  const runId = crypto.randomUUID();
  let probeClient: SupabaseClient;

  // Deterministic bidirection map: plain string IDs (e.g. "owner", "ep-owner")
  // <-> UUIDs that Postgres will accept. The supabase adapter accepts only
  // UUIDs for actors.id and episodes.id (the schema declares them as uuid
  // primary key); the contract suite uses plain strings for comfort. This
  // map bridges the two, every run picks fresh UUIDs so back-to-back runs
  // can't collide, and the reverse lookup restores the plain form on read
  // so toEqual assertions keep matching the un-namespaced Episode shape.
  const plainToUuid = new Map<string, string>();
  const uuidToPlain = new Map<string, string>();
  const toUuid = (input: string): string => {
    if (plainToUuid.has(input)) return plainToUuid.get(input)!;
    if (uuidToPlain.has(input)) return input;
    // First 32 hex of SHA-256(`${runId}:${input}`); format with version
    // nibble 5 (RFC 4122 §4.1.3) and variant 10xx so Postgres' uuid parser
    // accepts it. The mapping is per-runId so distinct runs are isolated.
    const hash = createHash("sha256")
      .update(`${runId}:${input}`)
      .digest("hex")
      .slice(0, 32);
    const uuid =
      `${hash.slice(0, 8)}-` +
      `${hash.slice(8, 12)}-` +
      `5${hash.slice(13, 16)}-` +
      `8${hash.slice(17, 20)}-` +
      `${hash.slice(20, 32)}`;
    plainToUuid.set(input, uuid);
    uuidToPlain.set(uuid, input);
    return uuid;
  };
  const stripUuid = (uuid: string): string => uuidToPlain.get(uuid) ?? uuid;

  // Note: episode.events[].id and monitor.observations[].id are NOT wrapped.
  // The current contract suite passes empty events and no observations, so
  // no translation is required. If a future test populates them, the
  // wrapper will need extension (events use UUIDs; observation ids are
  // generated locally and don't need translation but should be preserved).
  //
  // Postgres TIMESTAMPTZ columns can return the same instant in several
  // ISO 8601-equivalent forms (e.g. "...+00" without milliseconds, "...T00:00:00+00"
  // with a space, "2099-01-01 00:00:00+00" Postgres native). The contract
  // suite passes canonical "...T00:00:00.000Z" forms in via makeEpisode
  // and `{ expiresAt: "...Z" }`. We normalize the read-side to that
  // canonical form so toEqual can compare byte-exact without constraining
  // Postgres's output style.
  const normalizeTimestamp = (ts: string | undefined): string | undefined => {
    if (ts === undefined) return undefined;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ts)) return ts;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toISOString();
  };
  const stripEpisode = (ep: Episode): Episode => ({
    ...ep,
    id: stripUuid(ep.id),
    actorId: stripUuid(ep.actorId),
  });
  const stripInvite = (rec: InviteRecord): InviteRecord => ({
    ...rec,
    episodeId: stripUuid(rec.episodeId),
    // rec.expiresAt is required (string), so the ?? rec.expiresAt fallback
    // narrows normalizeTimestamp's union return to string in the type system.
    expiresAt: normalizeTimestamp(rec.expiresAt) ?? rec.expiresAt,
    // rec.respondedAt is optional (string | undefined); the existing
    // conditional already narrows to string | undefined which fits the
    // optional field type.
    respondedAt:
      rec.respondedAt !== undefined
        ? normalizeTimestamp(rec.respondedAt)
        : rec.respondedAt,
  });
  const filterOwnRun = (eps: Episode[]): Episode[] =>
    // An episode belongs to this run iff its stored id maps back to some
    // plain id (i.e. was translated by this runId's namespace).
    eps.filter((e) => stripUuid(e.id) !== e.id).map(stripEpisode);

  beforeAll(() => {
    probeClient = createClient(PROD_URL, PROD_KEY, {
      auth: { persistSession: false },
    });
    setSupabaseAdminForTest(probeClient);
  });

  afterAll(async () => {
    if (!probeClient) return;
    // Cleanup iterates every UUID we minted in this run (recorded in
    // uuidToPlain) and removes the matching actor, episode, and invite
    // rows. Episodes cascade to episode_events; coordination_invites are
    // deleted explicitly because the cascade direction is one-way (an
    // invite has FK to episodes, not vice versa).
    for (const uuid of uuidToPlain.keys()) {
      await probeClient.from("actors").delete().eq("id", uuid);
      await probeClient.from("episodes").delete().eq("id", uuid);
      await probeClient
        .from("coordination_invites")
        .delete()
        .eq("episode_id", uuid);
    }
    setSupabaseAdminForTest(null);
  });

  // Wraps the supabase adapter to satisfy the contract suite's plain
  // string ids (the suite uses strings like "owner", "ep-owner" — the
  // local in-memory and mock adapters are typeless) and the live DB's
  // uuid-typed actors.id / episodes.id columns, AND to keep the per-run
  // probe namespace isolated (every run mints fresh UUIDs so back-to-back
  // runs cannot collide). The translation is bidirectional:
  //
  //   toUuid  : plain -> UUID (registers in plainToUuid and uuidToPlain,
  //                           idempotent on already-mapped UUID inputs)
  //   stripUuid: UUID -> plain (falls back to the raw value for any UUID
  //                            that's not in this run's reverse map, so
  //                            unrelated rows remain untouched)
  //
  // Load-bearing correctness detail: respondToInvite internally calls
  // save with the episode it fetched from the DB (whose state JSON has
  // already-translated ids). toUuid's idempotency-on-already-UUID is what
  // keeps the internal UPDATE matching its row instead of double-mapping
  // itself into a UUID that doesn't exist.
  function withTypeAndRunNamespace(): EpisodeRepository {
    return {
      create: (ep) =>
        supabase
          .create({ ...ep, id: toUuid(ep.id), actorId: toUuid(ep.actorId) })
          .then(stripEpisode),
      getOwned: (actorId, episodeId) =>
        supabase
          .getOwned(toUuid(actorId), toUuid(episodeId))
          .then((ep) => (ep ? stripEpisode(ep) : undefined)),
      listOwned: (actorId) =>
        supabase.listOwned(toUuid(actorId)).then(filterOwnRun),
      listDue: (_now) => supabase.listDue(_now).then(filterOwnRun),
      save: (actorId, ep, expectedRevision) =>
        supabase
          .save(
            toUuid(actorId),
            { ...ep, id: toUuid(ep.id), actorId: toUuid(ep.actorId) },
            expectedRevision,
          )
          .then(stripEpisode),
      createInvite: (record) =>
        supabase.createInvite({
          ...record,
          // token_hash is TEXT in the schema; only episode_id is UUID.
          episodeId: toUuid(record.episodeId),
        }),
      getInvite: (tokenHash) =>
        supabase
          .getInvite(tokenHash)
          .then((rec) => (rec ? stripInvite(rec) : undefined)),
      respondToInvite: (tokenHash, response) =>
        supabase
          .respondToInvite(tokenHash, response)
          .then((ep) => stripEpisode(ep)),
      deleteOwned: (actorId, episodeId) =>
        supabase.deleteOwned(toUuid(actorId), toUuid(episodeId)),
    };
  }

  runRepositoryContract(
    "live",
    () => withTypeAndRunNamespace(),
    async () => {
      // Reset between tests: the suite uses overlapping ids across tests
      // (e.g. "owner", "alice", "roundtrip" appear in multiple cases), so
      // we clean this run's namespace before each test to avoid residue
      // causing false-positive assertions.
      for (const uuid of uuidToPlain.keys()) {
        await probeClient.from("actors").delete().eq("id", uuid);
        await probeClient.from("episodes").delete().eq("id", uuid);
        await probeClient
          .from("coordination_invites")
          .delete()
          .eq("episode_id", uuid);
      }
    },
  );
});
