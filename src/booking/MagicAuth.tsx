"use client";

// Magic social login provider. Creates an embedded wallet via Magic's
// connectWithUI (social login) — no MetaMask, no seed phrase. The resulting
// EOA is later upgraded to a Particle Universal Account via EIP-7702.
//
// Magic SDK v33 API:
//   - magic.wallet.connectWithUI() → social login, returns addresses
//   - magic.user.getInfo() → MagicUserMetadata with wallets.ethereum.publicAddress
//   - magic.wallet.sign7702Authorization({ contractAddress, chainId, nonce? })
//   - magic.rpcProvider.request({ method: 'personal_sign', ... }) → EIP-1193 signing
//
// Integration path verified against:
//   - Particle-Network/ua-7702-magic-demo
//   - docs.magic.link/embedded-wallets/wallets/features/eip-7702

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Magic } from "magic-sdk";

type MagicEnv = {
  apiKey: string;
};

function readMagicEnv(): MagicEnv | null {
  const apiKey = process.env.NEXT_PUBLIC_MAGIC_API_KEY ?? "";
  if (!apiKey) return null;
  return { apiKey };
};

type MagicAuthState = {
  magic: Magic | null;
  address: string | null;
  configured: boolean;
  connecting: boolean;
  error: string | null;
  connectWithUI: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signPersonalMessage: (message: string) => Promise<string>;
  sign7702Authorization: (params: {
    contractAddress: string;
    chainId: number;
    nonce?: number;
  }) => Promise<unknown>;
};

const MagicAuthContext = createContext<MagicAuthState | null>(null);

export function MagicAuthProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => readMagicEnv(), []);
  const [magic, setMagic] = useState<Magic | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise the Magic instance on mount (client-only).
  // setState is called inside an async callback, not synchronously in the
  // effect body, so it doesn't trigger the set-state-in-effect lint rule.
  useEffect(() => {
    if (!env) return;
    let instance: Magic;
    const init = async () => {
      instance = new Magic(env.apiKey, {
        network: {
          rpcUrl: "https://arb1.arbitrum.io/rpc",
          chainId: 42161, // Arbitrum One — where EIP-7702 delegation targets
        },
      });
      setMagic(instance);

      // Check if already authenticated from a previous session
      try {
        const loggedIn = await instance.user.isLoggedIn();
        if (loggedIn) {
          const info = await instance.user.getInfo();
          const ethAddress = info.wallets?.ethereum?.publicAddress;
          if (ethAddress) setAddress(ethAddress);
        }
      } catch {
        // ignore
      }
    };
    init();
  }, [env]);

  const connectWithUI = useCallback(async (): Promise<string | null> => {
    if (!magic) {
      setError("Magic not configured. Set NEXT_PUBLIC_MAGIC_API_KEY.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      // connectWithUI shows Magic's social login modal (Google, Apple, etc.)
      const addresses = await magic.wallet.connectWithUI();
      const addr = addresses?.[0] ?? null;
      if (addr) setAddress(addr);
      return addr;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [magic]);

  const disconnect = useCallback(async () => {
    if (!magic) return;
    try {
      await magic.user.logout();
      setAddress(null);
    } catch {
      // ignore
    }
  }, [magic]);

  const signPersonalMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!magic || !address) throw new Error("Magic not initialised.");
      // Use the EIP-1193 rpcProvider for personal_sign
      const sig = await magic.rpcProvider.request({
        method: "personal_sign",
        params: [message, address],
      });
      return sig as string;
    },
    [magic, address],
  );

  const sign7702Authorization = useCallback(
    async (params: { contractAddress: string; chainId: number; nonce?: number }) => {
      if (!magic) throw new Error("Magic not initialised.");
      return magic.wallet.sign7702Authorization(params);
    },
    [magic],
  );

  const value: MagicAuthState = {
    magic,
    address,
    configured: !!env,
    connecting,
    error,
    connectWithUI,
    disconnect,
    signPersonalMessage,
    sign7702Authorization,
  };

  return (
    <MagicAuthContext.Provider value={value}>
      {children}
    </MagicAuthContext.Provider>
  );
}

export function useMagicAuth(): MagicAuthState {
  const ctx = useContext(MagicAuthContext);
  if (!ctx) {
    throw new Error("useMagicAuth must be used within MagicAuthProvider");
  }
  return ctx;
}
