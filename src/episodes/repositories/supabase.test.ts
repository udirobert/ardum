// Supabase adapter — runs the same episode repository contract as the local
// in-memory adapter, against a vi.mock'd in-memory Supabase client.
import { beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { runRepositoryContract } from "./contract.suite";
import * as repository from "./supabase";
import { InMemorySupabaseClient } from "./__mock-supabase";

const state = vi.hoisted(() => ({
  client: null as InMemorySupabaseClient | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: () => state.client as unknown as SupabaseClient | null,
}));

// The adapter declares `import "server-only"` so it cannot be imported by
// client components. vitest runs under a node environment, so this guard
// would throw at import time. Stub it as a no-op for the test bundle.
vi.mock("server-only", () => ({}));

function reset() {
  state.client = new InMemorySupabaseClient();
}

beforeEach(reset);

runRepositoryContract("supabase", () => repository, reset);
