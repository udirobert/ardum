"use client";

// ClassInvitation — the drop-in class payment reframed as a spontaneous
// invitation from Mira, not a checkout button. The agent opens with
// empathy ("Can't commit to the full retreat? I understand."), then
// offers a single class as a low-stakes alternative.
//
// The x402 payment is invisible inside the conversation. The user
// clicks "Join tomorrow's class" and Mira handles the rest.

import { useCallback, useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import { useMagicAuth } from "./MagicAuth";
import { BASE_SEPOLIA_CHAIN_ID, USDC_BASE_SEPOLIA } from "./constants";
import { classInvitation } from "@/agent/mira-voice";
import type { ClassAccessAttestation } from "./types";

type ClassInvitationProps = {
  retreatRootHash: string;
  retreatTitle: string;
  classPriceUsd: number;
  signals: { energy?: string; budget?: string; social?: string };
  onClose: () => void;
};

type Phase = "inviting" | "signIn" | "paying" | "done" | "error";

export default function ClassInvitation({
  retreatRootHash,
  retreatTitle,
  classPriceUsd,
  signals,
  onClose,
}: ClassInvitationProps) {
  const {
    address,
    connectWithUI,
    signPersonalMessage,
    configured: magicConfigured,
  } = useMagicAuth();
  const [phase, setPhase] = useState<Phase>("inviting");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const invitation = classInvitation(retreatTitle, classPriceUsd, signals);

  const handleJoin = useCallback(async () => {
    if (!address) {
      setPhase("signIn");
      return;
    }

    setPhase("paying");
    setError(null);

    try {
      // 1. Request access — server responds with 402
      const res = await fetch(`/api/classes/access?retreat=${retreatRootHash}`, {
        method: "GET",
      });

      if (res.status === 402) {
        const body = await res.json();
        const paymentRequirements = body.paymentRequirements ?? {
          amount: classPriceUsd.toString(),
          token: USDC_BASE_SEPOLIA,
          chainId: BASE_SEPOLIA_CHAIN_ID,
          payTo: body.payTo,
          description: `Class access: ${retreatTitle}`,
        };

        // 2. Sign payment intent
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

        // 3. Retry with payment
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
        setTxHash(result.txHash ?? null);

        // 4. Write class-access attestation (best-effort)
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

        const attMessage = JSON.stringify(attestation);
        const attSignature = await signPersonalMessage(attMessage);
        await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            booking: { ...attestation, claims: attestation.claims },
            signature: attSignature,
          }),
        }).catch(() => {
          // Best-effort — payment already succeeded
        });

        setPhase("done");
      } else if (res.ok) {
        setPhase("done");
      } else {
        throw new Error(`Unexpected response: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
      setPhase("error");
    }
  }, [address, classPriceUsd, retreatRootHash, retreatTitle, signPersonalMessage]);

  // ── Done ───────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-6">
          <MiraOrb size={48} state="calm" className="flex-shrink-0 mt-1" />
          <div className="space-y-2 flex-1">
            <p className="text-lg leading-relaxed mira-line">
              You&apos;re in. Tomorrow&apos;s practice starts at 6am.
            </p>
            <p className="text-lg leading-relaxed mira-line mira-line-2">
              I&apos;ll send a reminder 30 minutes before. No prep needed — just
              arrive as you are.
            </p>
          </div>
        </div>
        {txHash && (
          <p className="tag break-all opacity-50 mb-4 ml-16">tx: {txHash}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-16 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <MiraOrb size={48} state="calm" />
          <div className="flex-1">
            <p className="text-lg leading-relaxed text-[color:var(--accent-ink)]">
              The payment didn&apos;t go through. Nothing was charged.
            </p>
            <p className="text-sm text-[color:var(--muted)] mt-2">{error}</p>
          </div>
        </div>
        <div className="ml-16 flex gap-3">
          <button
            type="button"
            onClick={() => setPhase("inviting")}
            className="px-5 py-2.5 rounded-sm bg-foreground text-background text-sm"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Paying ─────────────────────────────────────────────────────────
  if (phase === "paying") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <MiraOrb size={48} state="thinking" />
          <div className="flex-1">
            <p className="text-lg leading-relaxed mira-line">
              Handling the payment now…
            </p>
            <p className="text-sm text-[color:var(--muted)] mt-2">
              ${classPriceUsd} via x402 — settling on Base.
            </p>
          </div>
        </div>
        <div className="ml-16 flex items-center gap-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
          <span className="tag">Processing…</span>
        </div>
      </div>
    );
  }

  // ── Sign in needed ─────────────────────────────────────────────────
  if (phase === "signIn" && !address) {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <MiraOrb size={48} state="speaking" />
          <p className="text-lg leading-relaxed flex-1">
            Sign in first — I&apos;ll handle the rest.
          </p>
        </div>
        <div className="ml-16">
          {!magicConfigured && (
            <p className="text-xs text-[color:var(--muted)] mb-3">
              Demo mode: Magic not configured.
            </p>
          )}
          <button
            type="button"
            onClick={connectWithUI}
            disabled={!magicConfigured}
            className="px-5 py-2.5 rounded-sm bg-foreground text-background disabled:opacity-50 text-sm"
          >
            Sign in with Google
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Initial invitation ─────────────────────────────────────────────
  return (
    <div className="mt-8 fade-in-up">
      <div className="flex items-start gap-4 mb-6">
        <MiraOrb size={48} state="speaking" className="flex-shrink-0 mt-1" />
        <div className="space-y-2 flex-1">
          {invitation.lines.map((line, i) => (
            <p
              key={i}
              className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="ml-16">
        <button
          type="button"
          onClick={handleJoin}
          className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          {invitation.cta} →
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-4 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
