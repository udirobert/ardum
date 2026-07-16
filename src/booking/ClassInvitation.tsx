"use client";

// ClassInvitation — drop-in class as a low-stakes grant ceremony, not a
// checkout or rail walkthrough (docs/decisions/0008-agentic-commitment.md).
//
// Human moments: identity only if missing → confirm amount.
// x402 / settlement run ambiently under securing status.

import { useCallback, useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import { presenceFromActivity } from "@/agent/mira-presence";
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

type Surface = "grant" | "securing" | "done" | "error";

export default function ClassInvitation({
  retreatRootHash,
  retreatTitle,
  classPriceUsd,
  signals,
  onClose,
}: ClassInvitationProps) {
  const {
    address,
    sessionReady,
    connectWithUI,
    signPersonalMessage,
    connecting: authConnecting,
    configured: magicConfigured,
    returningPayer,
  } = useMagicAuth();
  const [surface, setSurface] = useState<Surface>("grant");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [securingLabel, setSecuringLabel] = useState(
    "Joining you to tomorrow's class…",
  );

  const invitation = classInvitation(retreatTitle, classPriceUsd, signals);

  const runJoin = useCallback(async () => {
    if (!address) return;

    setSurface("securing");
    setError(null);
    setSecuringLabel("Joining you to tomorrow's class…");

    try {
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

        setSecuringLabel("Confirming with you…");
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

        setSecuringLabel("Securing your place…");
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
          const errBody = await payRes.json().catch(() => ({}));
          throw new Error(
            (errBody as { error?: string }).error ??
              "I couldn't complete that yet. Nothing was charged.",
          );
        }

        const result = await payRes.json();
        setTxHash(result.txHash ?? null);

        // Best-effort access record — payment already succeeded
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
          // Payment already succeeded
        });

        setSurface("done");
      } else if (res.ok) {
        setSurface("done");
      } else {
        throw new Error(
          "I couldn't complete that yet. Nothing was charged.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "I couldn't complete that yet. Nothing was charged.",
      );
      setSurface("error");
    }
  }, [address, classPriceUsd, retreatRootHash, retreatTitle, signPersonalMessage]);

  const handleContinueIdentity = useCallback(async () => {
    const next = await connectWithUI();
    if (!next) {
      setError(
        "Sign-in didn't finish. Nothing was charged.",
      );
      setSurface("error");
    }
  }, [connectWithUI]);

  // ── Done: practice is the landing ──────────────────────────────────
  if (surface === "done") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-6">
          <MiraOrb
            size={48}
            presence={presenceFromActivity("arriving")}
            className="flex-shrink-0 mt-1"
          />
          <div className="space-y-2 flex-1">
            {invitation.done.map((line, i) => (
              <p
                key={i}
                className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
        {txHash && (
          <details className="ml-16 mb-4 opacity-70">
            <summary className="tag cursor-pointer">How this is secured</summary>
            <p className="tag mt-3 break-all leading-relaxed">
              Access confirmed · ref {txHash.slice(0, 18)}…
            </p>
          </details>
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
  if (surface === "error") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <MiraOrb size={48} presence={presenceFromActivity("idle")} />
          <div className="flex-1">
            <p className="text-lg leading-relaxed text-[color:var(--accent-ink)]">
              That didn&apos;t go through. That&apos;s okay — nothing was
              charged.
            </p>
            {error && (
              <p className="text-sm text-[color:var(--muted)] mt-2">{error}</p>
            )}
          </div>
        </div>
        <div className="ml-16 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSurface("grant");
            }}
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

  // ── Securing: ambient rails ────────────────────────────────────────
  if (surface === "securing") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-4">
          <MiraOrb
            size={48}
            presence={presenceFromActivity("processing")}
            activity="processing"
            className="flex-shrink-0 mt-1"
          />
          <div className="flex-1 space-y-2">
            {invitation.securing.map((line, i) => (
              <p
                key={i}
                className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
              >
                {line}
              </p>
            ))}
            <p className="text-sm text-[color:var(--muted)]">{securingLabel}</p>
          </div>
        </div>
        <div className="ml-16 flex items-center gap-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
          <span className="tag">One moment…</span>
        </div>
      </div>
    );
  }

  // ── Grant: wait for session → identity if needed → confirm ─────────
  if (!sessionReady) {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-4">
          <MiraOrb
            size={48}
            presence={presenceFromActivity("processing")}
            activity="processing"
            className="flex-shrink-0 mt-1"
          />
          <p className="text-lg leading-relaxed flex-1">
            One moment — I&apos;m finding your place…
          </p>
        </div>
      </div>
    );
  }

  const needsIdentity = !address;
  const grantLines = needsIdentity
    ? invitation.needIdentity
    : returningPayer
      ? [
          `Welcome back. Tomorrow's practice at ${retreatTitle} is open.`,
          invitation.lines[1] ?? invitation.confirmLabel,
        ]
      : invitation.lines;

  return (
    <div className="mt-8 fade-in-up">
      <div className="flex items-start gap-4 mb-6">
        <MiraOrb
          size={48}
          presence={presenceFromActivity("speaking")}
          activity="speaking"
          className="flex-shrink-0 mt-1"
        />
        <div className="space-y-2 flex-1">
          {grantLines.map((line, i) => (
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
        {needsIdentity ? (
          <button
            type="button"
            onClick={() => void handleContinueIdentity()}
            disabled={!magicConfigured || authConnecting}
            className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            {authConnecting ? "Connecting…" : "Continue with Google"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void runJoin()}
            className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            {invitation.confirmLabel}
          </button>
        )}

        {!magicConfigured && needsIdentity && (
          <p className="text-sm text-[color:var(--muted)] mt-3 max-w-prose">
            Secure sign-in isn&apos;t available here yet. Nothing was charged.
          </p>
        )}

        <details className="mt-5 opacity-70">
          <summary className="tag cursor-pointer">How this is secured</summary>
          <p className="text-sm text-[color:var(--muted)] mt-3 max-w-prose leading-relaxed">
            One session only. You confirm the amount; Mira handles payment. No
            longer commitment to the full retreat.
          </p>
        </details>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors block"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
