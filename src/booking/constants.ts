// Arbitrum + token constants for the booking layer.
// Deposits settle on Arbitrum One (mainnet) or Arbitrum Sepolia (testnet).

// Chain IDs
export const ARBITRUM_ONE_CHAIN_ID = 42161;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

// USDC addresses on Arbitrum
// Mainnet: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC native)
// Sepolia: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d (test USDC)
export const USDC_ADDRESSES: Record<number, string> = {
  [ARBITRUM_ONE_CHAIN_ID]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [ARBITRUM_SEPOLIA_CHAIN_ID]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

// RPC endpoints
export const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
export const ARBITRUM_SEPOLIA_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

// Which chain to use — testnet for dev, mainnet for production
export const SETTLE_CHAIN_ID =
  process.env.NEXT_PUBLIC_USE_TESTNET === "true"
    ? ARBITRUM_SEPOLIA_CHAIN_ID
    : ARBITRUM_ONE_CHAIN_ID;

export const SETTLE_RPC =
  process.env.NEXT_PUBLIC_USE_TESTNET === "true"
    ? ARBITRUM_SEPOLIA_RPC
    : ARBITRUM_RPC;

export const USDC_ADDRESS = USDC_ADDRESSES[SETTLE_CHAIN_ID] ?? USDC_ADDRESSES[ARBITRUM_ONE_CHAIN_ID];

// Escrow contract address — set after deployment
export const ESCROW_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "";

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Convert USD amount to token's smallest unit
export function usdToTokenUnits(usd: number, decimals: number = USDC_DECIMALS): string {
  return (BigInt(Math.round(usd * 10 ** decimals))).toString();
}

// Default booking windows
export const DEFAULT_REFUND_WINDOW_HOURS = 72; // 3 days to cancel
export const DEFAULT_CHECKIN_WINDOW_HOURS = 168; // 7 days to check in
