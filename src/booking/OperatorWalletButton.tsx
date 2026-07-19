"use client";

// Operator wallet button — the operator's sign-in surface.
// Uses Particle Auth (social login) + ZeroDev Kernel (gas sponsorship) so
// operators never need MetaMask or ETH to list retreats.
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
  const { address, configured, error, connect, createSessionKey } =
    useOperatorAuth();

  const [connecting, setConnecting] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

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

  if (!configured) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Google sign-in is not configured yet. You can still publish with a
          crypto wallet below.
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
        {!connected && !connecting && "Sign in with Google"}
        {connecting && "Connecting…"}
        {connected && address && (
          <>
            <span className="text-[color:var(--accent-ink)]">signed in · </span>
            <span className="tag">{address.slice(0, 6)}…{address.slice(-4)}</span>
          </>
        )}
        {error && !connecting && !connected && error}
      </button>

      {creatingSession && (
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Setting up your account…
        </p>
      )}

      {connected && (
        <p className="text-xs text-[color:var(--muted)] max-w-sm">
          Your retreat listing will be signed by your Google account.
          Practitioners will see it in their matches.
        </p>
      )}
    </div>
  );
}
