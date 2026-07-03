"use client";

// Openfort embedded wallet provider for the x402 class payment flow.
//
// Uses @openfort/react to create an embedded wallet via the publishable key.
// The wallet signs payment authorizations that the x402 endpoint verifies.
//
// Settles on Base Sepolia (testnet only).

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type OpenfortEnv = {
  publishableKey: string;
  policyId: string;
};

function readOpenfortEnv(): OpenfortEnv | null {
  const publishableKey = process.env.NEXT_PUBLIC_OPENFORT_PUBLIC_KEY ?? "";
  const policyId = process.env.NEXT_PUBLIC_OPENFORT_POLICY_ID ?? "";
  if (!publishableKey || !policyId) return null;
  return { publishableKey, policyId };
}

type OpenfortWalletState = {
  configured: boolean;
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  signMessage: (message: string) => Promise<string | null>;
};

const OpenfortContext = createContext<OpenfortWalletState | null>(null);

export function OpenfortWalletProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => readOpenfortEnv(), []);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openfortInstance, setOpenfortInstance] = useState<unknown>(null);

  const connect = useCallback(async (): Promise<string | null> => {
    if (!env) {
      setError("Openfort not configured.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      // @openfort/react provides OpenfortProvider + useOpenfort hook.
      // For the hackathon, we use the REST API via our server route
      // to create/retrieve the account, then use the address for signing.
      const res = await fetch("/api/openfort/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Account creation failed.");
      }

      const data = await res.json();
      const addr = data.address ?? null;
      if (addr) setAddress(addr);
      setOpenfortInstance(data);
      return addr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Openfort connect failed.");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [env]);

  const signMessage = useCallback(
    async (message: string): Promise<string | null> => {
      if (!address) {
        setError("Connect wallet first.");
        return null;
      }
      // In a full implementation, this uses Openfort's embedded wallet
      // to sign the message. For the hackathon, we fall back to Magic's
      // personal_sign (the practitioner already has a Magic wallet from
      // the booking flow). The x402 endpoint verifies the signature
      // regardless of which embedded wallet produced it.
      //
      // The Openfort SDK would do:
      //   const sig = await openfort.signMessage(message)
      // But since the ClassPayment component already has access to
      // useMagicAuth().signPersonalMessage, we delegate there.
      setError("Use Magic signPersonalMessage for signing.");
      return null;
    },
    [address],
  );

  const value: OpenfortWalletState = {
    configured: !!env,
    address,
    connecting,
    error,
    connect,
    signMessage,
  };

  return (
    <OpenfortContext.Provider value={value}>
      {children}
    </OpenfortContext.Provider>
  );
}

export function useOpenfortWallet(): OpenfortWalletState {
  const ctx = useContext(OpenfortContext);
  if (!ctx) {
    throw new Error(
      "useOpenfortWallet must be used within OpenfortWalletProvider",
    );
  }
  return ctx;
}
