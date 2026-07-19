// Type declaration shim for @particle-network/universal-account-sdk.
// The SDK ships .d.ts files but its package.json "exports" field doesn't
// expose them to TypeScript's module resolution. This shim lets tsc resolve
// the module with the typed surface we actually use.

declare module "@particle-network/universal-account-sdk" {
  export const CHAIN_ID: Record<string, number>;

  export interface ISmartAccountOptions {
    useEIP7702?: boolean;
    name?: string;
    version?: string;
    ownerAddress?: string;
  }

  export interface IUniversalAccountConfig {
    projectId: string;
    projectClientKey: string;
    projectAppUuid: string;
    ownerAddress: string;
    smartAccountOptions?: ISmartAccountOptions;
    tradeConfig?: {
      slippageBps?: number;
    };
  }

  export interface IToken {
    chainId: number;
    address: string;
  }

  export interface ITransferTransaction {
    token: IToken;
    amount: string;
    receiver: string;
  }

  // Per-userOp 7702 authorization payload returned by the embedded wallet
  // and consumed by sendTransaction's authorizations argument.
  export interface EIP7702Authorization {
    userOpHash: string;
    signature: string;
  }

  export interface IUserOpEIP7702Auth {
    chainId: number;
    nonce: number;
    address: string;
  }

  export interface IUserOpWithChain {
    chainId: number;
    userOpHash: string;
    eip7702Auth?: IUserOpEIP7702Auth;
    eip7702Delegated?: boolean;
    [key: string]: unknown;
  }

  export interface ITransaction {
    rootHash: string;
    userOps: IUserOpWithChain[];
    transactionId: string;
    [key: string]: unknown;
  }

  export interface IAssetsResponse {
    totalAmountInUSD: number;
    primaryAssets?: Array<unknown>;
  }

  export class UniversalAccount {
    constructor(config: IUniversalAccountConfig);
    getPrimaryAssets(): Promise<IAssetsResponse>;
    createTransferTransaction(payload: ITransferTransaction): Promise<ITransaction>;
    sendTransaction(
      transaction: ITransaction,
      signature: string,
      authorizations?: EIP7702Authorization[],
    ): Promise<{ transactionId: string; [key: string]: unknown }>;
    getEIP7702Deployments(): Promise<
      Array<{ chainId: number; address: string }>
    >;
    getEIP7702Auth(chainIds: number[]): Promise<
      Array<{ address: string; chainId: number; nonce: number }>
    >;
    getTransaction(transactionId: string): Promise<unknown>;
  }

  export class UniversalError extends Error {
    readonly code: number;
    readonly data?: unknown;
  }
}
