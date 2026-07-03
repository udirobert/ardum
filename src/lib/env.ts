// Centralised env access. Vars are read permissively (empty string when
// missing) and surfaced through `has*()` predicates so route handlers
// pick the right code path. The demo runs without any of these set.

type PublicEnv = {
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_0G_CHAIN_ID: string;
  NEXT_PUBLIC_MAGIC_API_KEY: string;
  NEXT_PUBLIC_MAGIC_OIDC_PROVIDER_ID: string;
  NEXT_PUBLIC_PARTICLE_PROJECT_ID: string;
  NEXT_PUBLIC_PARTICLE_CLIENT_KEY: string;
  NEXT_PUBLIC_PARTICLE_APP_ID: string;
  NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS: string;
  NEXT_PUBLIC_USE_TESTNET: string;
  NEXT_PUBLIC_ZERODEV_API_KEY: string;
  NEXT_PUBLIC_OPENFORT_PUBLIC_KEY: string;
  NEXT_PUBLIC_OPENFORT_POLICY_ID: string;
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
  MAGIC_SECRET_KEY: string;
  MAGIC_OIDC_PROVIDER_ID: string;
  PARTICLE_SERVER_KEY: string;
};

const publicEnv: PublicEnv = {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "Ardum",
  NEXT_PUBLIC_0G_CHAIN_ID:
    process.env.NEXT_PUBLIC_0G_CHAIN_ID ?? "0G testnet",
  NEXT_PUBLIC_MAGIC_API_KEY: process.env.NEXT_PUBLIC_MAGIC_API_KEY ?? "",
  NEXT_PUBLIC_MAGIC_OIDC_PROVIDER_ID:
    process.env.NEXT_PUBLIC_MAGIC_OIDC_PROVIDER_ID ?? "",
  NEXT_PUBLIC_PARTICLE_PROJECT_ID:
    process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? "",
  NEXT_PUBLIC_PARTICLE_CLIENT_KEY:
    process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? "",
  NEXT_PUBLIC_PARTICLE_APP_ID:
    process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? "",
  NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS:
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "",
  NEXT_PUBLIC_USE_TESTNET: process.env.NEXT_PUBLIC_USE_TESTNET ?? "",
  NEXT_PUBLIC_ZERODEV_API_KEY: process.env.NEXT_PUBLIC_ZERODEV_API_KEY ?? "",
  NEXT_PUBLIC_OPENFORT_PUBLIC_KEY:
    process.env.NEXT_PUBLIC_OPENFORT_PUBLIC_KEY ?? "",
  NEXT_PUBLIC_OPENFORT_POLICY_ID:
    process.env.NEXT_PUBLIC_OPENFORT_POLICY_ID ?? "",
};

function readServerEnv(): ServerEnv {
  return {
    OG_RPC_URL: process.env.OG_RPC_URL ?? "",
    OG_STORAGE_INDEXER: process.env.OG_STORAGE_INDEXER ?? "",
    OG_COMPUTE_ROUTER_URL: process.env.OG_COMPUTE_ROUTER_URL ?? "",
    OG_COMPUTE_API_KEY: process.env.OG_COMPUTE_API_KEY ?? "",
    OG_COMPUTE_MODEL: process.env.OG_COMPUTE_MODEL ?? "zai-org/GLM-5-FP8",
    OG_PRIVATE_KEY: process.env.OG_PRIVATE_KEY ?? "",
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    MAGIC_SECRET_KEY: process.env.MAGIC_SECRET_KEY ?? "",
    MAGIC_OIDC_PROVIDER_ID: process.env.MAGIC_OIDC_PROVIDER_ID ?? "",
    PARTICLE_SERVER_KEY: process.env.PARTICLE_SERVER_KEY ?? "",
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

// ── UXmaxx Hackathon: booking layer predicates ────────────────────────────

export function hasMagic(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_MAGIC_API_KEY);
}

export function hasMagicServer(): boolean {
  const e = readServerEnv();
  return Boolean(e.MAGIC_SECRET_KEY);
}

export function hasParticleUA(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_PARTICLE_PROJECT_ID &&
      publicEnv.NEXT_PUBLIC_PARTICLE_CLIENT_KEY &&
      publicEnv.NEXT_PUBLIC_PARTICLE_APP_ID,
  );
}

export function hasEscrowContract(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS);
}

export function hasZeroDev(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_ZERODEV_API_KEY);
}

// Construct the ZeroDev RPC URL from the API key + chain ID.
// Format: https://rpc.zerodev.app/api/v3/{apiKey}/chain/{chainId}
export function zerodevRpcUrl(chainId: number): string {
  const key = publicEnv.NEXT_PUBLIC_ZERODEV_API_KEY;
  if (!key) return "";
  return `https://rpc.zerodev.app/api/v3/${key}/chain/${chainId}`;
}

export function hasOpenfort(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_OPENFORT_PUBLIC_KEY &&
      publicEnv.NEXT_PUBLIC_OPENFORT_POLICY_ID,
  );
}

export { publicEnv, readServerEnv };
