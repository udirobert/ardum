// Local in-memory adapter — runs the same conformance contract as the
// Supabase adapter. The shared suite lives in ./contract.suite.ts.
import { runRepositoryContract } from "./contract.suite";
import * as repository from "./local";

function reset() {
  globalThis.__ardumEpisodes?.clear();
  globalThis.__ardumEpisodeInvites?.clear();
}

runRepositoryContract("local", () => repository, reset);
