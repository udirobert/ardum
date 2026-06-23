// Centralised env access. Server-only vars are read with `serverEnv`; the
// client only ever sees `publicEnv`. Anything missing throws at first use so
// the failure mode is loud, not silent.

type PublicEnv = {
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_0G_CHAIN_ID: string;
};

type ServerEnv = {
  OG_RPC_URL: string;
  OG_STORAGE_INDEXER: string;
  OG_COMPUTE_ROUTER_URL: string;
  OG_COMPUTE_API_KEY: string;
  OG_COMPUTE_MODEL: string;
  OG_PRIVATE_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

const publicEnv: PublicEnv = {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "Ardum",
  NEXT_PUBLIC_0G_CHAIN_ID:
    process.env.NEXT_PUBLIC_0G_CHAIN_ID ?? "0G testnet",
};

function readServerEnv(): ServerEnv {
  const required = (key: keyof ServerEnv) => {
    const v = process.env[key];
    if (!v) {
      throw new Error(
        `Missing server env var: ${key}. The demo runs without it (the stub ` +
          `agent + local attestation store kick in) but production needs it.`
      );
    }
    return v;
  };
  return {
    OG_RPC_URL: process.env.OG_RPC_URL ?? "",
    OG_STORAGE_INDEXER: process.env.OG_STORAGE_INDEXER ?? "",
    OG_COMPUTE_ROUTER_URL: process.env.OG_COMPUTE_ROUTER_URL ?? "",
    OG_COMPUTE_API_KEY: process.env.OG_COMPUTE_API_KEY ?? "",
    OG_COMPUTE_MODEL: process.env.OG_COMPUTE_MODEL ?? "zai-org/GLM-5-FP8",
    OG_PRIVATE_KEY: process.env.OG_PRIVATE_KEY ?? "",
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

// Lazy + permissive: returns true if all keys for a feature are present.
// Lets the route handlers pick the right code path without throwing.
export function has0GStorage(): boolean {
  const e = readServerEnv();
  return Boolean(e.OG_RPC_URL && e.OG_STORAGE_INDEXER && e.OG_PRIVATE_KEY);
}

export function has0GCompute(): boolean {
  const e = readServerEnv();
  return Boolean(e.OG_COMPUTE_ROUTER_URL && e.OG_COMPUTE_API_KEY);
}

export function hasSupabase(): boolean {
  const e = readServerEnv();
  return Boolean(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY);
}

export { publicEnv, readServerEnv };
