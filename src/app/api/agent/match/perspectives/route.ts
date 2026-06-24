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

  const attestations = await listAttestations();
  const lenses = LENSES.map((lens) => {
    const ranked = scoreAllWithOverrides(
      practitioner,
      attestations,
      lens.overrides
    );
    const top = ranked[0];
    return {
      lens: {
        name: lens.name,
        plain: lens.plain,
        weight: lens.weight,
      },
      top: top.result,
      steps: top.steps,
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
  }>;
  agreement: boolean;
};
