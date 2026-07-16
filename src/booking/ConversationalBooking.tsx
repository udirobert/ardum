"use client";

// ConversationalBooking — commitment as a grant ceremony, not a
// multi-phase rail walkthrough (docs/decisions/0008-agentic-commitment.md).
//
// Human moments: identity only if missing → confirm amount and bounds.
// Magic login, account upgrade, deposit routing, and attestation run
// ambiently under "Securing your place…". Rails stay under disclosure.

import { useCallback, useState } from "react";
import Link from "next/link";
import MiraOrb from "@/components/MiraOrb";
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
import { bookingDialogue, preparationPlan } from "@/agent/mira-voice";
import type { BookingAttestation } from "./types";
import BreathSync from "./BreathSync";

type ConversationalBookingProps = {
  episodeId: string;
  expectedRevision: number;
  retreatRootHash: string;
  retreatTitle: string;
  depositUsd: number;
  operatorAddress: string;
  signals: { energy?: string; budget?: string; social?: string };
  onClose: () => void;
  onBooked?: () => void;
};

type Surface = "grant" | "securing" | "done" | "error";

export default function ConversationalBooking({
  episodeId,
  expectedRevision,
  retreatRootHash,
  retreatTitle,
  depositUsd,
  operatorAddress,
  signals,
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

  const [surface, setSurface] = useState<Surface>("grant");
  const [error, setError] = useState<string | null>(null);
  const [depositTxId, setDepositTxId] = useState<string | null>(null);
  const [bookingRootHash, setBookingRootHash] = useState<string | null>(null);
  const [securingLabel, setSecuringLabel] = useState("Securing your place…");

  const dialogue = bookingDialogue(depositUsd, retreatTitle);
  const amountLabel = `$${depositUsd.toLocaleString()}`;

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
      if (!delegated) {
        setSecuringLabel("Preparing your account…");
        const ok = await ensureDelegated();
        if (!ok) {
          setError(
            uaError ??
              "I couldn't complete that yet. Your hold is still active — nothing was charged.",
          );
          setSurface("error");
          return;
        }
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

      setDepositTxId(result.transactionId);
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

      setBookingRootHash(json.rootHash ?? rootHash);
      onBooked?.();
      setSurface("done");
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

  // ── Done: preparation is the landing, not a receipt ────────────────
  if (surface === "done") {
    const plan = preparationPlan(
      {
        id: retreatRootHash,
        retreatRootHash,
        retreatTitle,
        retreatDescription: "",
        retreatLocation: "",
        durationDays: 0,
        priceUsd: depositUsd,
        capacity: 0,
        practiceStyle: [],
        score: 0,
        headline: "",
        reasoning: [],
        attestationCount: 1,
        attestor: "",
        attestedAt: "",
      },
      signals,
      undefined,
    );

    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-start gap-4 mb-8">
          <MiraOrb
            size={48}
            presence={presenceFromActivity("arriving")}
            className="flex-shrink-0 mt-1"
          />
          <div className="space-y-3 flex-1">
            {dialogue.done.map((line, i) => (
              <p
                key={i}
                className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        <details className="ml-16 mb-8 opacity-70">
          <summary className="tag cursor-pointer">How this is secured</summary>
          <p className="tag mt-3 break-all leading-relaxed">
            Deposit held in escrow until you arrive
            {depositTxId ? ` · ref ${depositTxId.slice(0, 18)}…` : ""}
            {bookingRootHash ? ` · record ${bookingRootHash.slice(0, 22)}…` : ""}
          </p>
        </details>

        <div className="ml-16 mb-8">
          <p className="font-serif text-2xl tracking-tight mb-1 mira-line">
            {plan.title}
          </p>
          <p className="text-sm text-[color:var(--muted)] mb-6">
            Five minutes a day. Start tonight.
          </p>
          <ol className="space-y-5">
            {plan.days.map((day, i) => (
              <li
                key={day.day}
                className="flex gap-4 mira-line"
                style={{ animationDelay: `${200 + i * 100}ms` }}
              >
                <span className="font-serif text-3xl text-[color:var(--accent-soft)] leading-none w-10 flex-shrink-0">
                  {day.day}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <p className="font-serif text-lg tracking-tight">{day.title}</p>
                    <span className="tag opacity-60 flex-shrink-0">{day.duration}</span>
                  </div>
                  <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                    {day.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Continuity after commitment — worry collapse, not a dashboard */}
        <div className="ml-16 mb-8 border-l-2 border-[color:var(--accent-soft)] pl-5">
          <p className="tag mb-2">what Mira will watch next</p>
          {dialogue.watchNext.map((line, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-[color:var(--muted)] max-w-prose"
            >
              {line}
            </p>
          ))}
        </div>

        <div className="ml-16 mb-8">
          <div className="flex items-start gap-3 mb-3">
            <MiraOrb
              size={28}
              presence={presenceFromActivity("speaking")}
              className="flex-shrink-0 mt-0.5"
            />
            <p className="text-sm leading-relaxed max-w-prose">
              Your spot is held. If a friend books through your link, you both
              get $50 off. Want to share?
            </p>
          </div>
          <div className="flex flex-wrap gap-3 ml-10">
            <button
              type="button"
              onClick={() => {
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/match/${retreatRootHash}?ref=booked`
                    : "";
                const text = `I booked ${retreatTitle} through Ardum — an agent matched me. ${url}`;
                const nav = navigator as Navigator & {
                  share?: (data: {
                    title?: string;
                    text?: string;
                    url?: string;
                  }) => Promise<void>;
                };
                if (typeof nav.share === "function") {
                  nav.share({ title: `Ardum — ${retreatTitle}`, text, url }).catch(() => {
                    nav.clipboard?.writeText(text).catch(() => {});
                  });
                } else {
                  nav.clipboard?.writeText(text).catch(() => {});
                }
              }}
              className="text-sm font-serif text-[color:var(--accent)] hover:text-[color:var(--accent-ink)] transition-colors text-left"
            >
              Share with a friend →
            </button>
            <Link
              href={`/match/${retreatRootHash}`}
              className="text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
            >
              View your retreat →
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="ml-16 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          ↓
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
        <div className="ml-16">
          <BreathSync active={true} />
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
    <div className="mt-8 fade-in-up" data-testid="grant-ceremony">
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
          <button
            type="button"
            data-testid="grant-confirm-deposit"
            onClick={() => void runCommitment()}
            className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            Confirm deposit of {amountLabel}
          </button>
        )}

        {!magicConfigured && needsIdentity && (
          <p className="text-sm text-[color:var(--muted)] mt-3 max-w-prose">
            Secure sign-in isn&apos;t available here yet. Your hold is still
            active — nothing was charged.
          </p>
        )}

        <details className="mt-5 opacity-70">
          <summary className="tag cursor-pointer">How this is secured</summary>
          <p className="text-sm text-[color:var(--muted)] mt-3 max-w-prose leading-relaxed">
            Your deposit is held until you arrive. The operator does not receive
            it before check-in. Technical references (settlement, escrow,
            reservation record) stay inspectable after you confirm.
          </p>
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
