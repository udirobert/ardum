import Link from "next/link";
import dynamic from "next/dynamic";
import MiraOrb from "@/components/MiraOrb";
import EvidenceCards from "@/components/EvidenceCards";
import {
  bookingDialogue,
  anticipationLine,
  preparationPlan,
} from "@/agent/mira-voice";
import { daysSinceBooking, preparationPresence } from "@/agent/preparation-presence";
import type { MatchResult } from "@/matching/types";
import type { Episode } from "@/episodes/model";
import type { MemoryContext } from "@/memory/semantic-memory";
import type { AestheticVector } from "@/aesthetics/image-pool";
import type { EpisodeDetailPayload } from "@/episodes/detail-payload";

const RetreatVisionFrame = dynamic(
  () => import("@/aesthetics/RetreatVisionFrame"),
  { ssr: false },
);

export default function BookedLanding({
  recommendation,
  depositUsd,
  signals,
  memory,
  miraPresence,
  commitment,
  contribution,
  aestheticVector,
  intentionStatement,
  isAuthenticated,
  busy,
  onGrantContribution,
  onRevokeContribution,
  onComplete,
}: {
  recommendation: MatchResult;
  depositUsd: number;
  signals: { energy?: string; budget?: string; social?: string };
  memory: MemoryContext | undefined;
  miraPresence: EpisodeDetailPayload["miraPresence"];
  commitment: Episode["commitment"];
  contribution: Episode["widerApertureContribution"];
  aestheticVector: AestheticVector | null;
  intentionStatement?: string;
  isAuthenticated: boolean;
  busy: boolean;
  onGrantContribution: () => void;
  onRevokeContribution: () => void;
  onComplete: () => void;
}) {
  const dialogue = bookingDialogue(depositUsd, recommendation.retreatTitle);
  const plan = preparationPlan(recommendation, signals, memory);
  const bookedAt = commitment?.bookedAt;
  const waitPresence = bookedAt ? preparationPresence(bookedAt) : miraPresence;
  const days = bookedAt ? daysSinceBooking(bookedAt) : 0;
  const currentDay = Math.min(days + 1, plan.days.length);
  const arcComplete = days >= plan.days.length;

  return (
    <div className="space-y-6" data-testid="booked-landing">
      <div className="flex items-start gap-4">
        <MiraOrb size={40} presence={waitPresence ?? miraPresence} className="flex-shrink-0 mt-1" viewTransitionName="mira-orb" />
        <div className="space-y-3 flex-1">
          {days <= 0
            ? dialogue.done.map((line, i) => (
                <p
                  key={i}
                  className={`text-lg leading-relaxed mira-line mira-line-${Math.min(i + 1, 5)}`}
                >
                  {line}
                </p>
              ))
            : (
              <p className="text-lg leading-relaxed mira-line mira-line-1">
                {anticipationLine(days)}
              </p>
            )}
        </div>
      </div>

      <RetreatVisionFrame
        vector={aestheticVector}
        intention={intentionStatement}
      />

      <div>
        <p className="font-serif text-2xl tracking-tight mb-1">{plan.title}</p>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          {arcComplete
            ? "The plan is complete. Travel lightly."
            : `Five minutes a day. Today is day ${currentDay}.`}
        </p>
        <ol className="space-y-3">
          {plan.days.map((day) => {
            if (day.day > currentDay) return null;
            const isCurrent = day.day === currentDay && !arcComplete;
            if (!isCurrent) {
              return (
                <li key={day.day} className="flex gap-4 opacity-60">
                  <span className="font-serif text-xl text-[color:var(--accent-soft)] leading-none w-6 flex-shrink-0">
                    {day.day}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base tracking-tight truncate">
                      {day.title}
                    </p>
                  </div>
                </li>
              );
            }
            return (
              <li key={day.day} className="flex gap-4">
                <span className="font-serif text-xl text-[color:var(--accent-soft)] leading-none w-6 flex-shrink-0">
                  {day.day}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <p className="font-serif text-base tracking-tight">{day.title}</p>
                    <span className="tag opacity-60 flex-shrink-0">{day.duration}</span>
                  </div>
                  <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                    {day.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {!arcComplete && (
          <p className="text-xs text-[color:var(--muted)] mt-5">
            The rest arrives as its day comes. Mira will bring it when it&apos;s time.
          </p>
        )}
      </div>

      <div className="border-l-2 border-[color:var(--accent-soft)] pl-4">
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

      {arcComplete && (
        <div className="border-t border-[color:var(--hairline)] pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={onComplete}
            className="text-sm text-[color:var(--muted)] hover:text-foreground disabled:opacity-40 transition-colors"
          >
            I&apos;m back — close this journey
          </button>
        </div>
      )}

      {commitment && (
        <details className="opacity-80">
          <summary className="tag cursor-pointer">How this is secured</summary>
          <div className="mt-3 space-y-3">
            <EvidenceCards
              cards={[
                {
                  title: "Deposit held until you arrive",
                  body: "Your deposit stays protected until check-in. The retreat host does not receive it before you arrive.",
                  badge: "on-chain",
                  source: commitment.depositTxId
                    ? `receipt ${commitment.depositTxId.slice(0, 18)}…`
                    : "your hold",
                  provenance: "held",
                },
                ...(commitment.bookingRootHash
                  ? [{
                      title: "Proof of your place",
                      body: "A signed record of your reservation is kept so you and the host can both verify it later.",
                      badge: "attested" as const,
                      source: `record ${commitment.bookingRootHash.slice(0, 22)}…`,
                      provenance: "indexed",
                    }]
                  : []),
              ]}
            />
            <details className="opacity-70">
              <summary className="text-xs text-[color:var(--muted)] cursor-pointer">
                Technical details
              </summary>
              <p className="text-xs text-[color:var(--muted)] mt-2 max-w-prose leading-relaxed">
                Settlement and reservation records stay inspectable for support
                and audits — not as the story of this step.
              </p>
            </details>
          </div>
        </details>
      )}

      <details className="border-t border-[color:var(--hairline)] pt-5">
        <summary className="tag cursor-pointer">optional — help Mira learn, or keep this across devices</summary>
        <div className="mt-4 space-y-6">
          <div>
            <p className="tag mb-2">help Mira learn — optional</p>
            {contribution?.grantedAt && !contribution.revokedAt ? (
              <div className="space-y-3">
                <p className="text-sm text-[color:var(--muted)] leading-relaxed max-w-prose">
                  Anonymized patterns from this journey may help others with similar
                  intentions. You can withdraw anytime.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRevokeContribution}
                  className="text-sm text-[color:var(--muted)] hover:text-foreground disabled:opacity-40"
                >
                  Withdraw contribution
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[color:var(--muted)] leading-relaxed max-w-prose">
                  Share anonymized patterns from this journey so Mira can normalize
                  what tends to work for people with intentions like yours. Nothing
                  identifiable is shared.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onGrantContribution}
                  className="text-sm text-[color:var(--accent-ink)] hover:text-foreground disabled:opacity-40"
                >
                  Contribute anonymized patterns
                </button>
              </div>
            )}
          </div>

          {!isAuthenticated && (
            <div>
              <p className="tag mb-2">keep this across devices — optional</p>
              <p className="text-sm text-[color:var(--muted)] leading-relaxed max-w-prose mb-3">
                If you want this booking and your intentions to follow you on
                other devices, sign in from the memory page. Optional — everything
                stays on this device either way.
              </p>
              <Link
                href="/memory"
                className="text-sm text-[color:var(--accent-ink)] hover:text-foreground"
              >
                Set up cross-device continuity →
              </Link>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
