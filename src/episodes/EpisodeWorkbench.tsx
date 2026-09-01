"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MiraOrb, { preloadMiraScene } from "@/components/MiraOrb";
import { useMiraField } from "@/components/MiraField";
import { useMiraImpulse, type ImpulseKind } from "@/components/MiraImpulse";
import ClarifyPanel from "@/episodes/ClarifyPanel";
import { readAestheticVector, hasStoredAestheticVector } from "@/aesthetics/aesthetic-store";
import { vectorFromIntention } from "@/aesthetics/vector-from-intention";
import type { MatchResult } from "@/matching/types";
import type { BudgetBand, EnergyState } from "@/calibration/schema";
import type { CounterfactualResult } from "@/episodes/counterfactual";
import type {
  PerspectiveName,
} from "./perspectives";
import type {
  Episode,
  EpisodeCommand,
  IntentionConstraints,
  NextDecision,
} from "./model";
import type { EpisodeDetailPayload } from "./detail-payload";
import { createAbortableRunner } from "@/lib/abortableFetch";
import { matchLetter } from "@/agent/mira-voice";
import type { AestheticVector } from "@/aesthetics/image-pool";
import { extractConstraints, hasConstraints } from "@/agent/conversation-extractor";
import { providerFailureLine } from "@/agent/mira-voice";
import type { MiraPresence } from "@/agent/mira-presence";
import Link from "next/link";
import {
  ThinkingBeat,
  BookedLanding,
  RecommendationSurface,
  PrimaryButton,
  type WorkbenchPayload,
  type WorkbenchActions,
  type DerivedViews,
} from "./workbench";

// Warm the hero scene chunk as soon as the episode bundle evaluates — the
// shell field is this page's atmosphere.
preloadMiraScene();

type Props = { episodeId: string };

type CommandInput = EpisodeCommand extends infer Command
  ? Command extends EpisodeCommand
    ? Omit<Command, "expectedRevision">
    : never
  : never;

// Every decision that routes through act() pulses the orb. The mapping is
// semantic, not mechanical: strength tracks how much of the person this is.
function commandImpulse(command: CommandInput): ImpulseKind | null {
  switch (command.type) {
    case "record-commitment":
      return "commit";
    case "create-hold":
      return "resonate";
    case "reject-recommendation":
      return "reject";
    case "feedback":
      return command.reason === "timing" || command.reason === "place"
        ? "reject"
        : "lean";
    case "recommend":
      return "resonate";
    case "revise-intention":
    case "create-invite":
    case "start-monitoring":
      return "lean";
    case "release-hold":
    case "close-coordination":
      return "skip";
    default:
      return null;
  }
}

export default function EpisodeWorkbench({ episodeId }: Props) {
  const router = useRouter();
  const { fire } = useMiraImpulse();
  const [payload, setPayload] = useState<WorkbenchPayload | null>(null);
  const payloadRef = useRef<WorkbenchPayload | null>(null);
  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participant, setParticipant] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [voiceInput, setVoiceInput] = useState("");
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [thinkingBeatKey, setThinkingBeatKey] = useState(0);
  const [thinkingSnapshot, setThinkingSnapshot] = useState<{
    constraints: IntentionConstraints;
    poolSize?: number;
    upcomingPick?: MatchResult;
    rejectedTitle?: string;
  } | null>(null);
  const [activeLens, setActiveLens] = useState<PerspectiveName>("balanced");
  const [lensData, setLensData] = useState<
    Record<PerspectiveName, MatchResult | null> | null
  >(null);
  const [lensLoading, setLensLoading] = useState(false);
  // Prefer the calibrated vector (from the aesthetic calibration swipe
  // flow). When none exists (calibration is off by default, per the
  // product contract), derive a preliminary vector from the intention
  // statement so the retreat vision and orb palette carry signal from
  // the first moment rather than falling back to the neutral default.
  const storedVector = useState(() =>
    typeof window !== "undefined" ? readAestheticVector() : null,
  )[0];
  const hasCalibrated = useState(() =>
    typeof window !== "undefined" ? hasStoredAestheticVector() : false,
  )[0];
  const intentionStatement = payload?.episode.intentions.at(-1)?.statement;
  const aestheticVector = useMemo(() => {
    if (hasCalibrated && storedVector) return storedVector;
    if (intentionStatement) return vectorFromIntention(intentionStatement);
    return storedVector;
  }, [hasCalibrated, storedVector, intentionStatement]);

  // Derived views: budget and energy counterfactuals.
  const [activeBand, setActiveBand] = useState<BudgetBand | null>(null);
  const [bandData, setBandData] = useState<CounterfactualResult | null>(null);
  const [bandLoading, setBandLoading] = useState(false);
  const [activeEnergy, setActiveEnergy] = useState<EnergyState | null>(null);
  const [energyData, setEnergyData] = useState<CounterfactualResult | null>(null);
  const [energyLoading, setEnergyLoading] = useState(false);

  useMiraField({
    presence: payload?.miraPresence ?? null,
    activity: busy || !payload ? "processing" : "idle",
    aestheticVector,
    veil: thinking ? 0.12 : 0.18,
    episode: payload?.episode ?? null,
  });

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
    const data = (await response.json()) as WorkbenchPayload;
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
            perspectives?: Record<PerspectiveName, MatchResult | null>;
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
    } finally {
      setLensLoading(false);
    }
  }

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
    } finally {
      setBandLoading(false);
    }
  }

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
    } finally {
      setEnergyLoading(false);
    }
  }

  useEffect(() => {
    fetch(`/api/episodes/${episodeId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as WorkbenchPayload;
        if (!response.ok) throw new Error(data.error ?? "Episode not found.");
        setPayload(data);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load."),
      );
  }, [episodeId]);

  async function act(
    command: CommandInput,
  ): Promise<WorkbenchPayload | null> {
    const base = payloadRef.current;
    if (!base) return null;
    const impulseKind = commandImpulse(command);
    setBusy(true);
    setError(null);

    const isSetAsideFeedback =
      command.type === "feedback" &&
      (command.reason === "timing" || command.reason === "place");
    const beatCommand =
      command.type === "recommend" || command.type === "reject-recommendation"
        ? command.type
        : isSetAsideFeedback
          ? ("reject-recommendation" as const)
          : null;
    if (beatCommand) {
      const currentRec = base.episode.recommendation;
      setThinkingSnapshot({
        constraints: base.episode.intentions.at(-1)?.constraints ?? {},
        poolSize: currentRec?.alternatives.length
          ? currentRec.alternatives.length + 1
          : undefined,
        upcomingPick:
          beatCommand === "reject-recommendation"
            ? currentRec?.alternatives[0]
            : undefined,
        rejectedTitle:
          beatCommand === "reject-recommendation"
            ? currentRec?.result.retreatTitle
            : undefined,
      });
      setThinkingBeatKey((k) => k + 1);
      setThinking(true);
    }
    const thinkingBeatEnabled =
      process.env.NEXT_PUBLIC_THINKING_BEAT_ENABLED !== "false";
    const beatMinimumMs = thinkingBeatEnabled
      ? beatCommand === "reject-recommendation"
        ? 2500
        : 1500
      : 0;
    const beatStartedAt = Date.now();
    try {
      const response = await fetch(`/api/episodes/${episodeId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...command,
          expectedRevision: base.episode.revision,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = (await response.json()) as WorkbenchPayload & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update.");
      const next: WorkbenchPayload = {
        ...base,
        episode: data.episode,
        nextDecision: data.nextDecision,
        miraPresence: data.miraPresence,
        shareToken: data.shareToken ?? base.shareToken,
      };
      setPayload(next);
      payloadRef.current = next;
      if (data.shareToken) {
        setShareUrl(`${window.location.origin}/invite/${data.shareToken}`);
      }
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update.");
      await load().catch(() => {});
      return null;
    } finally {
      if (beatCommand) {
        const elapsed = Date.now() - beatStartedAt;
        const remaining = beatMinimumMs - elapsed;
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
      }
      setBusy(false);
      setThinking(false);
      // Keep thinkingSnapshot so the settled trace stays visible above
      // the card. It's cleared when a new beat starts or when the state
      // moves away from the recommendation surface.
    }
  }

  async function submitVoiceFeedback(): Promise<void> {
    const message = voiceInput.trim();
    if (!message) return;
    const extracted = extractConstraints(message);
    if (hasConstraints(extracted)) {
      const heard: string[] = [];
      if (extracted.budget) heard.push("budget matters more");
      if (extracted.duration) heard.push(
        extracted.duration <= 4 ? "a shorter trip" : "more time away",
      );
      if (extracted.social) heard.push(
        extracted.social === "solo"
          ? "going alone"
          : extracted.social === "small-circle"
            ? "with someone close"
            : "open to a group",
      );
      if (extracted.dates) heard.push("timing is flexible");
      if (extracted.energy) heard.push(`${extracted.energy} energy`);
      setVoiceResponse(
        heard.length > 0
          ? `I heard: ${heard.join(", ")}. Let me look again with that in mind.`
          : "Let me look again with that in mind.",
      );
      const constraints: IntentionConstraints = {};
      if (extracted.energy) constraints.energy = extracted.energy;
      if (extracted.budget) constraints.budget = extracted.budget;
      if (extracted.social) constraints.social = extracted.social;
      if (extracted.dates) constraints.horizon = extracted.dates;
      if (extracted.duration) {
        constraints.travelWindow =
          extracted.duration <= 4
            ? "weekend"
            : extracted.duration <= 8
              ? "one-week"
              : "extended";
      }
      const revised = await act({
        type: "revise-intention",
        constraints,
        reason: message.slice(0, 160),
      });
      if (!revised) return;
      setVoiceInput("");
      const revisedConstraints =
        revised.episode.intentions.at(-1)?.constraints;
      if (
        revisedConstraints?.energy &&
        revisedConstraints.budget &&
        revisedConstraints.social &&
        revisedConstraints.partySize &&
        revisedConstraints.travelWindow
      ) {
        await act({ type: "recommend" });
      }
    } else {
      setVoiceResponse(
        "Tell me more about what feels off — the place, the timing, the cost? That helps me adjust.",
      );
    }
  }

  // ── Recommendation-surface state ──
  // Whether the current decision lives on the recommendation surface
  // (review/hold/ready-to-book). The settled thinking trace only belongs
  // there, so its render is gated on this below (derived, not a state
  // mutation). Derives from payload?.nextDecision so it is computed before
  // the loading early-return (React Rules of Hooks).
  const nextKind = payload?.nextDecision.kind;
  const isClarifyStep =
    nextKind === "clarify-energy" ||
    nextKind === "clarify-budget" ||
    nextKind === "clarify-social" ||
    nextKind === "clarify-party-size" ||
    nextKind === "clarify-horizon";
  const isRecommendationState =
    !!nextKind &&
    !isClarifyStep &&
    nextKind !== "completed" &&
    nextKind !== "preparation" &&
    nextKind !== "describe-intention";

  // ── Loading state ──
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

  // Derived views passed to the recommendation surface.
  const derived: DerivedViews = {
    activeLens,
    lensData,
    lensLoading,
    activeBand,
    bandData,
    bandLoading,
    activeEnergy,
    energyData,
    energyLoading,
  };

  const actions: WorkbenchActions = {
    act,
    load,
    setVoiceInput,
    setVoiceResponse,
    setCommitmentOpen,
    setParticipant,
    recomputeWithPerspective,
    runCounterfactualBudget,
    runCounterfactualEnergy,
    submitVoiceFeedback,
    fire,
  };

  // ── Main render: a clean state switch ──
  return (
    <section className="dusk mx-auto w-full max-w-3xl px-6 sm:px-10 pt-8 pb-24 min-h-[calc(100svh-56px)]">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="tag hover:text-foreground"
        >
          ← your intentions
        </button>
      </div>

      <div className="mb-6">
        <p className="tag mb-2">what you are making space for</p>
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight leading-tight">
          {intention.statement}
        </h1>
      </div>

      <div
        className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-5 sm:p-6 surface-card"
        aria-live="polite"
      >
        {/* Thinking beat — non-blocking trace at the top of the card.
            Two phases: working (orb + progressive reasoning lines) and
            settled (collapses to "thought for Ns", expandable on demand).
            The recommendation card is hidden during the working phase so
            the beat reads as the breath between intention and arrival;
            it appears below the collapsed trace when settled. */}
        {isRecommendationState && thinkingSnapshot && (
          <div className="mb-4 pb-4 border-b border-[color:var(--hairline)]">
            <ThinkingBeat
              key={`thinking-beat-${thinkingBeatKey}`}
              thinking={thinking}
              constraints={thinkingSnapshot.constraints}
              poolSize={thinkingSnapshot.poolSize}
              presence={miraPresence}
              upcomingPick={thinkingSnapshot.upcomingPick}
              rejectedTitle={thinkingSnapshot.rejectedTitle}
            />
          </div>
        )}

        {/* ── State: completed ── */}
        {nextDecision.kind === "completed" && (
          <div className="space-y-6" data-testid="completed-landing">
            <div className="flex items-start gap-4">
              <MiraOrb
                size={48}
                presence={{ posture: "steady", valence: 0 }}
                className="flex-shrink-0 mt-1"
              />
              <div className="space-y-3 flex-1">
                <p className="text-lg leading-relaxed mira-line mira-line-1">
                  You&apos;re back.
                </p>
                <p className="text-lg leading-relaxed mira-line mira-line-2">
                  {recommendation
                    ? `${recommendation.retreatTitle} is behind you now. What stays with you is yours.`
                    : "This journey is complete."}
                </p>
                <p className="text-sm text-[color:var(--muted)] leading-relaxed max-w-prose">
                  When the next space calls, I&apos;ll be here. The
                  looking-forward is where most of it lives.
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-block text-sm text-[color:var(--muted)] hover:text-foreground transition-colors"
            >
              Begin a new intention →
            </Link>
          </div>
        )}

        {/* ── State: preparation (booked landing) ── */}
        {nextDecision.kind === "preparation" && recommendation && (
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
            aestheticVector={aestheticVector}
            intentionStatement={intention.statement}
            onComplete={() => act({ type: "complete" })}
            isAuthenticated={payload.isAuthenticated ?? false}
            busy={busy}
            onGrantContribution={() =>
              act({ type: "grant-wider-aperture-contribution" })
            }
            onRevokeContribution={() =>
              act({ type: "revoke-wider-aperture-contribution" })
            }
          />
        )}

        {/* ── State: describe-intention ── */}
        {nextDecision.kind === "describe-intention" && (
          <>
            <h2 className="font-serif text-3xl tracking-tight mb-6">
              {nextDecision.prompt}
            </h2>
            <p className="why mb-4">
              Your intention needs a few words before Mira can continue.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-6 py-3 rounded-sm bg-foreground text-background"
            >
              {nextDecision.primaryLabel}
            </button>
          </>
        )}

        {/* ── State: clarification steps ── */}
        {isClarifyStep && (
          <ClarifyPanel
            kind={
              nextDecision.kind as
                | "clarify-energy"
                | "clarify-budget"
                | "clarify-social"
                | "clarify-party-size"
                | "clarify-horizon"
            }
            prompt={nextDecision.prompt}
            primaryLabel={nextDecision.primaryLabel}
            busy={busy}
            onPick={async (constraints) => {
              const revised = await act({
                type: "revise-intention",
                constraints,
                reason: "Clarified through calibration",
              });
              if (!revised) return;
              const revisedConstraints =
                revised.episode.intentions.at(-1)?.constraints;
              if (
                revisedConstraints?.energy &&
                revisedConstraints.budget &&
                revisedConstraints.social &&
                revisedConstraints.partySize &&
                revisedConstraints.travelWindow
              ) {
                await act({ type: "recommend" });
              }
            }}
          />
        )}

        {/* ── State: recommendation (review, hold, ready-to-book) ── */}
        {/* During the thinking beat's working phase the card is hidden —
            the beat is the breath between intention and arrival. The
            settled trace appears above, then the card renders below. */}
        {!isClarifyStep &&
          !thinking &&
          nextDecision.kind !== "completed" &&
          nextDecision.kind !== "preparation" &&
          nextDecision.kind !== "describe-intention" && (
            <>
              {!(recommendation && nextDecision.kind === "review-recommendation") && (
                <h2 className="font-serif text-3xl tracking-tight mb-6">
                  {nextDecision.prompt}
                </h2>
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
                    {busy ? "Sitting with what you've told me…" : nextDecision.primaryLabel}
                  </PrimaryButton>
                </>
              )}

              {recommendation && (
                <RecommendationSurface
                  episode={episode}
                  nextDecision={nextDecision}
                  memory={memory}
                  miraPresence={miraPresence}
                  recommendation={recommendation}
                  derived={derived}
                  busy={busy}
                  shareUrl={shareUrl}
                  participant={participant}
                  voiceInput={voiceInput}
                  voiceResponse={voiceResponse}
                  commitmentOpen={commitmentOpen}
                  aestheticVector={aestheticVector}
                  actions={actions}
                />
              )}
            </>
          )}

        {error && (
          <div className="mt-5" role="alert">
            <p className="text-sm text-[color:var(--accent-ink)]">
              {providerFailureLine("That")}
            </p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">{error}</p>
          </div>
        )}
      </div>

      <details className="mt-8 opacity-80">
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
