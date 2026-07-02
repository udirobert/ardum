"use client";

// Operator wallet button — replaces the MetaMask WalletButton for operators.
// Uses Particle Auth (social login) + ZeroDev (gas sponsorship) so operators
// never need MetaMask or ETH to attest retreats.
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
    configured,
    error,
    connect,
    sessionKeyActive,
    createSessionKey,
  } = useOperatorAuth();

  const [connecting, setConnecting] = useState(false);

  // Notify parent when address changes — no setState in effect body
  useEffect(() => {
    if (address) onConnect(address);
  }, [address, onConnect]);

  async function handleConnect() {
    setConnecting(true);
    const addr = await connect();
    if (addr) {
      await createSessionKey();
    }
    setConnecting(false);
  }

  if (!configured) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Operator social login (Particle Auth + ZeroDev) is not configured.
          Set <code className="tag">NEXT_PUBLIC_PARTICLE_*</code> and{" "}
          <code className="tag">NEXT_PUBLIC_ZERODEV_RPC</code> to enable
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
      {sessionKeyActive && (
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Gas sponsored by ZeroDev · session key enables batch attestation
          writes without re-signing each one.
        </p>
      )}
    </div>
  );
}
