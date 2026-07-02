"use client";

// Drop-in class payment via Openfort + x402.
//
// Flow (verified against openfort.io/docs/recipes/x402):
//   1. Practitioner requests class access → server returns 402 Payment Required
//   2. Openfort embedded wallet signs USDC TransferWithAuthorization (EIP-3009)
//   3. Client retries with payment signature in headers
//   4. Server verifies + facilitator settles on-chain → 200 OK
//   5. Class access written as "class-access" attestation to 0G Storage
//
// This is lighter than a full retreat booking — pay per session, not a deposit.

import { useCallback, useState } from "react";
import { useMagicAuth } from "./MagicAuth";
import { SETTLE_CHAIN_ID, USDC_ADDRESS } from "./constants";
import type { ClassAccessAttestation } from "./types";

type ClassPaymentProps = {
  retreatRootHash: string;
  retreatTitle: string;
  classPriceUsd: number;
  onClose: () => void;
};

type PaymentState =
  | "idle"
  | "requesting" // requesting class access (expect 402)
  | "signing" // signing payment authorization
  | "paying" // retrying with payment
  | "attesting" // writing class-access attestation to 0G
  | "done"
  | "error";

export default function ClassPayment({
  retreatRootHash,
  retreatTitle,
  classPriceUsd,
  onClose,
}: ClassPaymentProps) {
  const { address, connectWithUI, signPersonalMessage, configured: magicConfigured } =
    useMagicAuth();
  const [state, setState] = useState<PaymentState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [accessTxHash, setAccessTxHash] = useState<string | null>(null);

  const handlePay = useCallback(async () => {
    if (!address) {
      setError("Sign in first.");
      return;
    }

    setState("requesting");
    setError(null);

    try {
      // 1. Request class access — server responds with 402 + payment requirements
      const res = await fetch(`/api/classes/access?retreat=${retreatRootHash}`, {
        method: "GET",
      });

      if (res.status === 402) {
        // Parse x402 payment requirements from response
        const body = await res.json();
        const paymentRequirements = body.paymentRequirements ?? {
          amount: classPriceUsd.toString(),
          token: USDC_ADDRESS,
          chainId: SETTLE_CHAIN_ID,
          payTo: body.payTo,
          description: `Class access: ${retreatTitle}`,
        };

        setState("signing");

        // 2. Sign the payment authorization
        // In a full implementation, this uses Openfort's embedded wallet to
        // sign an EIP-3009 TransferWithAuthorization. For the hackathon demo,
        // we use Magic's personal_sign to sign the payment intent, which the
        // server verifies before granting access.
        const paymentIntent = JSON.stringify({
          amount: paymentRequirements.amount,
          token: paymentRequirements.token,
          chainId: paymentRequirements.chainId,
          payTo: paymentRequirements.payTo,
          retreat: retreatRootHash,
          payer: address,
          timestamp: Date.now(),
        });
        const signature = await signPersonalMessage(paymentIntent);

        setState("paying");

        // 3. Retry with payment signature
        const payRes = await fetch(`/api/classes/access`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            retreat: retreatRootHash,
            payer: address,
            paymentIntent,
            signature,
          }),
        });

        if (!payRes.ok) {
          const errBody = await payRes.json();
          throw new Error(errBody.error ?? "Payment verification failed.");
        }

        const result = await payRes.json();
        setAccessTxHash(result.txHash ?? null);

        // 4. Write class-access attestation to 0G Storage
        setState("attesting");
        const attestation: ClassAccessAttestation = {
          rootHash: `class-${retreatRootHash.slice(0, 12)}-${Date.now().toString(36)}`,
          kind: "class-access",
          title: `Class access: ${retreatTitle}`,
          description: `Paid $${classPriceUsd} for drop-in class access`,
          claims: {
            retreatRootHash,
            practitionerAddress: address,
            classPriceUsd,
            paymentTxHash: result.txHash,
            accessGrantedAt: new Date().toISOString(),
          },
          attestor: address,
          createdAt: new Date().toISOString(),
        };

        // Sign + post the attestation
        const attMessage = JSON.stringify(attestation);
        const attSignature = await signPersonalMessage(attMessage);
        const attestRes = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            booking: { ...attestation, claims: attestation.claims },
            signature: attSignature,
          }),
        });

        if (!attestRes.ok) {
          // Payment still succeeded — attestation is best-effort
          console.warn("Class-access attestation failed, but payment succeeded");
        }

        setState("done");
      } else if (res.ok) {
        // Already paid / free access
        setState("done");
      } else {
        throw new Error(`Unexpected response: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
      setState("error");
    }
  }, [address, classPriceUsd, retreatRootHash, retreatTitle, signPersonalMessage]);

  if (state === "done") {
    return (
      <div className="border border-[color:var(--accent-soft)] bg-[color:var(--surface)] rounded-sm p-6 fade-in-up surface-card">
        <p className="tag mb-1">access granted</p>
        <h3 className="font-serif text-2xl tracking-tight mb-2">{retreatTitle}</h3>
        <p className="why mb-3">
          You paid ${classPriceUsd.toLocaleString()} for drop-in class access.
        </p>
        {accessTxHash && (
          <p className="tag break-all mb-2">tx: {accessTxHash}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="border border-[color:var(--accent-ink)] bg-[color:var(--surface)] rounded-sm p-6 fade-in-up surface-card">
        <p className="tag mb-1 text-[color:var(--accent-ink)]">payment failed</p>
        <p className="text-sm text-[color:var(--accent-ink)] mb-3">{error}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setState("idle")}
            className="px-4 py-2 rounded-sm bg-foreground text-background text-sm"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-sm border border-[color:var(--hairline)] text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const stepLabels: Record<PaymentState, string> = {
    idle: "Ready to pay",
    requesting: "Requesting access…",
    signing: "Signing payment…",
    paying: "Processing payment…",
    attesting: "Writing to 0G Storage…",
    done: "Done",
    error: "Error",
  };

  return (
    <div className="border border-[color:var(--hairline)] bg-[color:var(--surface)] rounded-sm p-6 fade-in-up surface-card">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-serif text-xl tracking-tight">Drop-in class</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[color:var(--muted)] hover:text-foreground transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      <p className="text-sm text-[color:var(--muted)] mb-4">
        {retreatTitle} · ${classPriceUsd.toLocaleString()} per session
      </p>

      {state !== "idle" && (
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
          <span className="tag">{stepLabels[state]}</span>
        </div>
      )}

      {!address && state === "idle" && (
        <div>
          <p className="why mb-3 text-sm">
            Sign in to pay for this class. No wallet extension needed.
          </p>
          {!magicConfigured && (
            <p className="text-xs text-[color:var(--muted)] mb-3">
              Demo mode: Magic not configured.
            </p>
          )}
          <button
            type="button"
            onClick={connectWithUI}
            disabled={!magicConfigured}
            className="px-5 py-2.5 rounded-sm bg-foreground text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
          >
            Sign in
          </button>
        </div>
      )}

      {address && state === "idle" && (
        <div>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            wallet: {address.slice(0, 6)}…{address.slice(-4)}
          </p>
          <button
            type="button"
            onClick={handlePay}
            className="px-5 py-2.5 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm"
          >
            Pay ${classPriceUsd.toLocaleString()} →
          </button>
        </div>
      )}
    </div>
  );
}
