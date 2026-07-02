"use client";

// The booking flow component — the core of the UXmaxx hackathon entry.
// Renders on the match detail page when the practitioner clicks "Book this retreat".
//
// Flow:
//   1. Sign in with Google (Magic connectWithUI) → embedded EOA
//   2. Upgrade to Universal Account (EIP-7702 on Arbitrum) → one-time
//   3. Deposit via UA cross-chain transfer → settles on Arbitrum escrow
//   4. Write booking attestation to 0G Storage → closes the loop
//
// Each step shows the user what's happening and why — same "reasoning visible"
// philosophy as the matching flow.

import { useCallback, useEffect, useState } from "react";
import { useMagicAuth } from "./MagicAuth";
import { useUniversalAccount } from "./UniversalAccount";
import { canonicalBookingMessage } from "./canonical";
import {
  USDC_ADDRESS,
  SETTLE_CHAIN_ID,
  ESCROW_CONTRACT_ADDRESS,
  usdToTokenUnits,
  DEFAULT_CHECKIN_WINDOW_HOURS,
} from "./constants";
import type { BookingState, BookingAttestation } from "./types";

type BookingFlowProps = {
  retreatRootHash: string;
  retreatTitle: string;
  depositUsd: number;
  operatorAddress: string;
  onClose: () => void;
};

export default function BookingFlow({
  retreatRootHash,
  retreatTitle,
  depositUsd,
  operatorAddress,
  onClose,
}: BookingFlowProps) {
  const {
    address,
    configured: magicConfigured,
    connectWithUI,
    connecting: authConnecting,
    signPersonalMessage,
  } = useMagicAuth();
  const {
    configured: uaConfigured,
    delegated,
    delegating,
    ensureDelegated,
    fetchBalance,
    balance,
    sendDeposit,
    error: uaError,
  } = useUniversalAccount();

  const [state, setState] = useState<BookingState>({
    step: "idle",
    magicAddress: null,
    uaDelegated: false,
    depositTxId: null,
    bookingRootHash: null,
    error: null,
  });

  // When Magic address appears, advance to delegation step
  useEffect(() => {
    if (address && state.step === "idle") {
      setState((s) => ({
        ...s,
        step: "delegating",
        magicAddress: address,
      }));
    }
  }, [address, state.step]);

  // When delegation completes, advance to deposit step
  useEffect(() => {
    if (delegated && state.step === "delegating") {
      setState((s) => ({ ...s, step: "depositing", uaDelegated: true }));
      fetchBalance();
    }
  }, [delegated, state.step, fetchBalance]);

  // Auto-trigger delegation when we reach that step
  useEffect(() => {
    if (state.step === "delegating" && !delegated && !delegating) {
      ensureDelegated();
    }
  }, [state.step, delegated, delegating, ensureDelegated]);

  const handleDeposit = useCallback(async () => {
    if (!address) return;
    setState((s) => ({ ...s, step: "depositing", error: null }));

    // If no escrow contract deployed, send directly to operator
    // (simplified flow for demo without deployed contract)
    const receiver = ESCROW_CONTRACT_ADDRESS || operatorAddress;
    const amount = usdToTokenUnits(depositUsd);

    const result = await sendDeposit({
      receiver,
      amount,
      tokenAddress: USDC_ADDRESS,
      tokenChainId: SETTLE_CHAIN_ID,
    });

    if (!result) {
      setState((s) => ({
        ...s,
        step: "error",
        error: uaError ?? "Deposit failed.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      step: "attesting",
      depositTxId: result.transactionId,
    }));

    // Write the booking attestation to 0G Storage
    try {
      const bookingRootHash = `booking-${retreatRootHash.slice(0, 16)}-${Date.now().toString(36)}`;
      const booking: BookingAttestation = {
        rootHash: bookingRootHash,
        kind: "booking",
        title: `Booking: ${retreatTitle}`,
        description: `Deposit of $${depositUsd} for ${retreatTitle}`,
        claims: {
          retreatRootHash,
          practitionerAddress: address,
          operatorAddress,
          depositUsd,
          depositToken: "USDC",
          depositChainId: SETTLE_CHAIN_ID,
          settleChainId: SETTLE_CHAIN_ID,
          depositTxId: result.transactionId,
          escrowAddress: ESCROW_CONTRACT_ADDRESS || undefined,
          status: "deposit-confirmed",
          bookedAt: new Date().toISOString(),
          checkInWindowHours: DEFAULT_CHECKIN_WINDOW_HOURS,
        },
        attestor: address,
        createdAt: new Date().toISOString(),
      };

      // Sign the booking attestation with Magic (personal_sign via EIP-1193)
      const message = canonicalBookingMessage(booking);
      const signature = await signPersonalMessage(message);

      // Post to the booking API
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ booking, signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Booking attestation failed.");

      setState((s) => ({
        ...s,
        step: "done",
        bookingRootHash: json.rootHash ?? bookingRootHash,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        step: "error",
        error: err instanceof Error ? err.message : "Booking attestation failed.",
      }));
    }
  }, [
    address,
    depositUsd,
    operatorAddress,
    retreatRootHash,
    retreatTitle,
    sendDeposit,
    uaError,
    signPersonalMessage,
  ]);

  const error = state.error ?? uaError;

  // ── Render ──────────────────────────────────────────────────────────

  if (state.step === "done") {
    return (
      <div className="border border-[color:var(--accent-soft)] bg-[color:var(--surface)] rounded-sm p-8 fade-in-up surface-card">
        <p className="tag mb-1">booked</p>
        <h3 className="font-serif text-3xl tracking-tight mb-3">{retreatTitle}</h3>
        <p className="why mb-4">
          Your deposit of ${depositUsd.toLocaleString()} settled on Arbitrum.
          The booking is attested on 0G Storage.
        </p>
        {state.depositTxId && (
          <p className="tag break-all mb-2">
            UA transaction: {state.depositTxId}
          </p>
        )}
        {state.bookingRootHash && (
          <p className="tag break-all opacity-80">
            0G root hash: {state.bookingRootHash}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  if (state.step === "error") {
    return (
      <div className="border border-[color:var(--accent-ink)] bg-[color:var(--surface)] rounded-sm p-8 fade-in-up surface-card">
        <p className="tag mb-1 text-[color:var(--accent-ink)]">booking failed</p>
        <h3 className="font-serif text-2xl tracking-tight mb-3">
          Something went wrong.
        </h3>
        <p className="text-sm text-[color:var(--accent-ink)] mb-4">{error}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setState({ ...state, step: "idle", error: null })}
            className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Active flow — show step-by-step progress
  const steps = [
    { key: "auth", label: "Sign in", done: !!address },
    { key: "delegate", label: "Upgrade account", done: delegated },
    { key: "deposit", label: "Deposit", done: !!state.depositTxId },
    { key: "attest", label: "Attest on 0G", done: false },
  ];

  const currentStepIndex =
    state.step === "idle"
      ? 0
      : state.step === "delegating"
        ? 1
        : state.step === "depositing"
          ? 2
          : state.step === "attesting"
            ? 3
            : 4;

  return (
    <div className="border border-[color:var(--hairline)] bg-[color:var(--surface)] rounded-sm p-8 fade-in-up surface-card">
      <div className="flex items-baseline justify-between mb-6">
        <h3 className="font-serif text-2xl tracking-tight">Book this retreat</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[color:var(--muted)] hover:text-foreground transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      <p className="text-sm text-[color:var(--muted)] mb-6">
        {retreatTitle} · ${depositUsd.toLocaleString()} deposit · settles on Arbitrum
      </p>

      {/* Progress steps */}
      <div className="flex gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                s.done
                  ? "bg-[color:var(--accent)] text-background"
                  : i === currentStepIndex
                    ? "border border-[color:var(--accent)] text-[color:var(--accent)]"
                    : "border border-[color:var(--hairline)] text-[color:var(--muted)]"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span
              className={`text-xs ${
                s.done
                  ? "text-foreground"
                  : i === currentStepIndex
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--muted)]"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-[color:var(--hairline)] mx-1">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {!address && (
        <div>
          <p className="why mb-4">
            Sign in with Google to create your wallet. No seed phrase, no
            browser extension — just your Google account.
          </p>
          {!magicConfigured && (
            <p className="text-xs text-[color:var(--muted)] mb-3">
              Demo mode: Magic env vars not set. Configure{" "}
              <code className="tag">NEXT_PUBLIC_MAGIC_API_KEY</code> to enable
              social login.
            </p>
          )}
          <button
            type="button"
            onClick={connectWithUI}
            disabled={!magicConfigured || authConnecting}
            className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            {authConnecting ? "Connecting…" : "Sign in with Google"}
          </button>
        </div>
      )}

      {address && state.step === "delegating" && (
        <div>
          <p className="why mb-4">
            Upgrading your account to a Universal Account via EIP-7702. This
            lets you pay with any token on any chain — one balance, no
            bridging. This is a one-time operation.
          </p>
          {!uaConfigured && (
            <p className="text-xs text-[color:var(--muted)] mb-3">
              Demo mode: Particle env vars not set. Configure{" "}
              <code className="tag">NEXT_PUBLIC_PARTICLE_PROJECT_ID</code> to
              enable Universal Accounts.
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
            <span className="tag">
              {delegating ? "Delegating on Arbitrum…" : "Preparing…"}
            </span>
          </div>
        </div>
      )}

      {address && delegated && state.step === "depositing" && (
        <div>
          <p className="why mb-4">
            Your Universal Account is ready. Deposit ${depositUsd.toLocaleString()}{" "}
            — the UA routes from any chain, any token, and settles on Arbitrum.
          </p>
          {balance && (
            <p className="tag mb-4">
              Unified balance: ${balance.totalUsd.toLocaleString()} across chains
            </p>
          )}
          <button
            type="button"
            onClick={handleDeposit}
            disabled={!uaConfigured}
            className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            Deposit ${depositUsd.toLocaleString()} →
          </button>
        </div>
      )}

      {state.step === "attesting" && (
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
            <span className="tag">Writing booking attestation to 0G Storage…</span>
          </div>
        </div>
      )}

      {address && (
        <p className="tag mt-6 opacity-70">
          wallet: {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      )}
    </div>
  );
}
