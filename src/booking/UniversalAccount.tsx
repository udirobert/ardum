"use client";

// Particle Universal Account provider. Takes the Magic EOA and upgrades it
// via EIP-7702 to a chain-abstracted account — one balance across chains,
// cross-chain transfers without manual bridging.
//
// Flow (verified against Particle-Network/ua-7702-magic-demo and the
// Particle EIP-7702 wallets reference at
// developers.particle.network/universal-accounts/ua-reference/web/eip7702-wallets):
//   1. Construct UniversalAccount with Magic EOA as ownerAddress (useEIP7702)
//   2. createTransferTransaction() → builds the cross-chain deposit tx;
//      each userOp carries eip7702Auth { address, chainId, nonce } when the
//      EOA is not yet delegated on that chain.
//   3. For every userOp needing delegation, sign the 7702 authorization with
//      Magic's wallet.sign7702Authorization and serialize {v,r,s} → hex.
//   4. Sign the transaction rootHash with Magic (personal_sign).
//   5. sendTransaction(tx, rootHashSignature, authorizations) — the SDK
//      submits the Type-4 tx carrying the authorizationList and the cross-
//      chain value move in one broadcast. Settlement lands on Arbitrum.
//
// ensureDelegated() is a read-only status check (getEIP7702Deployments) so
// the grant ceremony can show "Preparing your account…" only on the first
// deposit. The actual delegation is performed inline by sendDeposit.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Signature } from "ethers";
import { useMagicAuth, type Magic7702Authorization } from "./MagicAuth";
import { SETTLE_CHAIN_ID } from "./constants";
import type {
  EIP7702Authorization,
  ITransaction,
  IAssetsResponse,
  UniversalAccount as UniversalAccountType,
} from "@particle-network/universal-account-sdk";
import type { UnifiedBalance } from "./types";

type ParticleEnv = {
  projectId: string;
  clientKey: string;
  appId: string;
};

function readParticleEnv(): ParticleEnv | null {
  const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? "";
  const clientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? "";
  const appId = process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? "";
  if (!projectId || !clientKey || !appId) return null;
  return { projectId, clientKey, appId };
}

type UniversalAccountState = {
  configured: boolean;
  delegated: boolean;
  delegating: boolean;
  balance: UnifiedBalance | null;
  error: string | null;
  ensureDelegated: () => Promise<boolean>;
  fetchBalance: () => Promise<void>;
  sendDeposit: (params: {
    receiver: string;
    amount: string;
    tokenAddress: string;
    tokenChainId: number;
  }) => Promise<{ transactionId: string } | null>;
};

const UAContext = createContext<UniversalAccountState | null>(null);

export function UniversalAccountProvider({ children }: { children: ReactNode }) {
  const { address: magicAddress, sign7702Authorization, signPersonalMessage } =
    useMagicAuth();
  const env = useMemo(() => readParticleEnv(), []);

  const [uaInstance, setUaInstance] =
    useState<UniversalAccountType | null>(null);
  const [delegated, setDelegated] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [balance, setBalance] = useState<UnifiedBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialise the Universal Account when we have a Magic EOA + Particle env
  useEffect(() => {
    if (!env || !magicAddress) return;

    let cancelled = false;
    (async () => {
      try {
        const { UniversalAccount } = await import(
          "@particle-network/universal-account-sdk"
        );
        if (cancelled) return;

        const ua = new UniversalAccount({
          projectId: env.projectId,
          projectClientKey: env.clientKey,
          projectAppUuid: env.appId,
          ownerAddress: magicAddress,
          smartAccountOptions: {
            useEIP7702: true,
            name: "UNIVERSAL",
            version: "v1",
            ownerAddress: magicAddress,
          },
        });

        setUaInstance(ua);

        // Read current delegation status so the grant ceremony can skip the
        // "Preparing your account…" beat for returning practitioners.
        try {
          const deployments = await ua.getEIP7702Deployments();
          if (deployments && !cancelled) {
            const isDelegated = Array.isArray(deployments) &&
              deployments.some(
                (d: { chainId?: number }) => d.chainId === SETTLE_CHAIN_ID,
              );
            if (isDelegated) setDelegated(true);
          }
        } catch {
          // Not yet delegated — sendDeposit will handle it inline.
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `UA init failed: ${err.message}`
              : "UA init failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [env, magicAddress]);

  // Read-only delegation probe. The actual Type-4 delegation is performed
  // inline by sendDeposit on the first cross-chain transfer.
  const ensureDelegated = useCallback(async (): Promise<boolean> => {
    if (!uaInstance) {
      setError("Universal Account not initialised.");
      return false;
    }
    if (delegated) return true;

    setDelegating(true);
    setError(null);
    try {
      const deployments = await uaInstance.getEIP7702Deployments();
      const alreadyDelegated = Array.isArray(deployments) &&
        deployments.some(
          (d: { chainId?: number }) => d.chainId === SETTLE_CHAIN_ID,
        );
      if (alreadyDelegated) {
        setDelegated(true);
        return true;
      }
      // Not yet delegated — that's fine. sendDeposit will sign and submit the
      // 7702 authorization inline with the first transaction.
      return false;
    } catch (err) {
      setError(
        err instanceof Error
          ? `Delegation check failed: ${err.message}`
          : "Delegation check failed.",
      );
      return false;
    } finally {
      setDelegating(false);
    }
  }, [uaInstance, delegated]);

  const fetchBalance = useCallback(async () => {
    if (!uaInstance) return;
    try {
      const result: IAssetsResponse = await uaInstance.getPrimaryAssets();
      setBalance({
        totalUsd: result?.totalAmountInUSD ?? 0,
        tokens: [],
      });
    } catch {
      // Balance fetch is non-critical
    }
  }, [uaInstance]);

  // Serialize Magic's {v, r, s} 7702 authorization into the hex signature
  // the Particle SDK expects in EIP7702Authorization.signature.
  function serialize7702Signature(auth: Magic7702Authorization): string {
    // ethers Signature.from accepts v as 27/28 (raw parity) — exactly what
    // Magic returns. .serialized yields the r||s||v hex string.
    return Signature.from({
      r: auth.r,
      s: auth.s,
      v: auth.v,
    }).serialized;
  }

  const sendDeposit = useCallback(
    async (params: {
      receiver: string;
      amount: string;
      tokenAddress: string;
      tokenChainId: number;
    }): Promise<{ transactionId: string } | null> => {
      if (!uaInstance) {
        setError("Universal Account not initialised.");
        return null;
      }

      setError(null);
      try {
        // 1. Build the cross-chain transfer transaction. The SDK populates
        //    userOps[i].eip7702Auth on any chain where the EOA is not yet
        //    delegated, and eip7702Delegated=false on those userOps.
        const tx: ITransaction = await uaInstance.createTransferTransaction({
          token: {
            chainId: params.tokenChainId,
            address: params.tokenAddress,
          },
          amount: params.amount,
          receiver: params.receiver,
        });

        // 2. Sign the 7702 authorization for every userOp that needs it.
        //    This is the Type-4 authorizationList — it upgrades the EOA in
        //    place as part of the same broadcast that moves the deposit.
        const authorizations: EIP7702Authorization[] = [];
        for (const userOp of tx.userOps ?? []) {
          if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
            const magicAuth = await sign7702Authorization({
              contractAddress: userOp.eip7702Auth.address,
              chainId: userOp.eip7702Auth.chainId,
              nonce: userOp.eip7702Auth.nonce,
            });
            authorizations.push({
              userOpHash: userOp.userOpHash,
              signature: serialize7702Signature(magicAuth),
            });
          }
        }

        // 3. Sign the transaction rootHash with Magic (personal_sign via
        //    EIP-1193). This is the owner signature over the whole bundle.
        const { getBytes, hexlify } = await import("ethers");
        const rootSignature = await signPersonalMessage(
          hexlify(getBytes(tx.rootHash)),
        );

        // 4. Broadcast. The SDK submits the Type-4 tx (with the 7702
        //    authorizationList) and the cross-chain value move together.
        const result = await uaInstance.sendTransaction(
          tx,
          rootSignature,
          authorizations.length > 0 ? authorizations : undefined,
        );

        // The first successful send with authorizations completes the
        // delegation; subsequent txs on this chain won't need them.
        if (authorizations.length > 0) setDelegated(true);

        return { transactionId: result.transactionId };
      } catch (err) {
        setError(
          err instanceof Error
            ? `Deposit failed: ${err.message}`
            : "Deposit failed.",
        );
        return null;
      }
    },
    [uaInstance, sign7702Authorization, signPersonalMessage],
  );

  const value: UniversalAccountState = {
    configured: !!env,
    delegated,
    delegating,
    balance,
    error,
    ensureDelegated,
    fetchBalance,
    sendDeposit,
  };

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
}

export function useUniversalAccount(): UniversalAccountState {
  const ctx = useContext(UAContext);
  if (!ctx) {
    throw new Error(
      "useUniversalAccount must be used within UniversalAccountProvider",
    );
  }
  return ctx;
}
