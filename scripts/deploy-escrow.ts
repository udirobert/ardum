// Deploy RetreatDepositEscrow to Arbitrum Sepolia (or mainnet).
//
// Usage:
//   npx tsx scripts/deploy-escrow.ts
//
// Requires:
//   ESCROW_DEPLOYER_PRIVATE_KEY — funded wallet on Arbitrum Sepolia
//   (or Arbitrum mainnet for production)
//
// After deployment, set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS in .env.local
// to the returned contract address.

import { ethers, ContractFactory } from "ethers";
import { readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Load .env.local manually (Next.js convention, not dotenv default)
const envLocal = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
for (const line of envLocal.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
}

// USDC addresses
const USDC_ARBITRUM_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const USDC_ARBITRUM_MAINNET = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const ARBITRUM_SEPOLIA_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const ARBITRUM_MAINNET_RPC = "https://arb1.arbitrum.io/rpc";

async function main() {
  const privateKey = process.env.ESCROW_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: Set ESCROW_DEPLOYER_PRIVATE_KEY in .env.local");
    console.error("Generate a wallet: node -e \"console.log(require('ethers').Wallet.createRandom().privateKey)\"");
    process.exit(1);
  }

  const useMainnet = process.env.NEXT_PUBLIC_USE_TESTNET === "false";
  const rpc = useMainnet ? ARBITRUM_MAINNET_RPC : ARBITRUM_SEPOLIA_RPC;
  const usdcAddress = useMainnet ? USDC_ARBITRUM_MAINNET : USDC_ARBITRUM_SEPOLIA;
  const networkName = useMainnet ? "Arbitrum One" : "Arbitrum Sepolia";

  console.log(`Deploying RetreatDepositEscrow to ${networkName}...`);
  console.log(`USDC token: ${usdcAddress}`);

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === BigInt(0)) {
    console.error(`ERROR: Deployer has no ETH on ${networkName}.`);
    if (!useMainnet) {
      console.error(`Fund via Arbitrum Sepolia faucet: https://faucet.quicknode.com/arbitrum/sepolia`);
      console.error(`or: https://www.alchemy.com/faucets/arbitrum-sepolia`);
    }
    process.exit(1);
  }

  // Compile the contract using solc
  const contractPath = join(process.cwd(), "contracts", "RetreatDepositEscrow.sol");
  const source = readFileSync(contractPath, "utf-8");

  // Use require for solc — the ESM import shape differs
  const solc = require("solc") as { compile: (input: string) => string };
  const input = {
    language: "Solidity",
    sources: {
      "RetreatDepositEscrow.sol": { content: source },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  console.log("Compiling contract...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e: { severity: string }) => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:");
      for (const e of errors) console.error(e.formattedMessage);
      process.exit(1);
    }
  }

  const contract = output.contracts["RetreatDepositEscrow.sol"]["RetreatDepositEscrow"];
  const abi = contract.abi;
  const bytecode = "0x" + contract.evm.bytecode.object;

  // Deploy
  console.log("Sending deployment transaction...");
  const factory = new ContractFactory(abi, bytecode, wallet);
  const tx = await factory.deploy(usdcAddress);
  await tx.waitForDeployment();

  const contractAddress = await tx.getAddress();
  console.log(`\n✓ Deployed at: ${contractAddress}`);
  console.log(`\nAdd to .env.local:`);
  console.log(`NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${contractAddress}`);

  // Write ABI to file for frontend use
  const { writeFileSync } = await import("fs");
  writeFileSync(
    join(process.cwd(), "src", "booking", "escrow-deployed-abi.json"),
    JSON.stringify({ abi, address: contractAddress, network: networkName, usdc: usdcAddress }, null, 2),
  );
  console.log(`ABI written to src/booking/escrow-deployed-abi.json`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
