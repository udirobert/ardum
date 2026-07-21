"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import MiraOrb, { preloadMiraScene } from "@/components/MiraOrb";
import { useMiraField } from "@/components/MiraField";
import RetreatExplorationView from "@/components/RetreatExplorationView";
import { readAestheticVector } from "@/aesthetics/aesthetic-store";
import type { MatchResult } from "@/matching/types";
import type { BudgetBand, EnergyState } from "@/calibration/schema";
import { BUDGET_BANDS, ENERGY_STATES } from "@/calibration/schema";
import type { CounterfactualResult } from "@/episodes/counterfactual";
import type {
  PerspectiveName,
} from "./perspectives";
import type {
  Episode,
  EpisodeCommand,
  IntentionConstraints,
} from "./model";
import type { EpisodeDetailPayload } from "./detail-payload";
import { createAbortableRunner } from "@/lib/abortableFetch";
import { matchLetter, bookingDialogue, preparationPlan, reasoningBeat } from "@/agent/mira-voice";
import { extractConstraints, hasConstraints } from "@/agent/conversation-extractor";
import type { MemoryContext } from "@/memory/semantic-memory";
import type { MiraPresence } from "@/agent/mira-presence";
import { DUSK_HEADING } from "@/aesthetics/dusk-theme";

type Props = { episodeId: string };

const CommitmentPanel = dynamic(
  () => import("@/booking/CommitmentPanel"),
  { ssr: false },
);

// Warm the hero scene chunk as soon as the episode bundle evaluates — the
// shell field is this page's atmosphere.
preloadMiraScene();

type EpisodePayload = EpisodeDetailPayload & {
  shareToken?: string;
  error?: string;
};

type PerspectivesPayload = Record<PerspectiveName, MatchResult | null>;

type CommandInput = EpisodeCommand extends infer Command
  ? Command extends EpisodeCommand
    ? Omit<Command, "expectedRevision">
    : never
  : never;

export default function EpisodeWorkbench({ episodeId }: Props) {
  const router = useRouter();
  const [payload, setPayload] = useState<EpisodePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participant, setParticipant] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [voiceInput, setVoiceInput] = useState("");
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  // Thinking beat: when the user clicks "recommend", we show Mira's
  // reasoning step by step before the card appears. The beat starts
  // when `thinking` is set and clears when the recommendation arrives
  // or the act() promise resolves. `thinkingCommand` tracks which
  // command triggered the beat so we can surface the right data:
  //   - "recommend": constraints + pool size (no recommendation yet)
  //   - "reject-recommendation": the next alternative (about to become top)
  const [thinking, setThinking] = useState(false);
  const [thinkingCommand, setThinkingCommand] = useState<
    "recommend" | "reject-recommendation" | null
  >(null);
  const [activeLens, setActiveLens] = useState<PerspectiveName>("balanced");
  const [lensData, setLensData] = useState<PerspectivesPayload | null>(null);
  const [lensLoading, setLensLoading] = useState(false);
  const [aestheticVector] = useState(() =>
    typeof window !== "undefined" ? readAestheticVector() : null,
  );

  // The shell field carries the episode's journey posture; the veil dims the
  // moving orb enough for the workbench's content to stay legible. Kept
  // light (0.28) so Mira's presence is felt, not just background.
  // During the thinking beat, reduce further to 0.15 so Mira is
  // clearly visible when she's "doing something."
  useMiraField({
    presence: payload?.miraPresence ?? null,
    activity: busy || !payload ? "processing" : "idle",
    aestheticVector,
    veil: thinking ? 0.15 : 0.28,
  });

  // One coordinator per derived-view fetcher. Both layers of
  // defense (AbortController + monotonic epoch) live inside
  // createAbortableRunner so a slow earlier fetch can never let a
  // stale body stomp a newer setState. Memoized so every render
  // sees the same instance — otherwise the abort chain would reset
  // on every re-render and the defense would be a no-op in
  // practice. The dispose effect is the setState-after-unmount
  // guard for the same reason: re-creating the runner on every
  // render would leak in-flight fetches.
  const lensRunner = useMemo(() => createAbortableRunner(), []);
  const bandRunner = useMemo(() => createAbortableRunner(), []);
  const energyRunner = useMemo(() => createAbortableRunner(), []);
  useEffect(() => {
    return () => {
      lensRunner.dispose();
      bandRunner.dispose();
      energyRunner.dispose();
    };
  }, [lensRunner, bandRunner, energyRunner]);

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
      const result = await lensRunner.run(
        `/api/episodes/${episodeId}/perspectives`,
        async (response) => {
          const json = (await response.json()) as {
            perspectives?: PerspectivesPayload;
            error?: string;
          };
          if (!response.ok || !json.perspectives) {
            throw new Error(json.error ?? "Could not recompute the fit.");
          }
          return json.perspectives;
        },
      );
      if (result.ok) {
        setLensData(result.value);
      } else if ("error" in result) {
        setError(result.error.message);
      }
      // result.aborted / result.stale: a newer run() supersedes this
      // one — no setState is the correct outcome.
    } finally {
      setLensLoading(false);
    }
  }

  const [activeBand, setActiveBand] = useState<BudgetBand | null>(null);
  const [bandData, setBandData] = useState<CounterfactualResult | null>(null);
  const [bandLoading, setBandLoading] = useState(false);

  async function runCounterfactualBudget(
    band: BudgetBand | null,
  ): Promise<void> {
    setActiveBand(band);
    if (band === null) {
      setBandData(null);
      return;
    }
    setBandLoading(true);
    try {
      const result = await bandRunner.run(
        `/api/episodes/${episodeId}/counterfactual-budget?band=${encodeURIComponent(band)}`,
        async (response) => {
          const json = (await response.json()) as {
            counterfactual?: CounterfactualResult;
            error?: string;
          };
          if (!response.ok || !json.counterfactual) {
            throw new Error(
              json.error ?? "Could not run the counterfactual.",
            );
          }
          return json.counterfactual;
        },
      );
      if (result.ok) {
        setBandData(result.value);
      } else if ("error" in result) {
        setError(result.error.message);
      }
      // result.aborted / result.stale: no-op; a newer run supersedes.
    } finally {
      setBandLoading(false);
    }
  }

  const [activeEnergy, setActiveEnergy] = useState<EnergyState | null>(null);
  const [energyData, setEnergyData] = useState<CounterfactualResult | null>(null);
  const [energyLoading, setEnergyLoading] = useState(false);

  async function runCounterfactualEnergy(
    energy: EnergyState | null,
  ): Promise<void> {
    setActiveEnergy(energy);
    if (energy === null) {
      setEnergyData(null);
      return;
    }
    setEnergyLoading(true);
    try {
      const result = await energyRunner.run(
        `/api/episodes/${episodeId}/counterfactual-energy?energy=${encodeURIComponent(energy)}`,
        async (response) => {
          const json = (await response.json()) as {
            counterfactual?: CounterfactualResult;
            error?: string;
          };
          if (!response.ok || !json.counterfactual) {
            throw new Error(
              json.error ?? "Could not run the counterfactual.",
            );
          }
          return json.counterfactual;
        },
      );
      if (result.ok) {
        setEnergyData(result.value);
      } else if ("error" in result) {
        setError(result.error.message);
      }
      // result.aborted / result.stale: no-op; a newer run supersedes.
    } finally {
      setEnergyLoading(false);
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
    // Start the thinking beat for recommend and reject-recommendation
    // commands — these produce a new recommendation, so we surface
    // Mira's reasoning before the card appears.
    if (command.type === "recommend" || command.type === "reject-recommendation") {
      setThinking(true);
      setThinkingCommand(command.type);
    }
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
      const data = (await response.json()) as EpisodePayload & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update.");
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              episode: data.episode,
              nextDecision: data.nextDecision,
              miraPresence: data.miraPresence,
              shareToken: data.shareToken ?? prev.shareToken,
            }
          : data,
      );
      if (data.shareToken) {
        setShareUrl(`${window.location.origin}/invite/${data.shareToken}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update.");
      await load().catch(() => {});
    } finally {
      setBusy(false);
      setThinking(false);
      setThinkingCommand(null);
    }
  }

  // Conversational feedback — the user types what feels off in their own
  // words. We extract constraints from the text and apply them via
  // revise-intention, which re-recommends with the new constraints. If
  // no constraints are extracted, Mira responds with a nudge instead of
  // silently resetting. See docs/plans/arrival-redesign.md §4.
  async function submitVoiceFeedback(): Promise<void> {
    const message = voiceInput.trim();
    if (!message) return;
    const extracted = extractConstraints(message);
    if (hasConstraints(extracted)) {
      setVoiceResponse(null);
      await act({
        type: "revise-intention",
        constraints: extracted,
        reason: message.slice(0, 160),
      });
      setVoiceInput("");
    } else {
      // No constraints extracted — Mira responds with a nudge rather
      // than silently resetting to clarification.
      setVoiceResponse(
        "Tell me more about what feels off — the place, the timing, the cost? That helps me adjust.",
      );
    }
  }

  if (!payload) {
    return (
      <section className="dusk mx-auto max-w-2xl px-6 sm:px-10 min-h-[calc(100svh-56px)] flex items-center justify-center text-center">
        <p aria-live="polite" className="font-serif text-2xl tracking-tight">
          {error ?? "I'm returning to your intention…"}
        </p>
      </section>
    );
  }

  const { episode, nextDecision, memory, miraPresence } = payload;
  const intention = episode.intentions.at(-1)!;
  const recommendation = episode.recommendation?.result;
  const latestObservation = episode.monitor?.observations.at(-1);

  // Derived once per render so the recommendation block has stable
  // inputs. matchLetter() is pure; memoizing around it would only
  // add complexity for no win. The letter has two parts:
  //   - recognition lines (indices 0..recognitionLineCount-1): shown
  //     only for returning users ("Welcome back. Last time I recommended
  //     X in Y…")
  //   - main letter lines (indices recognitionLineCount..end): Mira's
  //     explanation of why this retreat fits ("I found a retreat that
  //     fits where you are right now. I'm recommending this because…")
  //
  // Both parts are rendered — recognition as the "note from Mira" aside,
  // main lines as the primary voice above the retreat card. New users
  // (recognitionLineCount === 0) see the main letter for the first time.
  const practitionerSignals = {
    energy: intention.constraints.energy,
    budget: intention.constraints.budget,
    social: intention.constraints.social,
  };
  const letter = recommendation
    ? matchLetter(recommendation, practitionerSignals, memory)
    : null;
  const isClarifyStep =
    nextDecision.kind === "clarify-energy" ||
    nextDecision.kind === "clarify-budget" ||
    nextDecision.kind === "clarify-social";

  // Secondary tools (lenses, counterfactuals, alternatives): only expand when
  // uncertainty is genuinely high or the person is actively questioning the fit.
  // A fresh recommendation should feel calm and focused, not overwhelming.
  const highUncertainty =
    (episode.recommendation?.uncertainties.length ?? 0) >= 2;
  const expandSecondaryTools = feedbackOpen || highUncertainty;

  return (
    <section className="dusk mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24 min-h-[calc(100svh-56px)]">
      {thinking && (
        <ThinkingBeat
          constraints={intention.constraints}
          poolSize={episode.recommendation?.alternatives.length
            ? episode.recommendation.alternatives.length + 1
            : undefined}
          presence={miraPresence}
          // For reject-recommendation, the first alternative is about to
          // become the top pick. Surface its reasoning so the user sees
          // why it's being promoted. For recommend, we don't have the
          // new top pick yet — the beat shows constraints + pool only.
          upcomingPick={
            thinkingCommand === "reject-recommendation"
              ? episode.recommendation?.alternatives[0]
              : undefined
          }
          rejectedTitle={
            thinkingCommand === "reject-recommendation"
              ? recommendation?.retreatTitle
              : undefined
          }
        />
      )}
      <div className="mb-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="tag hover:text-foreground"
        >
          ← your intentions
        </button>
      </div>

      <div className="mb-8">
        <p className="tag mb-2">what you are making space for</p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-tight">
          {intention.statement}
        </h1>
      </div>

      <div
        className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 sm:p-8 surface-card"
        aria-live="polite"
      >
        {isClarifyStep ? (
          <RetreatExplorationView
            initialConstraints={intention.constraints}
            widerApertureEvidence={payload.widerApertureEvidence ?? null}
            uncertainties={episode.recommendation?.uncertainties ?? []}
            onConstraintChange={(newConstraints) => {
              act({
                type: "revise-intention",
                constraints: newConstraints,
                reason: "Refined through conversation",
              });
            }}
          />
        ) : episode.status === "booked" && recommendation ? (
          <BookedLanding
            recommendation={recommendation}
            depositUsd={recommendation.priceUsd}
            signals={{
              energy: intention.constraints.energy,
              budget: intention.constraints.budget,
              social: intention.constraints.social,
            }}
            memory={memory}
            miraPresence={miraPresence}
            commitment={episode.commitment}
            contribution={episode.widerApertureContribution}
            isAuthenticated={payload?.isAuthenticated ?? false}
            busy={busy}
            onGrantContribution={() =>
              act({ type: "grant-wider-aperture-contribution" })
            }
            onRevokeContribution={() =>
              act({ type: "revoke-wider-aperture-contribution" })
            }
          />
        ) : (
          <>
        <h2 className="font-serif text-3xl tracking-tight mb-6">
          {nextDecision.prompt}
        </h2>

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
              {busy ? "Sitting with what you've told me…" : nextDecision.primaryLabel}
            </PrimaryButton>
          </>
        )}

        {recommendation && (
          <div className="space-y-6">
            {letter && letter.recognitionLineCount > 0 && (
              <aside
                aria-label="a note from Mira"
                className="border-l-2 border-[color:var(--accent-soft)] pl-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <MiraOrb size={40} presence={miraPresence} />
                  <p className="tag pt-2">a note from Mira</p>
                </div>
                <div className="space-y-2 leading-relaxed">
                  {letter.lines
                    .slice(0, letter.recognitionLineCount)
                    .map((line, index) => (
                      <p
                        key={`recognition-${index}`}
                        className="italic text-[color:var(--accent-ink)]"
                      >
                        {line}
                      </p>
                    ))}
                </div>
              </aside>
            )}
            {/* Mira's main letter — the why, not the what. Shown for all
                users, not just returning. This is Mira's voice explaining
                why this retreat fits the intention. */}
            {letter && letter.lines.length > letter.recognitionLineCount && (
              <div className="flex items-start gap-3">
                <MiraOrb size={32} presence={miraPresence} className="flex-shrink-0 mt-1" />
                <div className="space-y-2 leading-relaxed flex-1">
                  {letter.lines
                    .slice(letter.recognitionLineCount)
                    .map((line, index) => (
                      <p
                        key={`letter-${index}`}
                        className="text-lg leading-relaxed text-[color:var(--foreground)]"
                      >
                        {line}
                      </p>
                    ))}
                </div>
              </div>
            )}
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
              <details className="border-l-2 border-[color:var(--accent-soft)] pl-4">
                <summary className="tag mb-2 cursor-pointer">
                  what remains uncertain
                </summary>
                <div className="space-y-1">
                  {episode.recommendation!.uncertainties.map((uncertainty) => (
                    <p key={uncertainty} className="text-sm text-[color:var(--muted)]">
                      {uncertainty}
                    </p>
                  ))}
                </div>
              </details>
            )}

            {episode.hold?.status === "active" ? (
              <>
                {/* Mira's voice during hold — she's watching, not silent. */}
                <div className="flex items-start gap-3">
                  <MiraOrb size={32} presence={miraPresence} className="flex-shrink-0 mt-1" />
                  <p className="text-sm leading-relaxed italic text-[color:var(--accent-ink)]">
                    I&apos;m watching this for you. I&apos;ll let you know if
                    anything changes.
                  </p>
                </div>
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
                activeBand={activeBand}
                bandData={bandData}
                bandLoading={bandLoading}
                onPickBand={runCounterfactualBudget}
                activeEnergy={activeEnergy}
                energyData={energyData}
                energyLoading={energyLoading}
                onPickEnergy={runCounterfactualEnergy}
                expandSecondaryTools={expandSecondaryTools}
              />
              </>
            ) : (
              <>
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

                {/* Forward-looking voice — the recommendation is the
                    beginning of an ongoing relationship, not a terminal
                    decision. Mira is still working. See docs/plans/
                    arrival-redesign.md §5. */}
                <div className="flex items-start gap-3 mt-2">
                  <MiraOrb size={28} presence={miraPresence} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed italic text-[color:var(--accent-ink)]">
                    This is my strongest current fit. I&apos;ll keep watching —
                    if something fits better, I&apos;ll let you know.
                  </p>
                </div>

                {/* "Not this one" — reject the current top pick and
                    re-recommend with it excluded. Distinct from "this
                    doesn't feel right" (categorical feedback that resets
                    to clarification). This is a specific retreat
                    rejection that produces a different top pick. */}
                {episode.recommendation!.alternatives.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act({
                        type: "reject-recommendation",
                        retreatRootHash: recommendation!.retreatRootHash,
                      })
                    }
                    className="text-sm text-[color:var(--muted)] hover:text-foreground underline"
                  >
                    Not this one — show me another
                  </button>
                )}

                <LensFactors
                  activeLens={activeLens}
                  lensData={lensData}
                  lensLoading={lensLoading}
                  busy={busy}
                  onPickLens={recomputeWithPerspective}
                  recommendation={recommendation}
                />

                <ExploreOtherFits
                  alternatives={episode.recommendation!.alternatives}
                  recommendation={recommendation}
                  busy={busy}
                  activeBand={activeBand}
                  bandData={bandData}
                  bandLoading={bandLoading}
                  onPickBand={runCounterfactualBudget}
                  activeEnergy={activeEnergy}
                  energyData={energyData}
                  energyLoading={energyLoading}
                  onPickEnergy={runCounterfactualEnergy}
                  holdActive={false}
                  expanded={expandSecondaryTools}
                />
              </>
            )}

            {latestObservation && (
              <div className="flex items-start gap-3">
                <MiraOrb size={28} presence={miraPresence} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed text-[color:var(--muted)]">
                  Last checked {new Date(latestObservation.observedAt).toLocaleString()}:
                  {" "}
                  {latestObservation.summary}
                </p>
              </div>
            )}

            {nextDecision.kind === "ready-to-book" && (
              <div className="border-t border-[color:var(--hairline)] pt-6">
                <p className="why mb-3">
                  Confirm amount and bounds. Mira handles the rest. You can
                  change your mind before that line.
                </p>
                {!commitmentOpen ? (
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => setCommitmentOpen(true)}
                  >
                    {nextDecision.primaryLabel}
                  </PrimaryButton>
                ) : (
                  <CommitmentPanel
                    episode={episode}
                    onClose={() => setCommitmentOpen(false)}
                    onBooked={() => {
                      setCommitmentOpen(false);
                      void load();
                    }}
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
            {feedbackOpen && (
              <fieldset className="border-t border-[color:var(--hairline)] pt-5">
                <legend className="tag mb-3">tell Mira what feels off</legend>
                {/* Voice lane — the primary feedback path. The user
                    types in their own words; we extract constraints and
                    re-recommend. Categorical buttons are a fallback
                    below. */}
                <div className="space-y-3">
                  <textarea
                    value={voiceInput}
                    onChange={(e) => setVoiceInput(e.target.value)}
                    placeholder="I don't want somewhere remote…"
                    rows={2}
                    className="w-full px-4 py-3 rounded-sm border border-[color:var(--hairline)] bg-transparent text-sm resize-none focus:outline-none focus:border-[color:var(--accent)]"
                    disabled={busy}
                  />
                  {voiceResponse && (
                    <p className="text-sm italic text-[color:var(--accent-ink)]">
                      {voiceResponse}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy || !voiceInput.trim()}
                    onClick={submitVoiceFeedback}
                    className="text-sm text-[color:var(--muted)] hover:text-foreground disabled:opacity-40"
                  >
                    {busy ? "Sitting with that…" : "Tell Mira →"}
                  </button>
                </div>
                {/* Categorical fallback — for users who prefer buttons
                    over free text. Resets to clarification. */}
                <div className="mt-5 pt-4 border-t border-[color:var(--hairline)]">
                  <p className="text-xs text-[color:var(--muted)] mb-2">
                    or pick a category
                  </p>
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
                </div>
              </fieldset>
            )}

            <details className="pt-2">
              <summary className="tag cursor-pointer">how Mira chose this</summary>
              <div className="mt-4 space-y-4">
                {recommendation.reasoning.map((step) => (
                  <div key={step.axis} className="text-sm border-l-2 border-[color:var(--hairline)] pl-3">
                    <p className="font-medium mb-1">
                      {step.axis}
                      {step.weight > 0 && (
                        <span className="text-[color:var(--muted)] ml-2 text-xs">
                          weight {step.weight.toFixed(2)}
                        </span>
                      )}
                    </p>
                    {/* Given: what Mira observed (practitioner + retreat
                        attributes). This is the citation — the specific
                        data that drove the score. */}
                    <p className="text-[color:var(--muted)] text-xs mb-1">
                      {step.given}
                    </p>
                    {/* Then: the conclusion. */}
                    <p className="text-[color:var(--foreground)]">{step.then}</p>
                  </div>
                ))}
                {/* Considered and rejected — the top alternative and
                    why it scored lower. This makes the decision
                    inspectable: not just "why this one" but "why not
                    that one." */}
                {episode.recommendation?.alternatives[0] && (
                  <div className="text-sm border-l-2 border-[color:var(--accent-soft)] pl-3 pt-2">
                    <p className="font-medium mb-1">Considered and set aside</p>
                    <p className="text-[color:var(--muted)] text-xs mb-1">
                      {episode.recommendation.alternatives[0].retreatTitle} —
                      scored {Math.round(episode.recommendation.alternatives[0].score * 100)}
                      vs {Math.round(recommendation.score * 100)} for {recommendation.retreatTitle}.
                    </p>
                    <p className="text-[color:var(--foreground)]">
                      {episode.recommendation.alternatives[0].reasoning
                        .filter((r) => r.weight > 0)
                        .sort((a, b) => b.weight - a.weight)[0]?.then ??
                        "A close fit, but not as close."}
                    </p>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

          </>
        )}

        {error && (
          <p className="mt-5 text-sm text-[color:var(--accent-ink)]" role="alert">
            {error}
          </p>
        )}
      </div>

      <details className="mt-12 opacity-80">
        <summary className="tag cursor-pointer mb-4">the journey so far</summary>
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
      </details>
    </section>
  );
}

function BookedLanding({
  recommendation,
  depositUsd,
  signals,
  memory,
  miraPresence,
  commitment,
  contribution,
  isAuthenticated,
  busy,
  onGrantContribution,
  onRevokeContribution,
}: {
  recommendation: MatchResult;
  depositUsd: number;
  signals: { energy?: string; budget?: string; social?: string };
  memory: MemoryContext | undefined;
  miraPresence: EpisodeDetailPayload["miraPresence"];
  commitment: Episode["commitment"];
  contribution: Episode["widerApertureContribution"];
  isAuthenticated: boolean;
  busy: boolean;
  onGrantContribution: () => void;
  onRevokeContribution: () => void;
}) {
  const dialogue = bookingDialogue(depositUsd, recommendation.retreatTitle);
  const plan = preparationPlan(recommendation, signals, memory);

  return (
    <div className="space-y-8" data-testid="booked-landing">
      <div className="flex items-start gap-4">
        <MiraOrb size={48} presence={miraPresence} className="flex-shrink-0 mt-1" />
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

      <div>
        <p className="font-serif text-2xl tracking-tight mb-1">{plan.title}</p>
        <p className="text-sm text-[color:var(--muted)] mb-6">
          Five minutes a day. Start tonight.
        </p>
        <ol className="space-y-5">
          {plan.days.map((day) => (
            <li key={day.day} className="flex gap-4">
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

      <div className="border-l-2 border-[color:var(--accent-soft)] pl-5">
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

      {commitment && (
        <details className="opacity-70">
          <summary className="tag cursor-pointer">How this is secured</summary>
          <p className="tag mt-3 break-all leading-relaxed">
            Deposit held in escrow until you arrive
            {commitment.depositTxId
              ? ` · ref ${commitment.depositTxId.slice(0, 18)}…`
              : ""}
            {commitment.bookingRootHash
              ? ` · record ${commitment.bookingRootHash.slice(0, 22)}…`
              : ""}
          </p>
        </details>
      )}

      <div className="border-t border-[color:var(--hairline)] pt-5">
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

      {/* ADR 0011 §5: quiet cross-device continuity CTA. Only shown when
          the actor is not yet authenticated — they've booked, so they
          have a reason to want continuity, but they haven't signed in.
          Never on arrival; never for authenticated practitioners. */}
      {!isAuthenticated && (
        <div className="border-t border-[color:var(--hairline)] pt-5">
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
  );
}

// The thinking beat — Mira's reasoning surfaces step by step before
// the recommendation card appears. The orb is prominent (inquiry
// posture) and the reasoning lines fade in on a timed schedule from
// reasoningBeat(). This makes the recommendation feel earned, not
// instant. See docs/plans/arrival-redesign.md §2.
//
// For `reject-recommendation`, we have the upcoming top pick (the first
// alternative) and can surface its actual reasoning. For `recommend`,
// we don't have the new top pick yet — the beat shows constraints +
// pool size only, and the full reasoning appears in the card's "how
// Mira chose this" disclosure.
function ThinkingBeat({
  constraints,
  poolSize,
  presence,
  upcomingPick,
  rejectedTitle,
}: {
  constraints: IntentionConstraints;
  poolSize?: number;
  presence: MiraPresence | null;
  upcomingPick?: MatchResult;
  rejectedTitle?: string;
}) {
  const steps = useMemo(() => {
    // For reject-recommendation: surface the upcoming pick's reasoning
    // + what was rejected. This is the rich path — we have real data.
    if (upcomingPick) {
      const beat = reasoningBeat(
        upcomingPick,
        undefined, // no alternative data for the upcoming pick
        {
          energy: constraints.energy,
          budget: constraints.budget,
          social: constraints.social,
        },
        poolSize,
      );
      // Prepend a line about what was rejected.
      if (rejectedTitle) {
        return [
          { text: `Not ${rejectedTitle}. Let me look again.`, delayMs: 0 },
          ...beat.slice(1), // skip the default opening line
        ];
      }
      return beat;
    }
    // For recommend: constraints + pool only. The full reasoning
    // arrives with the card.
    return reasoningBeat(
      undefined,
      undefined,
      {
        energy: constraints.energy,
        budget: constraints.budget,
        social: constraints.social,
      },
      poolSize,
    );
  }, [constraints.energy, constraints.budget, constraints.social, poolSize, upcomingPick, rejectedTitle]);

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    // Reveal each step on its scheduled delay. The timers are cleaned
    // up on unmount so a fast response doesn't leave dangling timers.
    const timers: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      timers.push(
        window.setTimeout(() => setVisibleCount(i + 1), steps[i].delayMs),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [steps]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0c0806]/95 backdrop-blur-sm"
      aria-live="polite"
      aria-label="Mira is thinking"
    >
      <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
        <MiraOrb
          size={120}
          presence={presence ?? undefined}
          activity="processing"
          className="flex-shrink-0"
        />
        <div className="space-y-3 min-h-[6rem]">
          {steps.slice(0, visibleCount).map((step, index) => (
            <p
              key={`reasoning-${index}`}
              className="font-serif text-lg tracking-tight leading-relaxed fade-in-up"
              style={DUSK_HEADING}
            >
              {step.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// Prominent lens factors — "What if we weighted this differently?"
// Surfaces the three ranking lenses (balanced/restorative/movement) in
// the main flow so the user can shape how Mira weighs what fits, not
// just accept or reject her result. See docs/plans/arrival-redesign.md §3.
function LensFactors({
  activeLens,
  lensData,
  lensLoading,
  busy,
  onPickLens,
  recommendation,
}: {
  activeLens: PerspectiveName;
  lensData: PerspectivesPayload | null;
  lensLoading: boolean;
  busy: boolean;
  onPickLens: (lens: PerspectiveName) => void;
  recommendation: MatchResult | undefined;
}) {
  return (
    <div className="border-t border-[color:var(--hairline)] pt-5">
      <p className="tag mb-2">What if we weighted this differently?</p>
      <p className="text-sm text-[color:var(--muted)] mb-3 italic">
        These change how I weigh what fits. They don&apos;t change what you asked for.
      </p>
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

// A small panel that shows which retreat a hypothetical budget band
// picks. Mirrors LensOutcome so the two peer sections read the same.
// Used under the counterfactual budget toggle. The sameAsMain flag
// turns this into a statement (the override agrees with the surfaced
// recommendation) rather than a recommendation replacement — agency
// without confusion.
function BudgetCounterfactualOutcome({
  band,
  topRanked,
  recommendation,
}: {
  band: BudgetBand;
  topRanked: MatchResult | null;
  recommendation: MatchResult | undefined;
}) {
  const bandLabel =
    BUDGET_BANDS.find((b) => b.value === band)?.label ?? band;
  const sameAsMain =
    topRanked !== null &&
    recommendation !== undefined &&
    topRanked.retreatRootHash === recommendation.retreatRootHash;
  if (!topRanked) {
    return (
      <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
        <p className="tag mb-2">if budget were {bandLabel}</p>
        <p className="text-sm text-[color:var(--muted)]">
          Nothing in the verified pool satisfies that limit — and that
          is information too.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
      <p className="tag mb-2">
        if budget were {bandLabel}
        {sameAsMain ? " (same retreat)" : ""}
      </p>
      <p className="font-serif text-xl tracking-tight mb-1">
        {topRanked.retreatTitle}
      </p>
      <p className="text-sm text-[color:var(--muted)]">
        {topRanked.retreatLocation} · {topRanked.durationDays} days · $
        {topRanked.priceUsd.toLocaleString()}
      </p>
    </div>
  );
}

// A small panel that shows which retreat a hypothetical energy state
// picks. Mirrors the budget counterpart's structure (peer of
// BudgetCounterfactualOutcome inside ExploreOtherFits body). The
// sameAsMain flag turns this into a statement (the override agrees
// with the surfaced recommendation) rather than a recommendation
// replacement — agency without confusion.
function EnergyCounterfactualOutcome({
  energy,
  topRanked,
  recommendation,
}: {
  energy: EnergyState;
  topRanked: MatchResult | null;
  recommendation: MatchResult | undefined;
}) {
  const energyLabel =
    ENERGY_STATES.find((e) => e.value === energy)?.label ?? energy;
  const sameAsMain =
    topRanked !== null &&
    recommendation !== undefined &&
    topRanked.retreatRootHash === recommendation.retreatRootHash;
  if (!topRanked) {
    return (
      <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
        <p className="tag mb-2">if energy were {energyLabel}</p>
        <p className="text-sm text-[color:var(--muted)]">
          Nothing in the verified pool fits that register — and that
          is information too.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border-l-2 border-[color:var(--accent-soft)] pl-4">
      <p className="tag mb-2">
        if energy were {energyLabel}
        {sameAsMain ? " (same retreat)" : ""}
      </p>
      <p className="font-serif text-xl tracking-tight mb-1">
        {topRanked.retreatTitle}
      </p>
      <p className="text-sm text-[color:var(--muted)]">
        {topRanked.retreatLocation} · {topRanked.durationDays} days · $
        {topRanked.priceUsd.toLocaleString()}
      </p>
    </div>
  );
}

// Surfaces the alternatives + budget/energy counterfactuals as a single
// component. Expanded when uncertainty is high, feedback is open, or no
// hold yet; collapsed under a calm active hold (confidence check only —
// never mutates the hold). Lens factors are in the prominent
// LensFactors component above. See docs/design/experience-layer.md.
function ExploreOtherFits({
  alternatives,
  recommendation,
  busy,
  activeBand,
  bandData,
  bandLoading,
  onPickBand,
  activeEnergy,
  energyData,
  energyLoading,
  onPickEnergy,
  holdActive,
  expanded,
}: {
  alternatives: MatchResult[];
  recommendation: MatchResult | undefined;
  busy: boolean;
  activeBand: BudgetBand | null;
  bandData: CounterfactualResult | null;
  bandLoading: boolean;
  onPickBand: (band: BudgetBand | null) => void;
  activeEnergy: EnergyState | null;
  energyData: CounterfactualResult | null;
  energyLoading: boolean;
  onPickEnergy: (energy: EnergyState | null) => void;
  holdActive: boolean;
  expanded: boolean;
}) {
  const body = (
    <div className="space-y-5">
      {alternatives.length > 0 && (
        <div>
          <p className="tag mb-2">
            {holdActive
              ? "and one more that also qualified"
              : "other possibilities I'm weighing"}
          </p>
          <ul className="space-y-4">
            {alternatives.map((alt, index) => (
              <li
                key={alt.retreatRootHash}
                className="border-l-2 border-[color:var(--hairline)] pl-4"
              >
                <p className="text-xs text-[color:var(--muted)] mb-1">
                  {index === 0 ? "next in line" : `option ${index + 1}`}
                </p>
                <p className="font-serif text-lg tracking-tight">
                  {alt.retreatTitle}
                </p>
                <p className="text-sm text-[color:var(--muted)] mt-0.5">
                  {alt.retreatLocation} · {alt.durationDays} days · $
                  {alt.priceUsd.toLocaleString()}
                </p>
                {alt.reasoning.length > 0 && (
                  <p className="text-sm mt-2 italic text-[color:var(--accent-ink)]">
                    {alt.reasoning[0].then}
                  </p>
                )}
              </li>
            ))}
            {!holdActive && (
              <li className="text-sm text-[color:var(--muted)] pt-1">
                Use &ldquo;Not this one&rdquo; to move to the next in line.
              </li>
            )}
          </ul>
        </div>
      )}
      <div>
        <p className="tag mb-2">what if your budget were tighter?</p>
          <div
            role="group"
            aria-label="Re-rank the fit under a hypothetical budget"
            className="flex flex-wrap gap-2"
          >
            {BUDGET_BANDS.map(({ value, label }) => {
              const isActive = activeBand === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={busy || bandLoading}
                  onClick={() => onPickBand(isActive ? null : value)}
                  className={`px-3 py-2 rounded-sm border text-sm transition-colors disabled:opacity-40 ${
                    isActive
                      ? "border-[color:var(--accent)] text-[color:var(--accent-ink)]"
                      : "border-[color:var(--hairline)] hover:border-[color:var(--accent)]"
                  }`}
                  aria-pressed={isActive}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {bandLoading && (
            <p className="text-sm text-[color:var(--muted)] mt-3 italic">
              Re-ranking under a different limit…
            </p>
          )}
          {!bandLoading && activeBand && bandData && (
            <BudgetCounterfactualOutcome
              band={activeBand}
              topRanked={bandData.topRanked}
              recommendation={recommendation}
            />
          )}
        </div>
        <div>
          <p className="tag mb-2">what if your energy were different?</p>
          <div
            role="group"
            aria-label="Re-rank the fit under a hypothetical energy"
            className="flex flex-wrap gap-2"
          >
            {ENERGY_STATES.map(({ value, label }) => {
              const isActive = activeEnergy === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={busy || energyLoading}
                  onClick={() => onPickEnergy(isActive ? null : value)}
                  className={`px-3 py-2 rounded-sm border text-sm transition-colors disabled:opacity-40 ${
                    isActive
                      ? "border-[color:var(--accent)] text-[color:var(--accent-ink)]"
                      : "border-[color:var(--hairline)] hover:border-[color:var(--accent)]"
                  }`}
                  aria-pressed={isActive}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {energyLoading && (
            <p className="text-sm text-[color:var(--muted)] mt-3 italic">
              Re-ranking under a different energy…
            </p>
          )}
          {!energyLoading && activeEnergy && energyData && (
            <EnergyCounterfactualOutcome
              energy={activeEnergy}
              topRanked={energyData.topRanked}
              recommendation={recommendation}
            />
          )}
        </div>
      </div>
    );

  if (!expanded) {
    return (
      <details className="mt-5 border-t border-[color:var(--hairline)] pt-5">
        <summary className="tag cursor-pointer">
          {holdActive
            ? "still curious what else fitted?"
            : "See other possibilities I'm weighing"}
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
  episode: Episode;
  participant: string;
  setParticipant: (value: string) => void;
  shareUrl: string | null;
  busy: boolean;
  onInvite: () => void;
  onRelease: () => void;
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

  return (
    <div className="border border-[color:var(--accent-soft)] rounded-sm p-5">
      <p className="tag mb-2">non-binding planning hold</p>
      <p className="mb-1">
        Held until {new Date(hold.expiresAt).toLocaleString()}.
      </p>
      <p className="text-sm text-[color:var(--muted)] mb-5">
        Nothing has been booked or charged.
      </p>

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

      <div className="flex flex-wrap gap-3">
        {inviteOpen && (
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
