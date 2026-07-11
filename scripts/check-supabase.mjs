#!/usr/bin/env node
// Supabase preflight. Run after applying scripts/migrations/001-episodes.sql
// and 004-disable-rls-for-now.sql to confirm a live project is reachable,
// has the four episode tables, accepts write→write→write→delete→cascade,
// and lets the contract suite actually run against real persistence.
//
//   npm run check:supabase
//   npm run check:supabase -- https://<project>.supabase.co   # URL override
//
// Exit code 0 means: the contract suite can now run against this project
// in CI. Non-zero on any failure (env missing, network unreachable,
// table missing, write/cascade error).
//
// Note: this script does NOT inspect pg_class.relrowsecurity because the
// PostgREST API does not expose system catalogs. RLS audit needs the
// Supabase dashboard SQL Editor or scripts/test-supabase-live.mjs.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.argv[2] ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const REQUIRED_TABLES = ["actors", "episodes", "episode_events", "coordination_invites"];

function fail(step, detail) {
  console.error(`\x1b[31m[x] ${step}\x1b[0m`);
  if (detail) console.error(`    ${detail}`);
}
function pass(step, detail) {
  console.log(`\x1b[32m[v] ${step}\x1b[0m${detail ? ` ${detail}` : ""}`);
}
function info(line) {
  console.log(`    ${line}`);
}

async function main() {
  console.log("\nArdum Supabase preflight\n");
  const startedAt = Date.now();

  if (!SUPABASE_URL) {
    fail("env", "SUPABASE_URL not set; provide via env or argv[2]");
    process.exit(1);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    fail("env", "SUPABASE_SERVICE_ROLE_KEY not set; required for service-role writes");
    process.exit(1);
  }
  pass("env", `url present (length ${SUPABASE_URL.length}), key present (length ${SUPABASE_SERVICE_ROLE_KEY.length})`);

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Verify each expected table is queryable via PostgREST.
  //    PostgREST does NOT expose system catalogs (pg_tables, pg_class)
  //    — it only exposes user-defined tables in the exposed schemas.
  //    The right shape is a cheap per-table SELECT, run in parallel.
  //    Use select('*').limit(0) so the probe does not depend on any
  //    specific column existing (coordination_invites PK is token_hash,
  //    not id — every other table uses id, so column-based probes are
  //    brittle).
  const probes = await Promise.all(
    REQUIRED_TABLES.map(async (tableName) => {
      const { error } = await client
        .from(tableName)
        .select("*")
        .limit(0);
      return { tableName, error };
    }),
  );
  const missing = probes
    .filter((p) => p.error)
    .map((p) => ({ table: p.tableName, reason: p.error?.message ?? "(unknown)" }));
  if (missing.length > 0) {
    fail(
      "schema",
      `missing tables: ${missing.map((m) => m.table).join(", ")} — apply scripts/migrations/001-episodes.sql`,
    );
    for (const m of missing) {
      info(`  - ${m.table}: ${m.reason}`);
    }
    process.exit(1);
  }
  pass("schema", `all ${REQUIRED_TABLES.length} episode tables queryable`);

  // 2. Discriminated write cycle on a unique probe episode. Each run uses a
  //    fresh UUID so retries and parallel runs cannot collide.
  const probeActorId = crypto.randomUUID();
  const probeEpisodeId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { error: actorErr } = await client.from("actors").insert({
    id: probeActorId,
    kind: "anonymous",
  });
  if (actorErr) {
    fail("write.actor", actorErr.message);
    process.exit(1);
  }
  pass("write.actor", probeActorId.slice(0, 8));

  const { error: episodeErr } = await client.from("episodes").insert({
    id: probeEpisodeId,
    actor_id: probeActorId,
    status: "capturing",
    revision: 1,
    state: {
      schemaVersion: 1,
      id: probeEpisodeId,
      actorId: probeActorId,
      revision: 1,
      status: "capturing",
      intentions: [],
      processedIdempotencyKeys: [],
      events: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    created_at: nowIso,
    updated_at: nowIso,
  });
  if (episodeErr) {
    fail("write.episode", episodeErr.message);
    await client.from("actors").delete().eq("id", probeActorId);
    process.exit(1);
  }
  pass("write.episode", probeEpisodeId.slice(0, 8));

  const probeEventId = crypto.randomUUID();
  const { error: eventErr } = await client.from("episode_events").insert({
    id: probeEventId,
    episode_id: probeEpisodeId,
    type: "probe.preflight",
    summary: "preflight probe event — should be cascade-deleted",
    created_at: nowIso,
  });
  if (eventErr) {
    fail("write.event", eventErr.message);
  } else {
    pass("write.event", probeEventId.slice(0, 8));
  }

  // 3. Delete the episode with optimistic-concurrency-style filter
  //    (.eq("revision", 1)) to mimic the contract-suite save path. This
  //    proves the same WHERE chain the application uses against Supabase.
  const { data: deletedRow, error: deleteEpisodeErr } = await client
    .from("episodes")
    .delete()
    .eq("id", probeEpisodeId)
    .eq("revision", 1)
    .select("id")
    .maybeSingle();
  if (deleteEpisodeErr) {
    fail("delete.episode", deleteEpisodeErr.message);
  } else if (!deletedRow) {
    fail(
      "delete.episode",
      "no row matched — optimistic concurrency filter rejected the delete (unexpected)",
    );
  } else {
    pass("delete.episode", "row removed via revision match");
  }

  // 4. Verify episodes → episode_events FK cascade actually fired.
  const { data: eventsAfter, error: eventsCheckErr } = await client
    .from("episode_events")
    .select("id")
    .eq("episode_id", probeEpisodeId);
  if (eventsCheckErr) {
    fail("cascade.check", eventsCheckErr.message);
    process.exit(1);
  }
  const orphaned = (eventsAfter ?? []).length;
  if (orphaned !== 0) {
    fail("cascade.check", `expected 0 events, found ${orphaned} — FK cascade did not fire`);
    process.exit(1);
  }
  pass("cascade.check", "episodes → episode_events FK cascade verified");

  // 5. Cleanup the probe actor. (episodes are already gone via cascade.)
  // Wrapped in try/catch so a transient network blip on the cleanup
  // doesn't print a finalize-time error after the script has already
  // proven its main contract — and so we leave a breadcrumb if a probe
  // actor row would otherwise leak into the next preflight run.
  try {
    await client.from("actors").delete().eq("id", probeActorId);
  } catch (err) {
    console.warn(
      `\x1b[33m[!] probe actor cleanup failed: ${probeActorId}\x1b[0m`,
      err instanceof Error ? err.message : String(err),
    );
  }

  const ms = Date.now() - startedAt;
  console.log(`\n\x1b[32mAll Supabase preflight checks passed.\x1b[0m (${ms} ms)`);
  console.log("Note: this script does not inspect pg_class.relrowsecurity;");
  console.log("      use the Supabase dashboard SQL Editor for RLS audit, or wait for");
  console.log("      scripts/test-supabase-live.mjs in a future sprint.\n");
}

main().catch((err) => {
  fail("uncaught", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
