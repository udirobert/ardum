import type { MatchResult } from "@/matching/types";
import type { BudgetBand, EnergyState } from "@/calibration/schema";
import type { CounterfactualResult } from "@/episodes/counterfactual";
import type { Episode, NextDecision } from "@/episodes/model";
import ExploreOtherFits from "./ExploreOtherFits";
import PrimaryButton from "./PrimaryButton";

export default function HoldPanel({
  nextDecision,
  episode,
  participant,
  setParticipant,
  shareUrl,
  busy,
  onInvite,
  onRelease,
  onCloseCoordination,
  onRefresh,
  recommendation,
  activeBand,
  bandData,
  bandLoading,
  onPickBand,
  activeEnergy,
  energyData,
  energyLoading,
  onPickEnergy,
  expandSecondaryTools,
}: {
  nextDecision: NextDecision;
  episode: Episode;
  participant: string;
  setParticipant: (value: string) => void;
  shareUrl: string | null;
  busy: boolean;
  onInvite: () => void;
  onRelease: () => void;
  onCloseCoordination: () => void;
  onRefresh: () => Promise<void>;
  recommendation: MatchResult | undefined;
  activeBand: BudgetBand | null;
  bandData: CounterfactualResult | null;
  bandLoading: boolean;
  onPickBand: (band: BudgetBand | null) => void;
  activeEnergy: EnergyState | null;
  energyData: CounterfactualResult | null;
  energyLoading: boolean;
  onPickEnergy: (energy: EnergyState | null) => void;
  expandSecondaryTools: boolean;
}) {
  const hold = episode.hold!;
  const inviteOpen = Boolean(episode.coordination?.inviteExpiresAt);
  const hasResponses = Boolean(episode.coordination?.responses.length);
  const reviewHold = nextDecision.kind === "review-hold";
  const awaitResponses = nextDecision.kind === "await-responses";
  const readyToBook = nextDecision.kind === "ready-to-book";

  return (
    <div className="border border-[color:var(--accent-soft)] rounded-sm p-5">
      <p className="tag mb-2">non-binding planning hold</p>
      <p className="mb-1">
        Held until {new Date(hold.expiresAt).toLocaleString()}.
      </p>
      <p className="text-sm text-[color:var(--muted)] mb-5">
        Nothing has been booked or charged.
      </p>

      {reviewHold && (
        <div className="mb-5 border-l-2 border-[color:var(--accent-soft)] pl-4">
          <p className="text-sm leading-relaxed mb-3">{nextDecision.prompt}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onCloseCoordination}
              className="px-5 py-2.5 rounded-sm bg-foreground text-background text-sm disabled:opacity-40"
            >
              Continue solo — secure my place
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRelease}
              className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] text-sm disabled:opacity-40"
            >
              Release the hold
            </button>
          </div>
        </div>
      )}

      {hasResponses ? (
        <div className="mb-5">
          {episode.coordination!.responses.map((response) => (
            <p key={response.participantId} className="text-sm">
              {episode.coordination?.participantName} responded{" "}
              <strong>{response.decision}</strong>.
            </p>
          ))}
        </div>
      ) : shareUrl ? (
        <div className="mb-5">
          <p className="text-sm mb-2">Private invitation link</p>
          <p className="why mb-3">
            For {episode.coordination?.participantName ?? "the person"} — this
            link confirms a shared hold and never includes your intention or
            constraints.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 border border-[color:var(--hairline)] bg-background px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(shareUrl)}
              className="px-3 py-2 border border-[color:var(--hairline)] text-sm"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-[color:var(--muted)] mt-2">
            Mira can&apos;t recover this link if you close the tab — copy it now.
          </p>
        </div>
      ) : inviteOpen ? (
        <p className="text-sm text-[color:var(--muted)] mb-5">
          The invitation is active. For privacy, its token is shown only when
          created. Ask Mira to check for a response.
        </p>
      ) : (
        <details className="mb-5">
          <summary className="text-sm text-[color:var(--muted)] cursor-pointer hover:text-foreground">
            Someone else needs to agree?
          </summary>
          <div className="mt-4">
            <label className="block text-sm mb-2" htmlFor="participant-name">
              Invite them to this decision
            </label>
            <div className="flex gap-2">
              <input
                id="participant-name"
                value={participant}
                onChange={(event) => setParticipant(event.target.value)}
                placeholder="Their first name"
                maxLength={80}
                className="min-w-0 flex-1 border border-[color:var(--hairline)] bg-background px-3 py-2"
              />
              <button
                type="button"
                disabled={!participant.trim() || busy}
                onClick={onInvite}
                className="px-4 py-2 bg-foreground text-background disabled:opacity-40"
              >
                Create invite
              </button>
            </div>
            <p className="text-xs text-[color:var(--muted)] mt-2">
              The link shares only that an invitation exists—never your private
              intention or constraints. Solo paths do not require an invite.
            </p>
          </div>
        </details>
      )}

      {/* The HoldPanel action row carries the hold-management actions
          (release, check-for-response). When the state is ready-to-book,
          the primary decision moves to the commitment section, so we
          suppress these actions here to avoid competing affordances —
          a quiet "release the hold" link sits with the commitment CTA
          instead. */}
      {!readyToBook && (
        <div className="flex flex-wrap gap-3">
          {awaitResponses && inviteOpen && (
            <PrimaryButton disabled={busy} onClick={() => void onRefresh()}>
              {nextDecision.primaryLabel}
            </PrimaryButton>
          )}
          {!reviewHold && inviteOpen && !awaitResponses && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRefresh()}
              className="text-sm text-[color:var(--accent)]"
            >
              Check for a response
            </button>
          )}
          {!reviewHold && (
            <button
              type="button"
              disabled={busy}
              onClick={onRelease}
              className="text-sm text-[color:var(--muted)]"
            >
              Release the hold
            </button>
          )}
        </div>
      )}
      <ExploreOtherFits
        alternatives={episode.recommendation?.alternatives ?? []}
        recommendation={recommendation}
        busy={busy}
        activeBand={activeBand}
        bandData={bandData}
        bandLoading={bandLoading}
        onPickBand={onPickBand}
        activeEnergy={activeEnergy}
        energyData={energyData}
        energyLoading={energyLoading}
        onPickEnergy={onPickEnergy}
        holdActive={true}
        expanded={expandSecondaryTools}
      />
    </div>
  );
}
