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
//   7. signerToSessionKeyValidator → sessionKeyValidator, scoped by an
//      ERC-7715-style permission policy (see SESSION_KEY_PERMISSIONS)
//   8. createKernelAccount({ sudo: ecdsaValidator, regular: sessionKeyValidator })
//      → the first UserOp through this account enables the session key on-chain
//   9. The session key can then sign future UserOps — but only the
//      allowlisted escrow lifecycle calls, at zero native value, within
//      the validity window. It can never move the account's funds.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { http, createPublicClient, zeroAddress, type Address } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ESCROW_ABI } from "./escrow-abi";
import {
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  ESCROW_CONTRACT_ADDRESS,
  SETTLE_CHAIN_ID,
  SETTLE_RPC,
} from "./constants";

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
  /** Send a gasless UserOp through the session-key Kernel account (batch writes). */
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

// Session-key permission policy (ZeroDev session-key plugin, ERC-7715-style).
// The key may only call these escrow lifecycle functions on the escrow
// contract, with zero native value attached, and expires after 30 days —
// after which a fresh key must be created (and enabled) by the operator.
// This is what makes a localStorage session key an acceptable risk: the
// worst an XSS attacker can do is mark check-ins or claim/cancel existing
// bookings — never drain the account.
const SESSION_KEY_VALIDITY_SECONDS = 30 * 24 * 60 * 60;
const SESSION_KEY_FUNCTION_ALLOWLIST = [
  "confirmCheckIn",
  "claimDeposit",
  "cancelExpired",
] as const;

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
  // Session-key Kernel client — built by createSessionKey and used for
  // gasless batch writes. Stored so the session key survives across calls
  // (the private key is in localStorage; this client is reconstructed on
  // connect if a stored key exists).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessionKeyClient, setSessionKeyClient] = useState<any>(null);
  // True right after createSessionKey, until the enable UserOp has landed.
  // The enable UserOp is validated by the sudo (owner) signature embedded in
  // the account's init code, so it bypasses the session-key permission
  // checks. Once the plugin is enabled, every subsequent session-key UserOp
  // is restricted to the allowlist — so arbitrary liveness transfers must go
  // through the owner client instead (see sendGaslessTx).
  const sessionKeyPendingEnable = useRef(false);

  // The chain follows SETTLE_CHAIN_ID: Arbitrum Sepolia when
  // NEXT_PUBLIC_USE_TESTNET=true, Arbitrum One otherwise. ZeroDev Kernel is
  // ERC-4337, so it runs on either chain.
  const chain =
    SETTLE_CHAIN_ID === ARBITRUM_ONE_CHAIN_ID ? arbitrum : arbitrumSepolia;

  // Initialise Particle Auth on mount
  useEffect(() => {
    if (!env) return;
    let cancelled = false;
    const particleChain =
      SETTLE_CHAIN_ID === ARBITRUM_ONE_CHAIN_ID
        ? { chainName: "arbitrum", chainId: ARBITRUM_ONE_CHAIN_ID }
        : { chainName: "arbitrum-sepolia", chainId: ARBITRUM_SEPOLIA_CHAIN_ID };
    (async () => {
      try {
        const { ParticleNetwork } = await import("@particle-network/auth");
        if (cancelled) return;
        const particle = new ParticleNetwork({
          projectId: env.particleProjectId,
          clientKey: env.particleClientKey,
          appId: env.particleAppId,
          ...particleChain,
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
      setSessionKeyClient(null);
    } catch {
      // ignore
    }
  }, [particleAuth]);

  // Create a real session key: generate a private key, create a session key
  // validator scoped to the escrow allowlist (SESSION_KEY_FUNCTION_ALLOWLIST,
  // zero value, 30-day validity), and build a Kernel account client that uses
  // the session key as a regular validator. The first UserOp through this
  // client enables the session key on-chain. The client is stored in state
  // so subsequent gasless writes (sendGaslessTx) route through it.
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    if (!kernelClient || !env?.zerodevApiKey) {
      setError("Need a connected Kernel account to create a session key.");
      return false;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      setError(
        "Escrow contract not configured (NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS) — cannot scope a session key.",
      );
      return false;
    }
    setError(null);
    try {
      const { signerToSessionKeyValidator, getPermissionFromABI } =
        await import("@zerodev/session-key");
      const {
        createKernelAccount,
        createKernelAccountClient,
        createZeroDevPaymasterClient,
      } = await import("@zerodev/sdk");
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

      // Scoped permission policy: only the allowlisted escrow lifecycle
      // calls, on the escrow contract, at zero native value, expiring after
      // the validity window. The key can never move the account's ETH.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const escrowAbi = ESCROW_ABI as any;
      const sessionKeyValidator = await signerToSessionKeyValidator(
        publicClient,
        {
          signer: sessionKeySigner,
          entryPoint,
          kernelVersion,
          validatorData: {
            permissions: SESSION_KEY_FUNCTION_ALLOWLIST.map((functionName) => ({
              ...getPermissionFromABI({ abi: escrowAbi, functionName }),
              target: ESCROW_CONTRACT_ADDRESS as Address,
              valueLimit: BigInt(0),
            })),
            validUntil:
              Math.floor(Date.now() / 1000) + SESSION_KEY_VALIDITY_SECONDS,
          },
        },
      );

      // Extract the sudo (ECDSA) validator from the existing kernel client
      // so the session-key account inherits the operator's ownership.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ecdsaValidator = (kernelClient.account as any).kernelPluginManager
        ?.sudo;
      if (!ecdsaValidator) {
        throw new Error("Could not extract sudo validator from kernel client.");
      }

      // Build the session-key Kernel account + client (with paymaster). The
      // first UserOp through this client enables the session key on-chain.
      const sessionAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
          regular: sessionKeyValidator,
        },
        entryPoint,
        kernelVersion,
      });

      const rpc = zerodevRpc(env.zerodevApiKey, chain.id);
      const paymasterClient = createZeroDevPaymasterClient({
        chain,
        transport: http(rpc),
      });

      const sessionClient = createKernelAccountClient({
        account: sessionAccount,
        chain,
        bundlerTransport: http(rpc),
        client: publicClient,
        paymaster: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getPaymasterData: (userOperation: any) =>
            paymasterClient.sponsorUserOperation({ userOperation }),
        },
      });

      setSessionKeyClient(sessionClient);
      sessionKeyPendingEnable.current = true;
      setSessionKeyActive(true);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Session key creation failed.",
      );
      return false;
    }
  }, [kernelClient, env, chain]);

  // Send a gasless UserOp. While the session key is pending its on-chain
  // enable, the UserOp routes through the session-key client (the enable
  // UserOp is validated by the owner signature in the init code, so it
  // bypasses the permission allowlist). Once enabled — or when no session
  // key exists — the liveness transfer goes through the owner kernel
  // client, because the scoped session key can only call the allowlisted
  // escrow functions, never send arbitrary transfers.
  const sendGaslessTx = useCallback(async (): Promise<string | null> => {
    const useSessionKey =
      sessionKeyClient !== null && sessionKeyPendingEnable.current;
    const client = useSessionKey ? sessionKeyClient : kernelClient;
    if (!client) {
      setError("Kernel client not initialised.");
      return null;
    }
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = client.account as any;
      const userOpHash = await client.sendUserOperation({
        callData: await account.encodeCalls([
          {
            to: zeroAddress,
            value: BigInt(0),
            data: "0x",
          },
        ]),
      });
      // Wait for the UserOp to be included on-chain
      const receipt = await client.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      if (useSessionKey) sessionKeyPendingEnable.current = false;
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
  }, [kernelClient, sessionKeyClient]);

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
