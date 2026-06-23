"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    // EIP-1193 provider (MetaMask, Rabby, etc.)
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

type Status = "idle" | "connecting" | "connected" | "wrong-network" | "error";

const EXPECTED_CHAIN_ID = process.env.NEXT_PUBLIC_0G_CHAIN_ID ?? "0G testnet";

export default function WalletButton({
  onConnect,
}: {
  onConnect: (address: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((accts) => {
        if (Array.isArray(accts) && accts.length > 0) {
          const a = accts[0] as string;
          setAddress(a);
          setStatus("connected");
          onConnect(a);
        }
      })
      .catch(() => {});
  }, [onConnect]);

  async function connect() {
    const eth = window.ethereum;
    if (!eth) {
      setError("No injected wallet found. Install MetaMask or Rabby.");
      setStatus("error");
      return;
    }
    setStatus("connecting");
    setError(null);
    try {
      const accts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      const a = accts[0];
      if (!a) throw new Error("No account returned.");
      setAddress(a);
      setStatus("connected");
      onConnect(a);

      // Optional: switch to the 0G testnet. If the network isn't added, we
      // surface a soft warning — attestation writes still work on whatever
      // chain the wallet is on (the SDK signs; the 0G chain ID is verified
      // separately).
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x40d9" }], // 16661 in hex — 0G testnet placeholder
        });
      } catch {
        setStatus("wrong-network");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={connect}
        disabled={status === "connecting" || status === "connected"}
        className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors disabled:opacity-60 text-left"
      >
        {status === "idle" && "Connect wallet"}
        {status === "connecting" && "Connecting…"}
        {status === "connected" && address && (
          <>
            <span className="text-[color:var(--accent-ink)]">connected · </span>
            <span className="tag">{short(address)}</span>
          </>
        )}
        {status === "wrong-network" && address && (
          <>
            <span>connected on a different network — expected </span>
            <span className="tag">{EXPECTED_CHAIN_ID}</span>
          </>
        )}
        {status === "error" && (error ?? "Connection failed")}
      </button>
      {status === "wrong-network" && (
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Switching to {EXPECTED_CHAIN_ID} is recommended for attestation
          writes. Reading and matching work on any chain.
        </p>
      )}
    </div>
  );
}

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
