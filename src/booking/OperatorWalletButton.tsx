"use client";

// Operator wallet button — replaces the MetaMask WalletButton for operators.
// Uses Particle Auth (social login) + ZeroDev Kernel (gas sponsorship) so
// operators never need MetaMask or ETH to attest retreats.
//
// This is an ALTERNATIVE to the existing WalletButton.tsx — operators can
// choose either flow. The existing MetaMask path stays for backward compat.

import { useEffect, useState } from "react";
import { useOperatorAuth } from "./OperatorAuth";

export default function OperatorWalletButton({
  onConnect,
}: {
  onConnect: (address: string) => void;
}) {
  const {
    address,
    smartAccountAddress,
    configured,
    error,
    connect,
    sessionKeyActive,
    createSessionKey,
    sendGaslessTx,
  } = useOperatorAuth();

  const [connecting, setConnecting] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [gaslessTxHash, setGaslessTxHash] = useState<string | null>(null);
  const [sendingGasless, setSendingGasless] = useState(false);

  // Notify parent when address changes — no setState in effect body
  useEffect(() => {
    if (address) onConnect(address);
  }, [address, onConnect]);

  async function handleConnect() {
    setConnecting(true);
    const addr = await connect();
    if (addr) {
      // Create the session key immediately after connecting so the operator
      // has a gasless smart account ready for batch attestation writes.
      setCreatingSession(true);
      await createSessionKey();
      setCreatingSession(false);
    }
    setConnecting(false);
  }

  async function handleGaslessTx() {
    setSendingGasless(true);
    setGaslessTxHash(null);
    const hash = await sendGaslessTx();
    if (hash) setGaslessTxHash(hash);
    setSendingGasless(false);
  }

  if (!configured) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Operator social login (Particle Auth + ZeroDev) is not configured.
          Set <code className="tag">NEXT_PUBLIC_PARTICLE_*</code> and{" "}
          <code className="tag">NEXT_PUBLIC_ZERODEV_API_KEY</code> to enable
          gasless attestation writes.
        </p>
      </div>
    );
  }

  const connected = !!address;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting || connected}
        className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors disabled:opacity-60 text-left"
      >
        {!connected && !connecting && "Sign in with Google (gasless)"}
        {connecting && "Connecting…"}
        {connected && address && (
          <>
            <span className="text-[color:var(--accent-ink)]">connected · </span>
            <span className="tag">{address.slice(0, 6)}…{address.slice(-4)}</span>
            {sessionKeyActive && (
              <span className="text-[color:var(--accent-ink)]"> · session key active</span>
            )}
          </>
        )}
        {error && !connecting && !connected && error}
      </button>

      {creatingSession && (
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Creating ZeroDev session key…
        </p>
      )}

      {smartAccountAddress && (
        <div className="text-xs text-[color:var(--muted)] max-w-sm space-y-1">
          <p>
            <span className="tag">smart account</span>{" "}
            <span className="break-all">{smartAccountAddress.slice(0, 10)}…{smartAccountAddress.slice(-8)}</span>
          </p>
          <p>
            Gasless ERC-4337 account via ZeroDev Kernel. The operator EOA
            signs once; the session key handles batch attestation writes
            without re-signing each one.
          </p>
          <button
            type="button"
            onClick={handleGaslessTx}
            disabled={sendingGasless}
            className="mt-2 px-3 py-1.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-xs disabled:opacity-50"
          >
            {sendingGasless ? "Sending gasless tx…" : "Test gasless tx (ZeroDev paymaster)"}
          </button>
          {gaslessTxHash && (
            <p className="break-all">
              <span className="tag">tx</span>{" "}
              <a
                href={`https://sepolia.arbiscan.io/tx/${gaslessTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {gaslessTxHash.slice(0, 18)}…
              </a>
            </p>
          )}
        </div>
      )}

      {sessionKeyActive && !smartAccountAddress && (
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Gas sponsored by ZeroDev · session key enables batch attestation
          writes without re-signing each one.
        </p>
      )}
    </div>
  );
}
