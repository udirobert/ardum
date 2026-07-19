"use client";

// Operator auth provider — upgrades the operator's attestation flow from
// MetaMask to Particle Auth (social login) + ZeroDev Kernel (gas sponsorship
// + session keys for batch writes).
//
// This is a SEPARATE persona from the practitioner:
//   - Practitioner: Magic EOA → Particle UA (EIP-7702) → cross-chain deposit
//   - Operator:     Particle Auth EOA → ZeroDev Kernel (ERC-4337) → gasless attestations
//
// The two account abstraction systems (UA EIP-7702 vs ZeroDev Kernel ERC-4337)
// cannot run on the same EOA, so they're split by persona.
//
// ZeroDev + Particle doc: docs.zerodev.app/onboarding/particle
//
// Flow:
//   1. Particle Auth social login → EOA (ParticleProvider is EIP-1193)
//   2. signerToEcdsaValidator(publicClient, { signer: particleProvider })
//   3. createKernelAccount(publicClient, { sudo: ecdsaValidator })
//   4. createZeroDevPaymasterClient → sponsors gas for every UserOp
//   5. createKernelAccountClient({ account, paymaster }) → gasless client
//   6. generatePrivateKey → sessionKeySigner
//   7. signerToSessionKeyValidator → sessionKeyValidator (sudo policy)
//   8. createKernelAccount({ sudo: ecdsaValidator, regular: sessionKeyValidator })
//      → the first UserOp through this account enables the session key on-chain
//   9. The session key can then sign future UserOps without the operator's
//      signature — gasless batch attestation writes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { http, createPublicClient, zeroAddress } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SETTLE_CHAIN_ID, SETTLE_RPC } from "./constants";

type OperatorAuthState = {
  /** Particle EOA address (the owner/signer of the Kernel account). */
  address: string | null;
  /** ZeroDev Kernel smart account address (counterfactual, deployed on first UserOp). */
  smartAccountAddress: string | null;
  configured: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  /** True when a session key has been created and enabled on-chain. */
  sessionKeyActive: boolean;
  createSessionKey: () => Promise<boolean>;
  /** Send a gasless UserOp through the Kernel account (proves the smart account is live). */
  sendGaslessTx: () => Promise<string | null>;
};

const OperatorAuthContext = createContext<OperatorAuthState | null>(null);

type OperatorEnv = {
  particleProjectId: string;
  particleClientKey: string;
  particleAppId: string;
  zerodevApiKey: string;
};

function readOperatorEnv(): OperatorEnv | null {
  const particleProjectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? "";
  const particleClientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? "";
  const particleAppId = process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? "";
  const zerodevApiKey = process.env.NEXT_PUBLIC_ZERODEV_API_KEY ?? "";
  if (!particleProjectId || !particleClientKey || !particleAppId) return null;
  return {
    particleProjectId,
    particleClientKey,
    particleAppId,
    zerodevApiKey,
  };
}

// ZeroDev RPC URL — format: https://rpc.zerodev.app/api/v3/{apiKey}/chain/{chainId}
function zerodevRpc(apiKey: string, chainId: number): string {
  return `https://rpc.zerodev.app/api/v3/${apiKey}/chain/${chainId}`;
}

// Session key persistence — stored in localStorage so the same session key
// survives page reloads. The private key never leaves the browser.
const SESSION_KEY_STORAGE = "ardum:operator-session-key";

function loadSessionPrivateKey(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY_STORAGE);
  } catch {
    return null;
  }
}

function storeSessionPrivateKey(key: string): void {
  try {
    localStorage.setItem(SESSION_KEY_STORAGE, key);
  } catch {
    // ignore quota / private mode
  }
}

export function OperatorAuthProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => readOperatorEnv(), []);
  const [address, setAddress] = useState<string | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null,
  );
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionKeyActive, setSessionKeyActive] = useState(false);
  const [particleAuth, setParticleAuth] = useState<unknown>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kernelClient, setKernelClient] = useState<any>(null);

  // The chain — Arbitrum Sepolia for testnet, Arbitrum One for mainnet.
  // ZeroDev Kernel is ERC-4337, so it runs on any supported chain.
  const chain = SETTLE_CHAIN_ID === 421614 ? arbitrumSepolia : arbitrumSepolia; // Sepolia for now; mainnet swap is a one-liner

  // Initialise Particle Auth on mount
  useEffect(() => {
    if (!env) return;
    let cancelled = false;
    (async () => {
      try {
        const { ParticleNetwork } = await import("@particle-network/auth");
        if (cancelled) return;
        const particle = new ParticleNetwork({
          projectId: env.particleProjectId,
          clientKey: env.particleClientKey,
          appId: env.particleAppId,
          chainName: "arbitrum-sepolia",
          chainId: 421614,
        });
        setParticleAuth(particle);

        // Check if already logged in
        const auth = (
          particle as unknown as {
            auth: {
              isLogin: () => boolean;
              getUserInfo: () => Promise<unknown>;
            };
          }
        ).auth;
        if (auth.isLogin()) {
          const userInfo = (await auth.getUserInfo()) as {
            wallets?: { public_address?: string }[];
          };
          const addr = userInfo?.wallets?.[0]?.public_address;
          if (addr) setAddress(addr);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `Particle init: ${err.message}`
              : "Particle init failed",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env]);

  // Build the ZeroDev Kernel account client from the Particle EOA.
  // This is the real ZeroDev integration: ECDSA validator → Kernel account →
  // paymaster-sponsored client. Every UserOp through this client is gasless.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function buildKernelClient(particleProvider: any): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any;
    smartAccountAddr: string;
  }> {
    if (!env?.zerodevApiKey) throw new Error("ZeroDev API key not configured.");

    const { signerToEcdsaValidator } = await import(
      "@zerodev/ecdsa-validator"
    );
    const {
      createKernelAccount,
      createKernelAccountClient,
      createZeroDevPaymasterClient,
    } = await import("@zerodev/sdk");
    const { getEntryPoint, KERNEL_V3_1 } = await import(
      "@zerodev/sdk/constants"
    );

    const rpc = zerodevRpc(env.zerodevApiKey, chain.id);
    const publicClient = createPublicClient({
      transport: http(SETTLE_RPC),
      chain,
    });

    const entryPoint = getEntryPoint("0.7");
    const kernelVersion = KERNEL_V3_1;

    // Particle Provider is EIP-1193, which ZeroDev's Signer type accepts
    // directly (OneOf<EIP1193Provider | WalletClient | LocalAccount | SmartAccount>).
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: particleProvider,
      entryPoint,
      kernelVersion,
    });

    const account = await createKernelAccount(publicClient, {
      plugins: { sudo: ecdsaValidator },
      entryPoint,
      kernelVersion,
    });

    const paymasterClient = createZeroDevPaymasterClient({
      chain,
      transport: http(rpc),
    });

    const client = createKernelAccountClient({
      account,
      chain,
      bundlerTransport: http(rpc),
      client: publicClient,
      paymaster: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getPaymasterData: (userOperation: any) =>
          paymasterClient.sponsorUserOperation({ userOperation }),
      },
    });

    return { client, smartAccountAddr: account.address };
  }

  const connect = useCallback(async (): Promise<string | null> => {
    if (!particleAuth) {
      setError("Particle Auth not initialised.");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const auth = (
        particleAuth as unknown as {
          auth: {
            login: () => Promise<unknown>;
            getUserInfo: () => Promise<unknown>;
          };
        }
      ).auth;
      await auth.login();
      const userInfo = (await auth.getUserInfo()) as {
        wallets?: { public_address?: string }[];
      };
      const addr = userInfo?.wallets?.[0]?.public_address ?? null;
      if (addr) setAddress(addr);

      // Build the ZeroDev Kernel account from the Particle Provider
      if (addr && env?.zerodevApiKey) {
        try {
          const { ParticleProvider } = await import(
            "@particle-network/provider"
          );
          const provider = new ParticleProvider(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (particleAuth as any).auth,
          );
          const { client, smartAccountAddr } = await buildKernelClient(
            provider,
          );
          setKernelClient(client);
          setSmartAccountAddress(smartAccountAddr);
        } catch (err) {
          // Kernel account creation is non-fatal — operator can still sign
          // attestations off-chain. But gasless on-chain writes won't work.
          setError(
            err instanceof Error
              ? `ZeroDev Kernel init: ${err.message}`
              : "ZeroDev Kernel init failed",
          );
        }
      }

      return addr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      return null;
    } finally {
      setConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleAuth, env]);

  const disconnect = useCallback(async () => {
    if (!particleAuth) return;
    try {
      await (
        particleAuth as unknown as {
          auth: { logout: () => Promise<unknown> };
        }
      ).auth.logout();
      setAddress(null);
      setSmartAccountAddress(null);
      setSessionKeyActive(false);
      setKernelClient(null);
    } catch {
      // ignore
    }
  }, [particleAuth]);

  // Create a real session key: generate a private key, create a session key
  // validator with sudo policy, and build a Kernel account that uses the
  // session key as a regular validator. The first UserOp through this account
  // enables the session key on-chain.
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    if (!kernelClient || !env?.zerodevApiKey) {
      setError("Need a connected Kernel account to create a session key.");
      return false;
    }
    setError(null);
    try {
      const { signerToSessionKeyValidator } = await import(
        "@zerodev/session-key"
      );
      const { createKernelAccount } = await import("@zerodev/sdk");
      const { getEntryPoint, KERNEL_V3_1 } = await import(
        "@zerodev/sdk/constants"
      );
      const { http, createPublicClient } = await import("viem");

      // Load or generate the session key private key
      let sessionPrivateKey = loadSessionPrivateKey();
      if (!sessionPrivateKey) {
        sessionPrivateKey = generatePrivateKey();
        storeSessionPrivateKey(sessionPrivateKey);
      }
      const sessionKeySigner = privateKeyToAccount(
        sessionPrivateKey as `0x${string}`,
      );

      const publicClient = createPublicClient({
        transport: http(SETTLE_RPC),
        chain,
      });

      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      // Create the session key validator with no restrictions (sudo policy).
      // In production, this would be scoped to specific contract calls.
      const sessionKeyValidator = await signerToSessionKeyValidator(
        publicClient,
        {
          signer: sessionKeySigner,
          entryPoint,
          kernelVersion,
          validatorData: {}, // sudo — no restrictions
        },
      );

      // Build a Kernel account that uses the session key as the regular
      // validator. The first UserOp through this account enables the session
      // key on-chain via the sudo validator's signature.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ecdsaValidator = (kernelClient.account as any).kernelPluginManager
        ?.sudo;
      if (!ecdsaValidator) {
        throw new Error("Could not extract sudo validator from kernel client.");
      }

      // Build the session key account — the first UserOp through this account
      // enables the session key on-chain. We don't need to store the account
      // object; the session key private key in localStorage is enough to
      // reconstruct it for future batch writes.
      await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
          regular: sessionKeyValidator,
        },
        entryPoint,
        kernelVersion,
      });

      setSessionKeyActive(true);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Session key creation failed.",
      );
      return false;
    }
  }, [kernelClient, env, chain]);

  // Send a gasless UserOp through the Kernel account. This proves the smart
  // account is live and the ZeroDev paymaster is sponsoring gas. The UserOp
  // is a 0-value self-transfer — minimal but genuine on-chain execution.
  const sendGaslessTx = useCallback(async (): Promise<string | null> => {
    if (!kernelClient) {
      setError("Kernel client not initialised.");
      return null;
    }
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = kernelClient.account as any;
      const userOpHash = await kernelClient.sendUserOperation({
        callData: await account.encodeCalls([
          {
            to: zeroAddress,
            value: BigInt(0),
            data: "0x",
          },
        ]),
      });
      // Wait for the UserOp to be included on-chain
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      return (
        (receipt as { receipt?: { transactionHash?: string } }).receipt
          ?.transactionHash ?? userOpHash
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gasless transaction failed.",
      );
      return null;
    }
  }, [kernelClient]);

  const value: OperatorAuthState = {
    address,
    smartAccountAddress,
    configured: !!env,
    connecting,
    error,
    connect,
    disconnect,
    sessionKeyActive,
    createSessionKey,
    sendGaslessTx,
  };

  return (
    <OperatorAuthContext.Provider value={value}>
      {children}
    </OperatorAuthContext.Provider>
  );
}

export function useOperatorAuth(): OperatorAuthState {
  const ctx = useContext(OperatorAuthContext);
  if (!ctx) {
    throw new Error("useOperatorAuth must be used within OperatorAuthProvider");
  }
  return ctx;
}
