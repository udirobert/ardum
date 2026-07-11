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
          this.rows.push(this.data as Row);
          return { data: null, error: null };
        }
        case "upsert": {
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
