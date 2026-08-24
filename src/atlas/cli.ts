import "server-only";

// Atlas Flight CLI adapter — shells out to the `atlas-flight` Python CLI
// (installed via `uv tool install`). The CLI owns authorization, credential
// storage, and API access. This module normalizes the JSON envelope into
// typed results and never inspects credentials.
//
// CLI contract: https://github.com/atlas-doc/atlas-flight-booking-skill
// The Skill's SKILL.md + references/cli-contract.md are the canonical docs.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLI_BIN = process.env.ATLAS_FLIGHT_BIN ?? "atlas-flight";

// Timeout for search (network-bound). Auth poll has its own --timeout.
const SEARCH_TIMEOUT_MS = 30_000;

type AtlasEnvelope<T> = {
  schema_version: string;
  status: string;
  code: string;
  message: string;
  retryable: boolean;
  request_id: string | null;
  data: T;
  details: Record<string, unknown>;
};

export type AtlasOffer = {
  offer_id: string;
  search_id: string;
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  depart_time: string;
  arrive_time: string;
  duration_minutes: number;
  stops: number;
  total_price: number;
  currency: string;
  price_status: "current" | "reference";
  bookable: boolean;
  cabin: string;
  segments?: Array<{
    segment_id: string;
    airline: string;
    flight_number: string;
    origin: string;
    destination: string;
    depart_time: string;
    arrive_time: string;
    aircraft?: string;
  }>;
};

export type AtlasSearchResult = {
  search_id: string;
  offers: AtlasOffer[];
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string;
  adults: number;
};

export type AuthStatus = {
  authenticated: boolean;
  ticketing_available?: boolean;
  ticketing_activation_url?: string;
  ticketing_blocker?: string;
};

export type AuthLoginResult = {
  authorization_url: string;
  expires_at: string;
  request_id: string;
};

async function runCli<T>(
  args: string[],
  timeoutMs?: number,
): Promise<AtlasEnvelope<T>> {
  try {
    const { stdout } = await execFileAsync(CLI_BIN, args, {
      timeout: timeoutMs ?? SEARCH_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 4, // 4MB — search results can be large
      env: { ...process.env },
    });
    return JSON.parse(stdout) as AtlasEnvelope<T>;
  } catch (err) {
    // execFile rejects on non-zero exit OR timeout. The CLI returns errors
    // as JSON envelopes with non-success codes, not non-zero exits, but
    // timeouts and missing-binary produce native errors.
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("ENOENT")) {
        throw new Error(
          "atlas-flight CLI is not installed. Run: uv tool install --force --python 3.12 atlas-flight-booking==0.3.12",
        );
      }
      if (msg.includes("TIMED OUT") || msg.includes("timeout")) {
        throw new Error("Atlas CLI timed out. The flight search may be too broad.");
      }
      // If stdout exists on the error (some execFile errors include it),
      // try to parse it as an envelope.
      const maybeStdout = (err as { stdout?: string }).stdout;
      if (maybeStdout) {
        try {
          return JSON.parse(maybeStdout) as AtlasEnvelope<T>;
        } catch {
          // fall through to rethrow
        }
      }
    }
    throw err;
  }
}

/** Check whether the Atlas CLI is authorized. */
export async function getAuthStatus(): Promise<AuthStatus> {
  const env = await runCli<{ authenticated: boolean; ticketing_available?: boolean; ticketing_activation_url?: string; ticketing_blocker?: string }>([
    "auth", "status", "--json",
  ]);
  return {
    authenticated: env.data.authenticated,
    ticketing_available: env.data.ticketing_available,
    ticketing_activation_url: env.data.ticketing_activation_url,
    ticketing_blocker: env.data.ticketing_blocker,
  };
}

/** Start the browser authorization flow. Returns the URL the user must visit. */
export async function startAuthLogin(): Promise<AuthLoginResult> {
  const env = await runCli<{ authorization_url: string; expires_at: string }>([
    "auth", "login", "--json",
  ]);
  return {
    authorization_url: env.data.authorization_url,
    expires_at: env.data.expires_at,
    request_id: env.request_id ?? "",
  };
}

/** Poll once for authorization completion (bounded to 120s by the CLI). */
export async function pollAuth(): Promise<{ authorized: boolean }> {
  const env = await runCli<{ authenticated: boolean }>([
    "auth", "poll", "--timeout", "120", "--json",
  ], 130_000);
  return { authorized: env.data.authenticated };
}

/** Switch the CLI to sandbox mode. */
export async function useSandbox(): Promise<void> {
  await runCli<Record<string, unknown>>([
    "environment", "use", "sandbox", "--json",
  ]);
}

/** Search for flights. Returns normalized offers. */
export async function searchFlights(params: {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  adults?: number;
  returnDate?: string; // YYYY-MM-DD
  currency?: string;
}): Promise<AtlasSearchResult> {
  const args = [
    "search",
    "--origin", params.origin,
    "--destination", params.destination,
    "--depart", params.departDate,
    "--adults", String(params.adults ?? 1),
  ];
  if (params.returnDate) args.push("--return-date", params.returnDate);
  if (params.currency) args.push("--currency", params.currency);
  args.push("--json");

  const env = await runCli<{
    search_id: string;
    offers: unknown[];
    origin: string;
    destination: string;
    depart_date: string;
    return_date?: string;
    adults: number;
  }>(args);

  return {
    search_id: env.data.search_id,
    offers: (env.data.offers ?? []) as AtlasOffer[],
    origin: env.data.origin,
    destination: env.data.destination,
    depart_date: env.data.depart_date,
    return_date: env.data.return_date,
    adults: env.data.adults ?? params.adults ?? 1,
  };
}

/** Verify a specific offer's current price and availability. */
export async function verifyOffer(offerId: string): Promise<{
  offer_id: string;
  price_status: "current" | "reference";
  total_price: number;
  currency: string;
  price_change: "unchanged" | "increased" | "decreased";
  previous_price?: number;
  current_price?: number;
  bookable: boolean;
}> {
  const env = await runCli<{
    offer_id: string;
    price_status: "current" | "reference";
    total_price: number;
    currency: string;
    price_change: "unchanged" | "increased" | "decreased";
    previous_price?: number;
    current_price?: number;
    bookable: boolean;
  }>(["offer", "verify", "--offer-id", offerId, "--json"]);

  return env.data;
}

/** Check whether the atlas-flight CLI binary is available. */
export async function isCliAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(CLI_BIN, ["--version"], {
      timeout: 5_000,
    });
    return stdout.trim().startsWith("atlas-flight");
  } catch {
    return false;
  }
}
