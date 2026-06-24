import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/session";
import { listAttestations } from "@/lib/og-storage";
import {
  LENSES,
  scoreAllWithOverrides,
} from "@/agent/score";
import type { MatchResult, ReasoningStep } from "@/matching/types";

// Two-perspective comparison. Runs each named lens over the same
// attestation pool and returns the top match from each, plus a flag
// indicating whether the lenses agreed.
//
// Deterministic — the LLM is never called here. The point of the
// comparison is to show how the *same* AXES produce different rankings
// under different weight balances, not to spend tokens on debate.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  const practitioner = await getProfile(sessionId);
  if (!practitioner) {
    return NextResponse.json(
      { error: "Profile not found — complete calibration first." },
      { status: 404 }
    );
  }

  const balancedTopId = req.nextUrl.searchParams.get("balanced") ?? null;

  const attestations = await listAttestations();
  // Pre-score under each lens once so we can cross-look both each lens's
  // top in the other lens, and the balanced top under each lens — the
  // numbers that make the disagreement *felt*.
  const rankings = LENSES.map((lens) => ({
    lens,
    ranked: scoreAllWithOverrides(
      practitioner,
      attestations,
      lens.overrides
    ),
  }));

  const lenses = rankings.map((entry, i) => {
    const other = rankings[(i + 1) % rankings.length];
    const top = entry.ranked[0];
    const topUnderOther = other.ranked.find(
      (r) => r.result.id === top.result.id
    );
    const balancedUnderThis = balancedTopId
      ? entry.ranked.find((r) => r.result.id === balancedTopId)
      : undefined;
    return {
      lens: {
        name: entry.lens.name,
        plain: entry.lens.plain,
        weight: entry.lens.weight,
      },
      top: top.result,
      steps: top.steps,
      // What the *other* lens scored this lens's top — the felt gap.
      topScoreUnderOtherLens: topUnderOther?.result.score ?? null,
      otherLensName: other.lens.name,
      // What this lens scored the balanced top — surfaces robustness.
      balancedScoreUnderThisLens: balancedUnderThis?.result.score ?? null,
    };
  });

  const agreement =
    lenses.length >= 2 && lenses[0].top.id === lenses[1].top.id;

  return NextResponse.json({
    lenses,
    agreement,
  });
}

export type LensesResponse = {
  lenses: Array<{
    lens: { name: string; plain: string; weight: number };
    top: MatchResult;
    steps: ReasoningStep[];
    topScoreUnderOtherLens: number | null;
    otherLensName: string;
    balancedScoreUnderThisLens: number | null;
  }>;
  agreement: boolean;
};
