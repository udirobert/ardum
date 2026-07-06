"use client";

// ConversationalBooking — the booking flow as a dialogue with Mira,
// not a 4-step wizard. Mira narrates each step. The user clicks to
// advance the conversation. The technical steps (Magic login, UA
// upgrade, deposit, attestation) happen inline as part of the
// conversation, not as a progress bar.
//
// The key difference from BookingFlow: the user never feels like
// they're in a checkout. They're in a conversation with a guide who
// is handling everything for them.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MiraOrb from "@/components/MiraOrb";
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
import MiraCheckIn from "./MiraCheckIn";

// Client-safe memory context shape (subset of MemoryContext from cognee.ts)
type BookingMemory = {
  isReturning: boolean;
  energyHistory: string[];
  pastMatches: { title: string; location: string; score: number }[];
  pastBookings: { title: string; location: string }[];
  pastNotes: string[];
  priorCheckIns: {
    retreat: string;
    day: number;
    answer: string;
    answeredAt: string;
  }[];
  provider: string;
};

type ConversationalBookingProps = {
  retreatRootHash: string;
  retreatTitle: string;
  depositUsd: number;
  operatorAddress: string;
  signals: { energy?: string; budget?: string; social?: string };
  userId?: string;
  onClose: () => void;
};

type Phase =
  | "signIn"
  | "upgrading"
  | "depositing"
  | "breathing"
  | "attesting"
  | "done"
  | "error";

export default function ConversationalBooking({
  retreatRootHash,
  retreatTitle,
  depositUsd,
  operatorAddress,
  signals,
  userId,
  onClose,
}: ConversationalBookingProps) {
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

  const [phase, setPhase] = useState<Phase>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [depositTxId, setDepositTxId] = useState<string | null>(null);
  const [bookingRootHash, setBookingRootHash] = useState<string | null>(null);

  // Fetch Mira's memory for this practitioner so the preparation plan
  // can weave in past notes. Fire-and-forget — the plan works without it.
  const [memory, setMemory] = useState<BookingMemory | null>(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/memory?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data: BookingMemory) => setMemory(data))
      .catch(() => {});
  }, [userId]);

  const dialogue = bookingDialogue(depositUsd, retreatTitle);

  // Derive the effective phase from underlying auth/UA state.
  // This avoids set-state-in-effect cascading renders.
  const effectivePhase: Phase =
    phase === "done" || phase === "error"
      ? phase
      : phase === "attesting"
        ? "attesting"
        : phase === "breathing"
          ? "breathing"
          : !address
            ? "signIn"
            : !delegated
              ? "upgrading"
              : "depositing";

  // Fire rememberBooking when the deposit confirms (phase transitions
  // to "done"). This stores the booking in Cognee so future sessions
  // can recall "you've been to X in Y."
  const bookingRememberedRef = useRef(false);
  useEffect(() => {
    if (effectivePhase === "done" && userId && !bookingRememberedRef.current) {
      bookingRememberedRef.current = true;
      fetch("/api/memory/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          retreatTitle,
          retreatLocation: "",
          depositUsd,
        }),
      }).catch(() => {});
    }
  }, [effectivePhase, userId, retreatTitle, depositUsd]);

  // Auto-trigger delegation when we reach that phase
  useEffect(() => {
    if (effectivePhase === "upgrading" && !delegated && !delegating) {
      ensureDelegated();
    }
  }, [effectivePhase, delegated, delegating, ensureDelegated]);

  // Fetch balance when delegation completes
  useEffect(() => {
    if (delegated) {
      fetchBalance();
    }
  }, [delegated, fetchBalance]);

  const handleDeposit = useCallback(async () => {
    if (!address) return;
    setPhase("breathing"); // breath cycle starts with the deposit

    const receiver = ESCROW_CONTRACT_ADDRESS || operatorAddress;
    const amount = usdToTokenUnits(depositUsd);

    const result = await sendDeposit({
      receiver,
      amount,
      tokenAddress: USDC_ADDRESS,
      tokenChainId: SETTLE_CHAIN_ID,
    });

    if (!result) {
      setError(uaError ?? "Deposit failed.");
      setPhase("error");
      return;
    }

    setDepositTxId(result.transactionId);
    // The breath cycle (12s total) continues through the attestation
    // phase. The user sees the exhale + "Confirmed" as the booking
    // attestation is written to 0G Storage.
    setPhase("attesting");

    // Write booking attestation to 0G Storage
    try {
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
        body: JSON.stringify({ booking, signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Booking attestation failed.");

      setBookingRootHash(json.rootHash ?? rootHash);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking attestation failed.");
      setPhase("error");
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

  // ── Done phase: the commitment ────────────────────────────────────
  // The booking is complete. This is not a receipt — it's Mira's
  // closing lines, the preparation plan shown by default (it's the
  // payoff, not an optional extra), and the provenance collapsed to a
  // single quiet line. The share/referral is a sentence in Mira's
  // voice, not a card with a button.
  if (effectivePhase === "done") {
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
      memory && memory.provider !== "none"
        ? {
            isReturning: memory.isReturning,
            energyHistory: memory.energyHistory,
            pastMatches: memory.pastMatches,
            pastBookings: memory.pastBookings,
            pastNotes: memory.pastNotes,
            // The streaming endpoint always emits priorCheckIns; spread
            // it through so the prep plan can pick up cross-session recall.
            priorCheckIns: memory.priorCheckIns ?? [],
            rawRecall: [],
            provider: memory.provider as "cognee" | "none",
          }
        : undefined,
    );

    return (
      <div className="mt-8 fade-in-up">
        {/* Mira's closing lines — the letter continues */}
        <div className="flex items-start gap-4 mb-8">
          <MiraOrb size={48} state="calm" className="flex-shrink-0 mt-1" />
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

        {/* Provenance — a single quiet line, not the hero */}
        <p className="tag opacity-50 mb-8 ml-16 break-all">
          deposit held in escrow on Arbitrum
          {depositTxId ? ` · tx ${depositTxId.slice(0, 18)}…` : ""}
          {bookingRootHash ? ` · 0G ${bookingRootHash.slice(0, 22)}…` : ""}
        </p>

        {/* Preparation plan — shown by default, woven into the letter */}
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

        {/* Mira checks in — post-booking follow-up timeline */}
        <div className="ml-16 mb-8">
          <MiraCheckIn
            retreatTitle={retreatTitle}
            retreatRootHash={retreatRootHash}
            signals={signals}
          />
        </div>

        {/* Share — woven into Mira's voice, not a card */}
        <div className="ml-16 mb-8">
          <div className="flex items-start gap-3 mb-3">
            <MiraOrb size={28} state="speaking" className="flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed max-w-prose">
              Your spot is held. If a friend books through your link, you both
              get $50 off. Want to share?
            </p>
          </div>
          <div className="flex flex-wrap gap-3 ml-10">
            <button
              type="button"
              onClick={() => {
                const url = typeof window !== "undefined"
                  ? `${window.location.origin}/match/${retreatRootHash}?ref=booked`
                  : "";
                const text = `I booked ${retreatTitle} through Ardum — an agent matched me. ${url}`;
                const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
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

        {/* Close — quiet, not a button. The vision continues below. */}
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

  // ── Error phase ────────────────────────────────────────────────────
  if (effectivePhase === "error") {
    return (
      <div className="mt-8 fade-in-up">
        <div className="flex items-center gap-4 mb-4">
          <MiraOrb size={48} state="calm" />
          <div className="flex-1">
            <p className="text-lg leading-relaxed text-[color:var(--accent-ink)]">
              Something didn&apos;t go through. That&apos;s okay — nothing was lost.
            </p>
            <p className="text-sm text-[color:var(--muted)] mt-2">{error}</p>
          </div>
        </div>
        <div className="ml-16 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase(address ? "upgrading" : "signIn");
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

  // ── Active conversation phases ─────────────────────────────────────
  const phaseLines: Record<Phase, string[]> = {
    signIn: dialogue.signIn,
    upgrading: dialogue.upgrading,
    depositing: dialogue.depositing,
    breathing: ["Breathe with me. Inhale as I sign your deposit. Hold as it settles. Exhale when it confirms."],
    attesting: dialogue.attesting,
    done: [],
    error: [],
  };

  const orbState =
    effectivePhase === "attesting" || (effectivePhase === "upgrading" && delegating)
      ? "thinking"
      : "speaking";

  return (
    <div className="mt-8 fade-in-up">
      {/* Mira dialogue for current phase */}
      <div className="flex items-start gap-4 mb-6">
        <MiraOrb size={48} state={orbState} className="flex-shrink-0 mt-1" />
        <div className="space-y-2 flex-1">
          {phaseLines[effectivePhase].map((line, i) => (
            <p
              key={i}
              className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Action area — what the user does right now */}
      <div className="ml-16">
        {/* Sign in phase */}
        {effectivePhase === "signIn" && !address && (
          <div>
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

        {/* Upgrading phase — automatic, show status */}
        {effectivePhase === "upgrading" && (
          <div className="flex items-center gap-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
            <span className="tag">
              {delegating ? "Upgrading your account…" : "Preparing…"}
            </span>
            {!uaConfigured && (
              <span className="text-xs text-[color:var(--muted)]">
                (Particle env vars not set — demo mode)
              </span>
            )}
          </div>
        )}

        {/* Depositing phase — user clicks to confirm */}
        {effectivePhase === "depositing" && (
          <div>
            {balance && (
              <p className="tag mb-3">
                Unified balance: ${balance.totalUsd.toLocaleString()} across chains
              </p>
            )}
            <p className="text-sm text-[color:var(--muted)] mb-4 max-w-prose">
              Breathe with the circle. Your deposit settles as you exhale.
            </p>
            <button
              type="button"
              onClick={handleDeposit}
              disabled={!uaConfigured}
              className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background disabled:opacity-50 hover:bg-[color:var(--accent-ink)] transition-colors"
            >
              Deposit ${depositUsd.toLocaleString()} →
            </button>
            {!uaConfigured && (
              <p className="text-xs text-[color:var(--muted)] mt-2">
                (Particle env vars not set — demo mode)
              </p>
            )}
          </div>
        )}

        {/* Breathing phase — deposit is being sent, breath cycle plays */}
        {effectivePhase === "breathing" && (
          <BreathSync active={true} />
        )}

        {/* Attesting phase — breath cycle continues, 0G Storage write */}
        {effectivePhase === "attesting" && (
          <div>
            <BreathSync active={true} />
            <div className="flex items-center gap-3 justify-center -mt-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
              <span className="tag">Writing to 0G Storage…</span>
            </div>
          </div>
        )}

        {/* Cancel option */}
        {effectivePhase !== "attesting" && effectivePhase !== "breathing" && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-sm text-[color:var(--muted)] hover:text-foreground transition-colors block"
          >
            Cancel
          </button>
        )}

        {/* Wallet address — subtle, not the hero */}
        {address && (
          <p className="tag mt-4 opacity-50">
            wallet: {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
}
