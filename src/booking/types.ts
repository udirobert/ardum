// Booking layer types — extends the attestation schema with booking and
// class-access kinds. These are additive: the existing "retreat" attestation
// kind and matching flow are untouched.

import type { AttestationKind } from "@/attestation/schema";

// Extend the attestation kind union without modifying the original schema
// file. The booking attestation is written to 0G Storage after a successful
// deposit, closing the loop back to the 0G layer.
export type BookingAttestationKind = AttestationKind | "booking" | "class-access";

export type BookingStatus =
  | "deposit-pending" // UA cross-chain transfer in flight
  | "deposit-confirmed" // transfer settled on Arbitrum, attestation written
  | "checked-in" // operator confirmed arrival
  | "completed" // retreat ended, deposit released to operator
  | "refunded" // cancelled within window, deposit returned
  | "failed"; // transfer failed or timed out

export type BookingAttestation = {
  rootHash: string;
  kind: "booking";
  title: string;
  description: string;
  claims: {
    retreatRootHash: string; // links back to the matched retreat attestation
    practitionerAddress: string; // Magic EOA (upgraded to UA via EIP-7702)
    operatorAddress: string; // retreat operator's address
    depositUsd: number;
    depositToken: string; // e.g. "USDC"
    depositChainId: number; // source chain (UA routes from here)
    settleChainId: number; // always Arbitrum for this hackathon
    depositTxId?: string; // UA transaction ID
    escrowAddress?: string; // Arbitrum escrow contract address
    status: BookingStatus;
    bookedAt: string;
    checkInWindowHours: number; // refund window before check-in
  };
  attestor: string; // practitioner's UA address
  createdAt: string;
};

export type ClassAccessAttestation = {
  rootHash: string;
  kind: "class-access";
  title: string;
  description: string;
  claims: {
    retreatRootHash: string;
    practitionerAddress: string;
    classPriceUsd: number;
    paymentTxHash?: string;
    accessGrantedAt: string;
  };
  attestor: string;
  createdAt: string;
};

// Commitment surface state (grant ceremony — not multi-phase rail steps).
// Internal provider hops are ambient under "securing".
export type BookingState = {
  step: "idle" | "grant" | "securing" | "done" | "error";
  magicAddress: string | null;
  uaDelegated: boolean;
  depositTxId: string | null;
  bookingRootHash: string | null;
  error: string | null;
};

// Particle UA unified balance display
export type UnifiedBalance = {
  totalUsd: number;
  tokens: Array<{
    chainId: number;
    chainName: string;
    symbol: string;
    amount: string;
    usdValue: number;
  }>;
};
