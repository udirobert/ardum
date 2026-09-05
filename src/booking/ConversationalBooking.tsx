"use client";

// ConversationalBooking — commitment as a grant ceremony, not a
// multi-phase rail walkthrough (docs/decisions/0008-agentic-commitment.md).
//
// Human moments: identity only if missing → confirm amount and bounds.
// Magic login, account upgrade, deposit routing, and attestation run
// ambiently under "Securing your place…". Rails stay under disclosure.

import { useCallback, useRef, useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import CommitmentArc from "@/components/CommitmentArc";
import { useFluidPour } from "@/components/FluidParticlePour";
import { haptic } from "@/lib/haptics";
import { formatUsd } from "@/lib/format";
import { presenceFromActivity } from "@/agent/mira-presence";
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
import { bookingDialogue } from "@/agent/mira-voice";
import EvidenceCards from "@/components/EvidenceCards";
import CommitmentRailTrace, { type RailStep } from "@/components/CommitmentRailTrace";
import type { BookingAttestation } from "./types";
import BreathSync from "./BreathSync";

type ConversationalBookingProps = {
  episodeId: string;
  expectedRevision: number;
  retreatRootHash: string;
  retreatTitle: string;
  depositUsd: number;
  operatorAddress: string;
  onClose: () => void;
  onBooked?: () => void;
};

type Surface = "grant" | "securing" | "error";

export default function ConversationalBooking({
  episodeId,
  expectedRevision,
  retreatRootHash,
  retreatTitle,
  depositUsd,
  operatorAddress,
  onClose,
  onBooked,
}: ConversationalBookingProps) {
  const {
    address,
    sessionReady,
    configured: magicConfigured,
    connectWithUI,
    connecting: authConnecting,
    returningPayer,
    signPersonalMessage,
  } = useMagicAuth();
  const {
    configured: uaConfigured,
    delegated,
    ensureDelegated,
    sendDeposit,
    error: uaError,
  } = useUniversalAccount();

  const { pour } = useFluidPour();
  const grantRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<Surface>("grant");
  const [error, setError] = useState<string | null>(null);
  const [securingLabel, setSecuringLabel] = useState("Securing your place…");

  const dialogue = bookingDialogue(depositUsd, retreatTitle);
  const amountLabel = formatUsd(depositUsd);

  const runCommitment = useCallback(async () => {
    if (!address) return;

    setSurface("securing");
    setError(null);
    setSecuringLabel("Securing your place…");

    if (!uaConfigured) {
      setError(
        "I couldn't complete that yet. Your hold is still active — nothing was charged.",
      );
      setSurface("error");
      return;
    }

    try {
      // Read-only delegation probe so the "Preparing your account…" beat
      // only shows on the first deposit. The actual EIP-7702 upgrade is
      // performed inline by sendDeposit on the first cross-chain transfer;
      // a false return here is not an error.
      if (!delegated) {
        // Account prep stays ambient — never a named user phase.
        setSecuringLabel("Securing your place…");
        await ensureDelegated();
      }

      setSecuringLabel("Securing your place…");
      const receiver = ESCROW_CONTRACT_ADDRESS || operatorAddress;
      const amount = usdToTokenUnits(depositUsd);

      const result = await sendDeposit({
        receiver,
        amount,
        tokenAddress: USDC_ADDRESS,
        tokenChainId: SETTLE_CHAIN_ID,
      });

      if (!result) {
        setError(
          uaError ??
            "I couldn't complete that yet. Your hold is still active — nothing was charged.",
        );
        setSurface("error");
        return;
      }

      setSecuringLabel("Confirming your place…");

      const rootHash = `booking-${retreatRootHash.slice(0, 16)}-${Date.now().toString(36)}`;
      const booking: BookingAttestation = {
        rootHash,
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

      const message = canonicalBookingMessage(booking);
      const signature = await signPersonalMessage(message);

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          episodeId,
          expectedRevision,
          booking,
          signature,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error ??
            "I couldn't finish securing that. Your hold is still active — nothing was charged.",
        );
      }

      // Fire the fluid pour — particles dissolve from the confirmation
      // area and stream toward the orb center, signaling that the intention
      // has been poured into Mira's care.
      const rect = grantRef.current?.getBoundingClientRect();
      pour({
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height * 0.3 : window.innerHeight * 0.6,
        count: 280,
        color: "#a85a3a",
        durationMs: 2500,
      });

      onBooked?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "I couldn't complete that yet. Your hold is still active — nothing was charged.",
      );
      setSurface("error");
    }
  }, [
    address,
    uaConfigured,
    delegated,
    ensureDelegated,
    uaError,
    operatorAddress,
    depositUsd,
    sendDeposit,
    retreatRootHash,
    retreatTitle,
    signPersonalMessage,
    episodeId,
    expectedRevision,
    onBooked,
    pour,
  ]);

  const handleContinueIdentity = useCallback(async () => {
    const next = await connectWithUI();
    if (!next) {
      setError(
        "Sign-in didn't finish. Your hold is still active — nothing was charged.",
      );
      setSurface("error");
    }
  }, [connectWithUI]);

  // ── Error ──────────────────────────────────────────────────────────
  if (surface === "error") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <MiraOrb size={48} presence={presenceFromActivity("idle")} />
          <div className="flex-1">
            <p className="text-lg leading-relaxed text-[color:var(--accent-ink)]">
              Something didn&apos;t go through. That&apos;s okay — nothing was
              lost.
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

  // ── Securing: ambient rails under human status ─────────────────────
  if (surface === "securing") {
    // Derive rail steps from the securingLabel phase. Each step is
    // Mira-voiced and carries an evidence chip. The trace makes the
    // rails visible without naming the chain, upgrade, or EIP-7702.
    // Rails are inspectable under disclosure — never named phases on the
    // primary securing surface (ADR 0008 / experience-layer).
    const railSteps: RailStep[] = [
      {
        id: "prepare",
        label: "Getting ready",
        chip: "ready",
        status: "done",
        detail: "session ready",
      },
      {
        id: "deposit",
        label: "Securing your place",
        chip: "held",
        status:
          securingLabel === "Confirming your place…" ? "done" : "active",
        detail:
          securingLabel === "Confirming your place…"
            ? "deposit held until arrival"
            : undefined,
      },
      {
        id: "attest",
        label: "Recording your place",
        chip: "proof",
        status: securingLabel === "Confirming your place…" ? "active" : "pending",
      },
    ];

    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-6">
          <MiraOrb
            size={48}
            presence={presenceFromActivity("processing")}
            activity="processing"
            className="flex-shrink-0 mt-1"
          />
          <div className="space-y-2 flex-1">
            {dialogue.securing.map((line, i) => (
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
        <div className="ml-16 space-y-4">
          <BreathSync active={true} />
          <details className="opacity-80">
            <summary className="tag cursor-pointer">Progress details</summary>
            <div className="mt-3">
              <CommitmentRailTrace steps={railSteps} defaultExpanded />
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ── Grant: wait for session → identity only if missing → confirm ───
  // Return bookers with a restored Magic session land on Confirm $X only
  // (ADR 0008 §6). Never flash identity CTA while session is restoring.
  if (!sessionReady) {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-6">
          <MiraOrb
            size={48}
            presence={presenceFromActivity("processing")}
            activity="processing"
            className="flex-shrink-0 mt-1"
          />
          <div className="space-y-2 flex-1">
            {dialogue.restoring.map((line, i) => (
              <p
                key={i}
                className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const needsIdentity = !address;
  const grantLines = needsIdentity
    ? dialogue.needIdentity
    : returningPayer || delegated
      ? dialogue.readyReturning
      : dialogue.ready;

  return (
    <div ref={grantRef} className="mt-8 fade-in-up" data-testid="grant-ceremony">
      <div className="flex items-start gap-4 mb-6">
        <MiraOrb
          size={48}
          presence={presenceFromActivity("speaking")}
          activity="speaking"
          className="flex-shrink-0 mt-1"
        />
        <div
          className="space-y-2 flex-1"
          data-testid={
            needsIdentity
              ? "grant-copy-identity"
              : returningPayer || delegated
                ? "grant-copy-returning"
                : "grant-copy-ready"
          }
        >
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
            data-testid="grant-continue-identity"
            onClick={() => void handleContinueIdentity()}
            disabled={!magicConfigured || authConnecting}
            className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            {authConnecting ? "Connecting…" : "Continue with Google"}
          </button>
        ) : (
          <CommitmentArc
            labelStart="Hold"
            labelEnd="Secure my place"
            ariaLabel={`Confirm deposit of ${amountLabel}`}
            amount={amountLabel}
            disabled={false}
            onThreshold={() => {
              // Fire the weight haptic at the threshold — Mira reacts.
              haptic("weight");
            }}
            onCommit={() => void runCommitment()}
            className="mt-2"
          />
        )}

        {!magicConfigured && needsIdentity && (
          <p className="text-sm text-[color:var(--muted)] mt-3 max-w-prose">
            Secure sign-in isn&apos;t available here yet. Your hold is still
            active — nothing was charged.
          </p>
        )}

        <details className="mt-5 opacity-80">
          <summary className="tag cursor-pointer">How this is secured</summary>
          <div className="mt-4 space-y-4">
            <EvidenceCards
              cards={[
                {
                  title: "Deposit held until you arrive",
                  body: "Your deposit stays protected until check-in. The retreat host does not receive it before you arrive.",
                  badge: "on-chain",
                  source: "your hold",
                  provenance: "held",
                },
                {
                  title: "Proof of your place",
                  body: "After you confirm, a signed record of your reservation is kept so you and the host can both verify it later.",
                  badge: "attested",
                  source: "your booking",
                  provenance: "indexed",
                },
              ]}
            />
            <details className="opacity-70">
              <summary className="text-xs text-[color:var(--muted)] cursor-pointer">
                Technical details
              </summary>
              <p className="text-xs text-[color:var(--muted)] mt-2 max-w-prose leading-relaxed">
                Settlement, escrow, and the reservation record stay inspectable
                after you confirm — for auditors and support, not as the story
                of this step.
              </p>
            </details>
          </div>
        </details>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors block"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
