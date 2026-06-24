import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/session";
import { listAttestations } from "@/lib/og-storage";
import { scoreAllWithOverrides } from "@/agent/score";

// Counterfactual re-ranking. Given a session + a named preset, recompute
// the match with a different composite weight balance and return the new
// top result. The reasoning steps come from the same AXES registry, so
// the counterfactual is auditable in exactly the same way as the main
// match — same Given/When/Then shape, same per-axis scores.

export const dynamic = "force-dynamic";

// Each preset is a weight rebalance. Keys are axis names; values override
// the corresponding entry in COMPOSITE_WEIGHTS. Adding a preset is a
// single entry here; the rest of the API stays the same.
const PRESETS = {
  energy: {
    name: "energy-heavy",
    plain: "energy weighted more",
    overrides: {
      "Energy alignment": 0.5,
      "Social comfort": 0.2,
      Budget: 0.1,
      "Breath & practice": 0.1,
    },
  },
  social: {
    name: "social-heavy",
    plain: "social comfort weighted more",
    overrides: {
      "Energy alignment": 0.2,
      "Social comfort": 0.45,
      Budget: 0.15,
      "Breath & practice": 0.1,
    },
  },
  budget: {
    name: "budget-heavy",
    plain: "budget weighted more",
    overrides: {
      "Energy alignment": 0.2,
      "Social comfort": 0.2,
      Budget: 0.4,
      "Breath & practice": 0.1,
    },
  },
} as const;

type PresetKey = keyof typeof PRESETS;

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; preset?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.sessionId || !body.preset) {
    return NextResponse.json(
      { error: "Missing sessionId or preset." },
      { status: 400 }
    );
  }
  const preset = PRESETS[body.preset as PresetKey];
  if (!preset) {
    return NextResponse.json(
      { error: `Unknown preset '${body.preset}'.` },
      { status: 400 }
    );
  }

  const practitioner = await getProfile(body.sessionId);
  if (!practitioner) {
    return NextResponse.json(
      { error: "Profile not found — complete calibration first." },
      { status: 404 }
    );
  }

  const attestations = await listAttestations();
  const ranked = scoreAllWithOverrides(
    practitioner,
    attestations,
    preset.overrides
  );
  const top = ranked[0];
  if (!top) {
    return NextResponse.json(
      { error: "No attestations to score." },
      { status: 503 }
    );
  }

  // Compact ranked list so the UI can locate the balanced top's new
  // score under this lens (the "feel" of the shift) without a second
  // request.
  const summary = ranked.slice(0, 8).map((r) => ({
    id: r.result.id,
    retreatTitle: r.result.retreatTitle,
    score: r.result.score,
  }));

  return NextResponse.json({
    preset: preset.name,
    plain: preset.plain,
    top: top.result,
    steps: top.steps,
    ranked: summary,
  });
}
