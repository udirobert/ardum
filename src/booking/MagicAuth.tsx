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
import { SETTLE_CHAIN_ID, SETTLE_RPC } from "./constants";

// Magic's sign7702Authorization response — see
// docs.magic.link/embedded-wallets/wallets/features/eip-7702
export type Magic7702Authorization = {
  contractAddress: string;
  chainId: number;
  nonce: number;
  v: number; // 27 or 28
  r: string;
  s: string;
};

type MagicEnv = {
  apiKey: string;
};

function readMagicEnv(): MagicEnv | null {
  const apiKey = process.env.NEXT_PUBLIC_MAGIC_API_KEY ?? "";
  if (!apiKey) return null;
  return { apiKey };
};

/** Browser hint that this device has completed payment identity before.
 *  Not authority — only avoids identity theater while Magic restores session
 *  and lets grant copy welcome returning bookers (ADR 0008 §6). */
export const PAYMENT_IDENTITY_HINT_KEY = "ardum:payment-identity";

export function rememberPaymentIdentity(address: string): void {
  try {
    localStorage.setItem(PAYMENT_IDENTITY_HINT_KEY, address.toLowerCase());
  } catch {
    // ignore quota / private mode
  }
}

export function hasPaymentIdentityHint(): boolean {
  try {
    return Boolean(localStorage.getItem(PAYMENT_IDENTITY_HINT_KEY));
  } catch {
    return false;
  }
}

/** Local smoke walks only (?smokeRestore=1 on localhost). Never authorization. */
function smokeRestoreAddress(): string | null {
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("smokeRestore") !== "1") {
    return null;
  }
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return null;
  try {
    return localStorage.getItem(PAYMENT_IDENTITY_HINT_KEY);
  } catch {
    return null;
  }
}

type MagicAuthState = {
  magic: Magic | null;
  address: string | null;
  /** False only while Magic session restore is in flight. */
  sessionReady: boolean;
  configured: boolean;
  connecting: boolean;
  error: string | null;
  /** True when this browser has previously completed payment identity. */
  returningPayer: boolean;
  connectWithUI: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signPersonalMessage: (message: string) => Promise<string>;
  sign7702Authorization: (params: {
    contractAddress: string;
    chainId: number;
    nonce?: number;
  }) => Promise<Magic7702Authorization>;
};

const MagicAuthContext = createContext<MagicAuthState | null>(null);

export function MagicAuthProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => readMagicEnv(), []);
  const [magic, setMagic] = useState<Magic | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  // When Magic is not configured, there is no session to restore.
  const [sessionReady, setSessionReady] = useState(!env);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returningPayer, setReturningPayer] = useState(
    () => typeof window !== "undefined" && hasPaymentIdentityHint(),
  );

  // Initialise the Magic instance on mount (client-only).
  // setState is called inside an async callback, not synchronously in the
  // effect body, so it doesn't trigger the set-state-in-effect lint rule.
  useEffect(() => {
    /** Local smoke walks (?smokeRestore=1). Never overrides a live Magic session. */
    const applySmokeRestore = () => {
      const smokeAddr = smokeRestoreAddress();
      if (!smokeAddr) return;
      setAddress((prev) => prev ?? smokeAddr);
      setReturningPayer(true);
    };

    if (!env) {
      queueMicrotask(() => {
        applySmokeRestore();
        setSessionReady(true);
      });
      return;
    }
    let cancelled = false;
    let instance: Magic;
    const init = async () => {
      try {
        instance = new Magic(env.apiKey, {
          network: {
            // Bind Magic to the same chain the UA SDK targets — Arbitrum One
            // in production, Arbitrum Sepolia under NEXT_PUBLIC_USE_TESTNET.
            // The 7702 authorization chainId must match the settle chain or
            // the UA SDK will reject the signature.
            rpcUrl: SETTLE_RPC,
            chainId: SETTLE_CHAIN_ID,
          },
        });
        if (cancelled) return;
        setMagic(instance);

        // Restore durable Magic session so return bookers land on Confirm $X
        // without identity theater (ADR 0008 §6).
        try {
          const loggedIn = await instance.user.isLoggedIn();
          if (loggedIn) {
            const info = await instance.user.getInfo();
            const ethAddress = info.wallets?.ethereum?.publicAddress;
            if (ethAddress && !cancelled) {
              setAddress(ethAddress);
              rememberPaymentIdentity(ethAddress);
              setReturningPayer(true);
            }
          }
        } catch {
          // ignore — surface as needs identity after sessionReady
        }
      } finally {
        if (!cancelled) {
          applySmokeRestore();
          setSessionReady(true);
        }
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
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
      if (addr) {
        setAddress(addr);
        rememberPaymentIdentity(addr);
        setReturningPayer(true);
      }
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
      // Keep payment-identity hint so grant can welcome them back next time.
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
    sessionReady,
    configured: !!env,
    connecting,
    error,
    returningPayer,
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
