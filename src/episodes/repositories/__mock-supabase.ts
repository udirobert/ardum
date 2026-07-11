// Minimal in-memory stand-in for @supabase/supabase-js used by repository
// contract tests. Replicates the fluent builder shapes the EpisodeRepository
// relies on: from().insert/upsert/update/delete/select, with chained .eq()
// .lte() .is() .not() .order() .limit() .select() .maybeSingle() .single().
//
// Two fidelity points matter for the contract:
//   1. .update() chained with .eq("revision", expectedRevision) + .select()
//      .maybeSingle() returns null when no row matches — the Supabase
//      adapter translates that null into an "Episode changed" error.
//   2. The migration declares coordination_invites.episode_id and
//      episode_events.episode_id as ON DELETE CASCADE foreign keys to
//      episodes.id. The mock mirrors those cascades on delete so the
//      "deleteOwned cascades invites" contract test holds.
import { describe, expect, it } from "vitest";

type Row = Record<string, unknown>;

type Filter = {
  op: "eq" | "lte" | "is" | "null" | "not-is" | "not-null";
  field: string;
  value: unknown;
};

type Op = "select" | "insert" | "update" | "upsert" | "delete";

type ThenResult = { data: unknown; error: { message: string } | null };

const CASCADE_TARGETS: Record<string, string[]> = {
  episodes: ["episode_id"],
};

const PRIMARY_KEYS: Record<string, string> = {
  actors: "id",
  episodes: "id",
  episode_events: "id",
  coordination_invites: "token_hash",
};

// FK relationships from scripts/migrations/001-episodes.sql. Mock
// enforces these on insert and upsert so any future contract test that
// forgets to pre-create referenced rows is caught at mock-replay time,
// not just at live-replay time (which is what ADR 0003 implies).
const FK_CONSTRAINTS: Record<
  string,
  Record<string, { table: string; column: string }>
> = {
  episodes: {
    actor_id: { table: "actors", column: "id" },
  },
  episode_events: {
    episode_id: { table: "episodes", column: "id" },
  },
  coordination_invites: {
    episode_id: { table: "episodes", column: "id" },
  },
};

export class InMemorySupabaseClient {
  readonly tables = new Map<string, Row[]>();

  rows(table: string): Row[] {
    let list = this.tables.get(table);
    if (!list) {
      list = [];
      this.tables.set(table, list);
    }
    return list;
  }

  from(table: string): QueryBuilder {
    return new QueryBuilder(this, table, this.rows(table));
  }

  // FK cascade: when a row in `parent` is deleted, drop children whose
  // `parent_id` column value matches the deleted parent's `id` column.
  cascade(parentTable: string, deletedRows: Row[]): void {
    const fk = CASCADE_TARGETS[parentTable];
    if (!fk || deletedRows.length === 0) return;
    const deletedIds = new Set(deletedRows.map((r) => r.id));
    for (const column of fk) {
      for (const [name, rows] of this.tables) {
        if (name === parentTable) continue;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (deletedIds.has(rows[i][column])) rows.splice(i, 1);
        }
      }
    }
  }

  primaryKeyFor(table: string): string | null {
    return PRIMARY_KEYS[table] ?? null;
  }

  // FK-on-insert enforcement. Returns null if every FK column on the row
  // resolves to an existing row in the referenced table, or an
  // error-shaped object mirroring Postgres's standard `insert or update
  // on table "X" violates foreign key constraint "Y_fkey"` message if
  // any FK is unsatisfied. The constraint name follows Postgres's
  // auto-naming convention for unnamed FKs: `<table>_<column>_fkey`,
  // so future contract tests can assert on the message shape byte-for-byte.
  // Schema-level NOT NULL is enforced by `actorId` / `episodeId` keys
  // being absent path, not by this method.
  checkForeignKeys(
    tableName: string,
    row: Row,
  ): { message: string } | null {
    const fks = FK_CONSTRAINTS[tableName];
    if (!fks) return null;
    for (const [column, ref] of Object.entries(fks)) {
      const value = row[column];
      if (value === undefined || value === null) continue;
      const referencedRows = this.rows(ref.table);
      const exists = referencedRows.some((r) => r[ref.column] === value);
      if (!exists) {
        return {
          message: `insert or update on table "${tableName}" violates foreign key constraint "${tableName}_${column}_fkey"`,
        };
      }
    }
    return null;
  }

  reset() {
    this.tables.clear();
  }
}

export class QueryBuilder {
  op: Op = "select";
  data: Row | null = null;
  filters: Filter[] = [];
  selectFields: string | null = null;
  orderBy: { field: string; ascending: boolean } | null = null;
  limitN: number | null = null;
  upsertOnConflict: string | null = null;

  constructor(
    private readonly client: InMemorySupabaseClient,
    private readonly tableName: string,
    private readonly rows: Row[],
  ) {}

  select(fields: string): this {
    this.selectFields = fields;
    if (this.op === "select") this.op = "select";
    return this;
  }

  insert(row: Row): this {
    this.op = "insert";
    this.data = row;
    return this;
  }

  update(row: Row): this {
    this.op = "update";
    this.data = row;
    return this;
  }

  upsert(row: Row, opts?: { onConflict?: string }): this {
    this.op = "upsert";
    this.data = row;
    this.upsertOnConflict = opts?.onConflict ?? null;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ op: "eq", field, value });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ op: "lte", field, value });
    return this;
  }

  is(field: string, value: unknown): this {
    this.filters.push({
      op: value === null ? "null" : "is",
      field,
      value,
    });
    return this;
  }

  not(field: string, op: string, value: unknown): this {
    if (op === "is") {
      this.filters.push({
        op: value === null ? "not-null" : "not-is",
        field,
        value,
      });
    }
    return this;
  }

  order(field: string, opts: { ascending: boolean }): this {
    this.orderBy = { field, ascending: opts.ascending };
    return this;
  }

  // Supabase only honors .limit() on select chains.
  limit(n: number): this {
    if (this.op === "select") this.limitN = n;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const v = row[f.field];
      switch (f.op) {
        case "eq":
          return v === f.value;
        case "lte":
          return typeof v === "number" || typeof v === "string"
            ? (v as never) <= (f.value as never)
            : false;
        case "is":
          return v === f.value;
        case "null":
          return v === null || v === undefined;
        case "not-is":
          return v !== f.value;
        case "not-null":
          return v !== null && v !== undefined;
        default:
          return false;
      }
    });
  }

  private filteredSelect(): Row[] {
    let result = this.rows.filter((r) => this.matches(r));
    if (this.orderBy) {
      const { field, ascending } = this.orderBy;
      result = [...result].sort((a, b) => {
        const av = a[field] as string | number | undefined;
        const bv = b[field] as string | number | undefined;
        if (av === bv) return 0;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (this.limitN !== null) result = result.slice(0, this.limitN);
    return result;
  }

  private filteredMutation(): Row[] {
    return this.rows.filter((r) => this.matches(r));
  }

  private project(row: Row): Row {
    if (!this.selectFields) return row;
    const out: Row = {};
    for (const f of this.selectFields.split(",").map((s) => s.trim())) {
      out[f] = row[f];
    }
    return out;
  }

  async maybeSingle(): Promise<ThenResult> {
    if (this.op === "update" || this.op === "delete") {
      const result = this.runMutation();
      const data = Array.isArray(result.data) ? result.data[0] ?? null : null;
      return { data, error: result.error };
    }
    const matches = this.filteredSelect();
    if (matches.length === 0) return { data: null, error: null };
    return { data: this.project(matches[0]), error: null };
  }

  async single(): Promise<ThenResult> {
    const matches = this.filteredSelect();
    if (matches.length === 0)
      return { data: null, error: { message: "Row not found." } };
    return { data: this.project(matches[0]), error: null };
  }

  private runMutation(): ThenResult {
    try {
      const matches = this.filteredMutation();
      switch (this.op) {
        case "insert": {
          const pk = this.client.primaryKeyFor(this.tableName);
          if (pk && (this.data as Row)[pk] !== undefined) {
            const key = (this.data as Row)[pk];
            if (this.rows.some((r) => r[pk] === key)) {
              return {
                data: null,
                error: {
                  message: `duplicate key value violates unique constraint "${pk}"`,
                },
              };
            }
          }
          const fkError = this.client.checkForeignKeys(
            this.tableName,
            this.data as Row,
          );
          if (fkError) {
            return { data: null, error: fkError };
          }
          this.rows.push(this.data as Row);
          return { data: null, error: null };
        }
        case "upsert": {
          // Pre-write guard. Real Postgres's ON CONFLICT DO UPDATE re-checks
          // constraints on every upsert (insert and update paths alike), so
          // a single FK check before the conflict/push branching mirrors that
          // semantics for both the Object.assign row and the new push row.
          const fkError = this.client.checkForeignKeys(
            this.tableName,
            this.data as Row,
          );
          if (fkError) {
            return { data: null, error: fkError };
          }
          if (this.upsertOnConflict) {
            const key = this.upsertOnConflict;
            const i = this.rows.findIndex(
              (r) => r[key] === (this.data as Row)[key],
            );
            if (i >= 0) Object.assign(this.rows[i], this.data);
            else this.rows.push(this.data as Row);
          } else {
            this.rows.push(this.data as Row);
          }
          return { data: null, error: null };
        }
        case "update":
          for (const row of matches) Object.assign(row, this.data as Row);
          if (this.selectFields) {
            return {
              data: matches.map((r) => this.project(r)),
              error: null,
            };
          }
          return { data: null, error: null };
        case "delete": {
          for (const row of matches) {
            const i = this.rows.indexOf(row);
            if (i >= 0) this.rows.splice(i, 1);
          }
          this.client.cascade(this.tableName, matches);
          return { data: null, error: null };
        }
        default:
          return { data: null, error: null };
      }
    } catch (err: unknown) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  // Thenable so `await builder` resolves with the run.
  then<TResult1 = ThenResult, TResult2 = never>(
    onfulfilled?: ((value: ThenResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const value: ThenResult =
      this.op === "select"
        ? {
            data: this.filteredSelect().map((r) => this.project(r)),
            error: null,
          }
        : this.runMutation();
    return Promise.resolve(value).then(onfulfilled, onrejected);
  }
}

// Contract test for the FK-violation error message shape. Mirrors
// Postgres's auto-naming convention for unnamed FK constraints:
// `<table>_<column>_fkey`. Any future divergence between the mock and
// the live database surfaces here at unit-test time, not in production.
describe("InMemorySupabaseClient FK violation contract", () => {
  describe("insert", () => {
    it("rejects episodes referencing a non-existent actor with the Postgres-canonical constraint name", async () => {
      const client = new InMemorySupabaseClient();
      // No actor pre-created — this insert must reject on FK grounds.
      const result = await client.from("episodes").insert({
        id: "ep-1",
        actor_id: "actor-missing",
        status: "open",
        revision: 1,
        state: {},
      });
      expect(result.error?.message).toBe(
        'insert or update on table "episodes" violates foreign key constraint "episodes_actor_id_fkey"',
      );
      expect(result.data).toBeNull();
      // Regression guard: the row must NOT have been written.
      expect(client.rows("episodes")).toHaveLength(0);
    });

    it("rejects episode_events referencing a non-existent episode with the canonical constraint name", async () => {
      const client = new InMemorySupabaseClient();
      const result = await client.from("episode_events").insert({
        id: "evt-1",
        episode_id: "ep-missing",
        type: "x",
        summary: "y",
      });
      expect(result.error?.message).toBe(
        'insert or update on table "episode_events" violates foreign key constraint "episode_events_episode_id_fkey"',
      );
      expect(result.data).toBeNull();
      // Regression guard: the row must NOT have been written.
      expect(client.rows("episode_events")).toHaveLength(0);
    });

    it("rejects coordination_invites referencing a non-existent episode with the canonical constraint name", async () => {
      const client = new InMemorySupabaseClient();
      const result = await client.from("coordination_invites").insert({
        token_hash: "tok",
        episode_id: "ep-missing",
        participant_name: "Sam",
        expires_at: "2099-01-01T00:00:00.000Z",
      });
      expect(result.error?.message).toBe(
        'insert or update on table "coordination_invites" violates foreign key constraint "coordination_invites_episode_id_fkey"',
      );
      expect(result.data).toBeNull();
      // Regression guard: the row must NOT have been written.
      expect(client.rows("coordination_invites")).toHaveLength(0);
    });

    it("accepts an insert whose FK column resolves to a pre-created row (no false-positive rejection)", async () => {
      const client = new InMemorySupabaseClient();
      await client.from("actors").insert({ id: "actor-1" });
      await client.from("episodes").insert({
        id: "ep-1",
        actor_id: "actor-1",
        status: "open",
        revision: 1,
        state: {},
      });
      const result = await client.from("episode_events").insert({
        id: "evt-1",
        episode_id: "ep-1",
        type: "x",
        summary: "y",
      });
      expect(result.error).toBeNull();
      expect(client.rows("episode_events")).toHaveLength(1);
    });
  });

  describe("upsert", () => {
    it("rejects an upsert whose FK column points to a non-existent row even when onConflict matches an existing row", async () => {
      const client = new InMemorySupabaseClient();
      await client.from("actors").insert({ id: "actor-1" });
      await client.from("episodes").insert({
        id: "ep-1",
        actor_id: "actor-1",
        status: "open",
        revision: 1,
        state: {},
      });
      await client.from("coordination_invites").insert({
        token_hash: "tok-existing",
        episode_id: "ep-1",
        participant_name: "Sam",
        expires_at: "2099-01-01T00:00:00.000Z",
      });
      // Upsert with onConflict=token_hash; change episode_id to a non-existent value.
      const result = await client
        .from("coordination_invites")
        .upsert(
          {
            token_hash: "tok-existing",
            episode_id: "ep-missing",
            participant_name: "Sam",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
          { onConflict: "token_hash" },
        );
      expect(result.error?.message).toBe(
        'insert or update on table "coordination_invites" violates foreign key constraint "coordination_invites_episode_id_fkey"',
      );
      // Existing row must NOT have been mutated by the Object.assign path.
      const stored = client
        .rows("coordination_invites")
        .find((r) => r.token_hash === "tok-existing");
      expect(stored?.episode_id).toBe("ep-1");
    });
  });
});
