import "server-only";

// On-chain deposit verification for agent bookings. The agent claims a
// deposit tx hash; the server fetches the tx + receipt from the settle RPC
// and verifies:
//   - the tx exists and is confirmed (blockNumber present)
//   - the receipt status === 1 (success)
//   - the tx sender matches the claimed agentAddress
//   - if the tx is a USDC `transfer(address,uint256)` call, the recipient
//     and amount match the claimed receiver + depositUsd
//
// For non-USDC-transfer txs (e.g. Particle UA Type-4 bundles, escrow
// `deposit()` calls), we verify sender + success only and return
// `verified: "sender"` — the bundle's internal value move is not directly
// inspectable via simple RPC. The strong anti-forgery check is that the
// sender is the agent's own address.

import { JsonRpcProvider, id } from "ethers";
import {
  SETTLE_RPC,
  SETTLE_CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from "./constants";

const TRANSFER_SELECTOR = id("transfer(address,uint256)").slice(0, 10); // 0xa9059cbb

export type DepositVerification = {
  verified: "full" | "sender" | "failed";
  reason?: string;
  from?: string;
  to?: string;
  blockNumber?: number;
};

export async function verifyDepositTx(params: {
  depositTxHash: string;
  agentAddress: string;
  expectedReceiver?: string; // escrow or operator address
  depositUsd: number;
}): Promise<DepositVerification> {
  const { depositTxHash, agentAddress, expectedReceiver, depositUsd } = params;
  if (!/^0x[a-fA-F0-9]{64}$/.test(depositTxHash)) {
    return { verified: "failed", reason: "Invalid tx hash format." };
  }

  let provider: JsonRpcProvider;
  try {
    provider = new JsonRpcProvider(SETTLE_RPC);
  } catch {
    return { verified: "failed", reason: "RPC unavailable." };
  }

  let tx: Awaited<ReturnType<JsonRpcProvider["getTransaction"]>>;
  try {
    tx = await provider.getTransaction(depositTxHash);
  } catch (err) {
    return {
      verified: "failed",
      reason: `RPC fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
  if (!tx) {
    return { verified: "failed", reason: "Transaction not found on settle chain." };
  }
  if (!tx.blockNumber) {
    return { verified: "failed", reason: "Transaction not yet confirmed." };
  }

  let receipt: Awaited<ReturnType<JsonRpcProvider["getTransactionReceipt"]>>;
  try {
    receipt = await provider.getTransactionReceipt(depositTxHash);
  } catch {
    return { verified: "failed", reason: "Receipt fetch failed." };
  }
  if (!receipt) {
    return { verified: "failed", reason: "Receipt not found." };
  }
  if (receipt.status !== 1) {
    return { verified: "failed", reason: "Transaction reverted on-chain." };
  }

  // Sender must match the claimed agent address.
  const from = (tx.from ?? "").toLowerCase();
  if (from !== agentAddress.toLowerCase()) {
    return {
      verified: "failed",
      reason: `Tx sender ${from} does not match agentAddress ${agentAddress}.`,
      from,
    };
  }

  // Strong check: USDC transfer(address,uint256) to the expected receiver.
  if (tx.to?.toLowerCase() === USDC_ADDRESS.toLowerCase() && tx.data?.startsWith(TRANSFER_SELECTOR)) {
    try {
      const decoded = decodeTransferCalldata(tx.data);
      const recipient = decoded.recipient.toLowerCase();
      const amount = decoded.amount;
      const expectedAmount = BigInt(Math.round(depositUsd * 10 ** USDC_DECIMALS));
      if (expectedReceiver && recipient !== expectedReceiver.toLowerCase()) {
        return {
          verified: "failed",
          reason: `USDC recipient ${recipient} does not match expected ${expectedReceiver}.`,
          from,
          to: tx.to,
          blockNumber: tx.blockNumber,
        };
      }
      if (amount !== expectedAmount) {
        return {
          verified: "failed",
          reason: `USDC amount ${amount} does not match expected ${expectedAmount} (${depositUsd} USDC).`,
          from,
          to: tx.to,
          blockNumber: tx.blockNumber,
        };
      }
      return {
        verified: "full",
        from,
        to: tx.to,
        blockNumber: tx.blockNumber,
      };
    } catch (err) {
      return {
        verified: "sender",
        reason: `USDC decode failed (${err instanceof Error ? err.message : "unknown"}); sender verified only.`,
        from,
        to: tx.to,
        blockNumber: tx.blockNumber,
      };
    }
  }

  // Non-USDC-transfer tx (UA bundle, escrow deposit, etc.) — sender + success
  // verified, internal value move not inspected.
  return {
    verified: "sender",
    from,
    to: tx.to ?? undefined,
    blockNumber: tx.blockNumber,
  };
}

function decodeTransferCalldata(data: string): { recipient: string; amount: bigint } {
  // calldata = selector(4 bytes) + address(32 bytes, left-padded) + uint256(32 bytes)
  if (data.length < 10 + 128) throw new Error("Calldata too short for transfer().");
  const args = data.slice(10); // strip 0x + 4-byte selector
  const recipientHex = args.slice(0, 64);
  const amountHex = args.slice(64, 128);
  const recipient = "0x" + recipientHex.slice(-40);
  const amount = BigInt("0x" + amountHex);
  return { recipient, amount };
}

// Re-export for tests / consumers that need the chain context.
export { SETTLE_CHAIN_ID };
