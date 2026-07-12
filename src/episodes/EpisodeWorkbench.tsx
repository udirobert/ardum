"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import MiraOrb from "@/components/MiraOrb";
import type { MatchResult } from "@/matching/types";
import type {
  PerspectiveName,
} from "./perspectives";
import type {
  Episode,
  EpisodeCommand,
  NextDecision,
} from "./model";

type Props = { episodeId: string };

const CommitmentPanel = dynamic(
  () => import("@/booking/CommitmentPanel"),
  { ssr: false },
);

type EpisodePayload = {
  episode: Episode;
  nextDecision: NextDecision;
  shareToken?: string;
  error?: string;
};

type PerspectivesPayload = Record<PerspectiveName, MatchResult | null>;

type CommandInput = EpisodeCommand extends infer Command
  ? Command extends EpisodeCommand
    ? Omit<Command, "expectedRevision">
    : never
  : never;

const energyOptions = [
  ["settled", "Settled"],
  ["in-movement", "In movement"],
  ["low", "Low"],
  ["sharp", "Sharp"],
] as const;
const budgetOptions = [
  ["under-1k", "Under $1,000"],
  ["1k-2k", "$1,000 – $2,000"],
  ["2k-3k", "$2,000 – $3,000"],
  ["3k-plus", "$3,000+"],
] as const;
const socialOptions = [
  ["solo", "Mostly alone"],
  ["small-circle", "Small circle"],
  ["open-circle", "Open circle"],
  ["communal", "Communal"],
] as const;

export default function EpisodeWorkbench({ episodeId }: Props) {
  const router = useRouter();
  const [payload, setPayload] = useState<EpisodePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participant, setParticipant] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [activeLens, setActiveLens] = useState<PerspectiveName>("balanced");
  const [lensData, setLensData] = useState<PerspectivesPayload | null>(null);
  const [lensLoading, setLensLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/episodes/${episodeId}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as EpisodePayload;
    if (!response.ok) throw new Error(data.error ?? "Episode not found.");
    setPayload(data);
  }, [episodeId]);

  async function recomputeWithPerspective(
    lens: PerspectiveName,
  ): Promise<void> {
    setActiveLens(lens);
    if (lensData || lensLoading) return;
    setLensLoading(true);
    try {
      const response = await fetch(
        `/api/episodes/${episodeId}/perspectives`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as {
        perspectives?: PerspectivesPayload;
        error?: string;
      };
      if (!response.ok || !json.perspectives) {
        throw new Error(json.error ?? "Could not recompute the fit.");
      }
      setLensData(json.perspectives);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not recompute.",
      );
    } finally {
      setLensLoading(false);
    }
  }

  useEffect(() => {
    fetch(`/api/episodes/${episodeId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as EpisodePayload;
        if (!response.ok) throw new Error(data.error ?? "Episode not found.");
        setPayload(data);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load."),
      );
  }, [episodeId]);

  async function act(
    command: CommandInput,
  ): Promise<void> {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/episodes/${episodeId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...command,
          expectedRevision: payload.episode.revision,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = (await response.json()) as EpisodePayload;
      if (!response.ok) throw new Error(data.error ?? "Could not update.");
      setPayload(data);
      if (data.shareToken) {
        setShareUrl(`${window.location.origin}/invite/${data.shareToken}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update.");
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return (
      <section className="mx-auto max-w-2xl px-6 sm:px-10 py-20">
        <div className="flex items-center gap-4">
          <MiraOrb size={48} state="thinking" />
          <p aria-live="polite">{error ?? "Returning to your intention…"}</p>
        </div>
      </section>
    );
  }

  const { episode, nextDecision } = payload;
  const intention = episode.intentions.at(-1)!;
  const recommendation = episode.recommendation?.result;
  const latestObservation = episode.monitor?.observations.at(-1);

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <div className="flex items-center justify-between gap-4 mb-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="tag hover:text-foreground"
        >
          ← your intentions
        </button>
        <p className="tag">revision {episode.revision}</p>
      </div>

      <div className="flex items-start gap-5 mb-8">
        <MiraOrb size={64} state={busy ? "thinking" : "calm"} />
        <div>
          <p className="tag mb-2">what you are making space for</p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-tight">
            {intention.statement}
          </h1>
        </div>
      </div>

      <div
        className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 sm:p-8 surface-card"
        aria-live="polite"
      >
        <p className="tag mb-3">the next decision</p>
        <h2 className="font-serif text-3xl tracking-tight mb-6">
          {nextDecision.prompt}
        </h2>

        {nextDecision.kind === "clarify-energy" && (
          <>
            <p className="why mb-3">
              How you arrive now shapes what fits. Mira will remember this
              only for this intention.
            </p>
            <ChoiceGrid
            options={energyOptions}
            disabled={busy}
            onChoose={(energy) =>
              act({
                type: "revise-intention",
                constraints: { energy },
                reason: "Clarified current energy",
              })
            }
          />
          </>
        )}
        {nextDecision.kind === "clarify-budget" && (
          <>
            <p className="why mb-3">
              A responsible limit keeps the choice honest. Mira will remember
              this only for this intention.
            </p>
            <ChoiceGrid
            options={budgetOptions}
            disabled={busy}
            onChoose={(budget) =>
              act({
                type: "revise-intention",
                constraints: { budget },
                reason: "Set a responsible limit",
              })
            }
          />
          </>
        )}
        {nextDecision.kind === "clarify-social" && (
          <>
            <p className="why mb-3">
              The shape of company shapes the day. Mira will remember this
              only for this intention.
            </p>
            <ChoiceGrid
            options={socialOptions}
            disabled={busy}
            onChoose={(social) =>
              act({
                type: "revise-intention",
                constraints: { social },
                reason: "Clarified the shape of company",
              })
            }
          />
          </>
        )}
        {nextDecision.kind === "review-recommendation" && !recommendation && (
          <>
            <p className="why mb-3">
              Mira scores your intention against the verified pool. Nothing
              is shared or stored yet.
            </p>
            <PrimaryButton
              disabled={busy}
              onClick={() => act({ type: "recommend" })}
            >
              {busy ? "Considering what matters…" : nextDecision.primaryLabel}
            </PrimaryButton>
          </>
        )}

        {recommendation && (
          <div className="space-y-6">
            <div>
              <p className="tag mb-2">one current recommendation</p>
              <h3 className="font-serif text-3xl tracking-tight">
                {recommendation.retreatTitle}
              </h3>
              <p className="text-[color:var(--muted)] mt-2">
                {recommendation.retreatLocation} · {recommendation.durationDays}{" "}
                days · ${recommendation.priceUsd.toLocaleString()} · cohort of{" "}
                {recommendation.capacity}
              </p>
              <p className="mt-4 leading-relaxed">
                {recommendation.retreatDescription}
              </p>
            </div>

            {episode.recommendation!.uncertainties.length > 0 && (
              <div className="border-l-2 border-[color:var(--accent-soft)] pl-4">
                <p className="tag mb-2">what remains uncertain</p>
                {episode.recommendation!.uncertainties.map((uncertainty) => (
                  <p key={uncertainty} className="text-sm text-[color:var(--muted)]">
                    {uncertainty}
                  </p>
                ))}
              </div>
            )}

            {episode.hold?.status === "active" ? (
              <HoldPanel
                episode={episode}
                participant={participant}
                setParticipant={setParticipant}
                shareUrl={shareUrl}
                busy={busy}
                onInvite={() =>
                  act({
                    type: "create-invite",
                    participantName: participant,
                    sharingConsent: true,
                  })
                }
                onRelease={() => act({ type: "release-hold" })}
                onRefresh={load}
                recommendation={recommendation}
                activeLens={activeLens}
                lensData={lensData}
                lensLoading={lensLoading}
                onPickLens={recomputeWithPerspective}
              />
            ) : (
              <>
                <p className="why mb-3">
                  Mira places a non-binding hold, or watches this retreat
                  for changes. Neither charges you. Either expires on its own.
                </p>
                <div className="flex flex-wrap gap-3">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => act({ type: "create-hold" })}
                  >
                    Hold this for 48 hours
                  </PrimaryButton>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act({
                        type: episode.monitor ? "check-monitor" : "start-monitoring",
                      })
                    }
                    className="px-5 py-3 rounded-sm border border-[color:var(--hairline)] disabled:opacity-40"
                  >
                    {episode.monitor ? "Check for changes" : "Watch this for me"}
                  </button>
                </div>
                <ExploreOtherFits
                  alternatives={episode.recommendation!.alternatives}
                  recommendation={recommendation}
                  activeLens={activeLens}
                  lensData={lensData}
                  lensLoading={lensLoading}
                  busy={busy}
                  onPickLens={recomputeWithPerspective}
                  holdActive={false}
                  variant="open"
                />
              </>
            )}

            {latestObservation && (
              <p className="text-sm text-[color:var(--muted)]">
                Last checked {new Date(latestObservation.observedAt).toLocaleString()}:
                {" "}
                {latestObservation.summary}
              </p>
            )}

            {nextDecision.kind === "ready-to-book" && (
              <div className="border-t border-[color:var(--hairline)] pt-6">
                <p className="why mb-3">
                  Mira moves from holding to booking. A real deposit and
                  attestation happen here. You can change your mind before
                  that line.
                </p>
                {!commitmentOpen ? (
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => setCommitmentOpen(true)}
                  >
                    Review the commitment
                  </PrimaryButton>
                ) : (
                  <CommitmentPanel
                    episode={episode}
                    onClose={() => setCommitmentOpen(false)}
                  />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setFeedbackOpen((open) => !open)}
              className="text-sm text-[color:var(--muted)] hover:text-foreground"
            >
              This doesn’t feel right →
            </button>
            <p className="why mt-2">
              Tell Mira what is off. The journey re-enters clarity — never
              checkout.
            </p>
            {feedbackOpen && (
              <fieldset className="border-t border-[color:var(--hairline)] pt-5">
                <legend className="tag mb-3">what is off?</legend>
                <div className="flex flex-wrap gap-2">
                  {(["timing", "budget", "group", "place", "intention"] as const).map(
                    (reason) => (
                      <button
                        key={reason}
                        type="button"
                        disabled={busy}
                        onClick={() => act({ type: "feedback", reason })}
                        className="px-3 py-2 rounded-sm border border-[color:var(--hairline)] text-sm capitalize"
                      >
                        {reason}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
            )}

            <details className="pt-2">
              <summary className="tag cursor-pointer">how Mira chose this</summary>
              <div className="mt-4 space-y-4">
                {recommendation.reasoning.map((step) => (
                  <div key={step.axis} className="text-sm">
                    <p className="font-medium">{step.axis}</p>
                    <p className="text-[color:var(--muted)]">{step.then}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {error && (
          <p className="mt-5 text-sm text-[color:var(--accent-ink)]" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="mt-12">
        <p className="tag mb-4">what has happened</p>
        <ol className="space-y-3">
          {episode.events
            .slice()
            .reverse()
            .map((item) => (
              <li key={item.id} className="flex gap-4 text-sm">
                <time className="tag w-28 shrink-0">
                  {new Date(item.createdAt).toLocaleDateString()}
                </time>
                <span>{item.summary}</span>
              </li>
            ))}
        </ol>
      </div>
    </section>
  );
}

function ChoiceGrid<T extends string>({
  options,
  disabled,
  onChoose,
}: {
  options: readonly (readonly [T, string])[];
  disabled: boolean;
  onChoose: (value: T) => void;
}) {
  return (
    <fieldset className="grid sm:grid-cols-2 gap-3">
      <legend className="sr-only">Choose one</legend>
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(value)}
          className="min-h-12 px-4 py-3 text-left rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent)] disabled:opacity-40"
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// A small panel that shows which retreat a non-balanced lens picked.
// Used under the lens toggle. The `sameAsMain` flag turns this into a
// statement (the alternative lens agrees) rather than a recommendation
// replacement — agency without confusion.
function LensOutcome({
  lens,
  pick,
  sameAsMain,
}: {
  lens: PerspectiveName;
  pick: MatchResult;
  sameAsMain: boolean;
}) {
  return (
    <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
      <p className="tag mb-2">
        with {lens} lens{sameAsMain ? " (same retreat)" : ""}
      </p>
      <p className="font-serif text-xl tracking-tight mb-1">
        {pick.retreatTitle}
      </p>
      <p className="text-sm text-[color:var(--muted)]">
        {pick.retreatLocation} · {pick.durationDays} days · $
        {pick.priceUsd.toLocaleString()}
      </p>
    </div>
  );
}

// Surfaces the alternatives + lens toggle as a single component, in
// two contexts: open when no hold is active (the natural secondary
// inspection after the primary decision is shown), and collapsed as a
// <details> disclosure when a hold IS active (Mira's hold is unaffected;
// this is purely a confidence check, not a re-commit). The copy adapts
// per `holdActive` so the user is never misled into thinking their hold
// moved.
function ExploreOtherFits({
  alternatives,
  recommendation,
  activeLens,
  lensData,
  lensLoading,
  busy,
  onPickLens,
  holdActive,
  variant,
}: {
  alternatives: MatchResult[];
  recommendation: MatchResult | undefined;
  activeLens: PerspectiveName;
  lensData: PerspectivesPayload | null;
  lensLoading: boolean;
  busy: boolean;
  onPickLens: (lens: PerspectiveName) => void;
  holdActive: boolean;
  variant: "open" | "details";
}) {
  const body = (
    <div className="space-y-5">
      <p className="why mb-1">
        {holdActive
          ? "Your hold continues below. These alternatives and a re-ranking are a confidence check — nothing here moves without your word."
          : "Mira can re-weight the criteria. Nothing is committed — you stay where you are."}
      </p>
      <p className="why mb-3">
        A re-ranking may flip the top pick — that&apos;s what this surface
        is here to catch.
      </p>
      {alternatives.length > 0 && (
        <div>
          <p className="tag mb-2">
            {holdActive
              ? "and one more that also qualified"
              : "and one more that qualified"}
          </p>
          <p className="why mb-3">
            {holdActive
              ? "The hold is unchanged. These are what would have fit if you had not held."
              : "Mira saw these too. She chose the top fit because the reasoning below weighed energy, social, and budget together."}
          </p>
          <ul className="space-y-2">
            {alternatives.map((alt) => (
              <li
                key={alt.retreatRootHash}
                className="text-sm leading-relaxed"
              >
                <span className="font-serif text-base tracking-tight">
                  {alt.retreatTitle}
                </span>
                <span className="text-[color:var(--muted)]">
                  {" "}
                  · {alt.retreatLocation} · {alt.durationDays} days · $
                  {alt.priceUsd.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="tag mb-2">what would change the fit?</p>
        <div
          role="group"
          aria-label="Recompute the fit under a different lens"
          className="flex flex-wrap gap-2"
        >
          {(["balanced", "restorative", "movement"] as const).map((lens) => (
            <button
              key={lens}
              type="button"
              disabled={busy || lensLoading}
              onClick={() => onPickLens(lens)}
              className={`px-3 py-2 rounded-sm border text-sm capitalize transition-colors disabled:opacity-40 ${
                activeLens === lens
                  ? "border-[color:var(--accent)] text-[color:var(--accent-ink)]"
                  : "border-[color:var(--hairline)] hover:border-[color:var(--accent)]"
              }`}
              aria-pressed={activeLens === lens}
            >
              {lens}
            </button>
          ))}
        </div>
        {lensLoading && (
          <p className="text-sm text-[color:var(--muted)] mt-3 italic">
            Re-ranking…
          </p>
        )}
        {!lensLoading &&
          activeLens !== "balanced" &&
          lensData &&
          lensData[activeLens] && (
            <LensOutcome
              lens={activeLens}
              pick={lensData[activeLens]!}
              sameAsMain={
                lensData[activeLens]!.retreatRootHash ===
                recommendation?.retreatRootHash
              }
            />
          )}
      </div>
    </div>
  );

  if (variant === "details") {
    return (
      <details className="mt-5 border-t border-[color:var(--hairline)] pt-5">
        <summary className="tag cursor-pointer">
          still curious what else fitted?
        </summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  }

  return (
    <div className="mt-6 border-t border-[color:var(--hairline)] pt-5">
      {body}
    </div>
  );
}

function HoldPanel({
  episode,
  participant,
  setParticipant,
  shareUrl,
  busy,
  onInvite,
  onRelease,
  onRefresh,
  recommendation,
  activeLens,
  lensData,
  lensLoading,
  onPickLens,
}: {
  episode: Episode;
  participant: string;
  setParticipant: (value: string) => void;
  shareUrl: string | null;
  busy: boolean;
  onInvite: () => void;
  onRelease: () => void;
  onRefresh: () => Promise<void>;
  recommendation: MatchResult | undefined;
  activeLens: PerspectiveName;
  lensData: PerspectivesPayload | null;
  lensLoading: boolean;
  onPickLens: (lens: PerspectiveName) => void;
}) {
  const hold = episode.hold!;
  return (
    <div className="border border-[color:var(--accent-soft)] rounded-sm p-5">
      <p className="tag mb-2">non-binding planning hold</p>
      <p className="mb-1">
        Held until {new Date(hold.expiresAt).toLocaleString()}.
      </p>
      <p className="text-sm text-[color:var(--muted)] mb-5">
        Nothing has been booked or charged.
      </p>

      {episode.coordination?.responses.length ? (
        <div className="mb-5">
          {episode.coordination.responses.map((response) => (
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
      ) : episode.coordination?.inviteExpiresAt ? (
        <p className="text-sm text-[color:var(--muted)] mb-5">
          The invitation is active. For privacy, its token is shown only when
          created. Ask Mira to check for a response.
        </p>
      ) : (
        <div className="mb-5">
          <label className="block text-sm mb-2" htmlFor="participant-name">
            Who else needs to be part of this decision?
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
            intention or constraints.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {episode.coordination?.inviteExpiresAt && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRefresh()}
            className="text-sm text-[color:var(--accent)]"
          >
            Check for a response
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onRelease}
          className="text-sm text-[color:var(--muted)]"
        >
          Release the hold
        </button>
      </div>
      <ExploreOtherFits
        alternatives={episode.recommendation?.alternatives ?? []}
        recommendation={recommendation}
        activeLens={activeLens}
        lensData={lensData}
        lensLoading={lensLoading}
        busy={busy}
        onPickLens={onPickLens}
        holdActive={true}
        variant="details"
      />
    </div>
  );
}
