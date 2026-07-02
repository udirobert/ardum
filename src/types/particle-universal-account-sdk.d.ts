// Type declaration shim for @particle-network/universal-account-sdk.
// The SDK ships .d.ts files but its package.json "exports" field doesn't
// expose them to TypeScript's module resolution. This shim lets tsc resolve
// the module with a minimal typed surface.

declare module "@particle-network/universal-account-sdk" {
  export const CHAIN_ID: Record<string, number>;

  export interface UniversalAccountConfig {
    projectId: string;
    projectClientKey: string;
    projectAppUuid: string;
    ownerAddress: string;
    smartAccountOptions?: {
      useEIP7702?: boolean;
      name?: string;
      version?: string;
      ownerAddress?: string;
    };
    tradeConfig?: {
      slippageBps?: number;
    };
  }

  export class UniversalAccount {
    constructor(config: UniversalAccountConfig);

    getEIP7702Deployments(): Promise<Array<{ chainId: number; address: string }>>;
    getEIP7702Auth(chainIds: number[]): Promise<
      Array<{ address: string; chainId: number; nonce: number }>
    >;

    getPrimaryAssets(): Promise<{
      totalAmountInUSD: number;
      primaryAssets?: Array<unknown>;
    }>;

    createTransferTransaction(params: {
      token: { chainId: number; address: string };
      amount: string;
      receiver: string;
    }): Promise<{ rootHash: string; [key: string]: unknown }>;

    sendTransaction(
      tx: unknown,
      signature: string,
    ): Promise<{ transactionId: string; [key: string]: unknown }>;
  }
}
