import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Agent-callable retreat intake service (A2MCP free endpoint).
//
// An agent uses this to structure a natural-language retreat description
// into the attestation schema. The agent collects details from the operator
// in conversation, calls this endpoint to validate + structure them, then
// directs the operator to /attest to sign and publish.
//
// This is NOT a chat endpoint — it's a structuring endpoint. The agent
// does the conversation; this endpoint does the validation.
//
// Request:
//   {
//     "title": "Sidemen Restoration Retreat",
//     "location": "Sidemen, Bali",
//     "durationDays": 7,
//     "priceUsd": 1200,
//     "capacity": 12,
//     "description": "Seven days of restorative yoga...",
//     "practiceStyle": ["restorative", "yin", "meditation"],
//     "energyFit": ["settled", "low"],
//     "socialFit": ["solo", "small-circle"],
//     "breathPhase": ["even", "extended"]
//   }
//
// Response (HTTP 200):
//   {
//     "valid": true,
//     "attestation": { ...structured attestation ready for signing... },
//     "publishUrl": "https://ardum.vercel.app/attest",
//     "instructions": "Direct the operator to this URL to sign and publish."
//   }

const VALID_STYLES = [
  "vinyasa", "power vinyasa", "hatha", "ashtanga", "yin",
  "restorative", "pranayama", "meditation", "kriya", "breath", "strength",
];
const VALID_ENERGY = ["settled", "in-movement", "low", "sharp"];
const VALID_SOCIAL = ["solo", "small-circle", "open-circle", "communal"];
const VALID_BREATH = ["shallow", "even", "extended", "dynamic"];

type IntakeRequest = {
  title?: string;
  location?: string;
  durationDays?: number;
  priceUsd?: number;
  capacity?: number;
  description?: string;
  practiceStyle?: string[];
  energyFit?: string[];
  socialFit?: string[];
  breathPhase?: string[];
};

export async function POST(req: Request) {
  let body: IntakeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const errors: string[] = [];

  if (!body.title || body.title.trim().length < 3) {
    errors.push("title is required (min 3 characters)");
  }
  if (!body.location || body.location.trim().length < 2) {
    errors.push("location is required");
  }
  if (!body.durationDays || body.durationDays < 1) {
    errors.push("durationDays must be at least 1");
  }
  if (body.priceUsd === undefined || body.priceUsd < 0) {
    errors.push("priceUsd is required (can be 0)");
  }
  if (!body.capacity || body.capacity < 1) {
    errors.push("capacity must be at least 1");
  }
  if (!body.description || body.description.trim().length < 20) {
    errors.push("description is required (min 20 characters — describe the shape of the days)");
  }
  if (!body.practiceStyle || body.practiceStyle.length === 0) {
    errors.push("practiceStyle: pick at least one from: " + VALID_STYLES.join(", "));
  } else {
    const invalid = body.practiceStyle.filter((s) => !VALID_STYLES.includes(s));
    if (invalid.length > 0) {
      errors.push(`practiceStyle: invalid values [${invalid.join(", ")}]. Valid: ${VALID_STYLES.join(", ")}`);
    }
  }
  if (!body.energyFit || body.energyFit.length === 0) {
    errors.push("energyFit: pick at least one from: " + VALID_ENERGY.join(", "));
  } else {
    const invalid = body.energyFit.filter((s) => !VALID_ENERGY.includes(s));
    if (invalid.length > 0) {
      errors.push(`energyFit: invalid values [${invalid.join(", ")}]. Valid: ${VALID_ENERGY.join(", ")}`);
    }
  }
  if (!body.socialFit || body.socialFit.length === 0) {
    errors.push("socialFit: pick at least one from: " + VALID_SOCIAL.join(", "));
  } else {
    const invalid = body.socialFit.filter((s) => !VALID_SOCIAL.includes(s));
    if (invalid.length > 0) {
      errors.push(`socialFit: invalid values [${invalid.join(", ")}]. Valid: ${VALID_SOCIAL.join(", ")}`);
    }
  }
  if (!body.breathPhase || body.breathPhase.length === 0) {
    errors.push("breathPhase: pick at least one from: " + VALID_BREATH.join(", "));
  } else {
    const invalid = body.breathPhase.filter((s) => !VALID_BREATH.includes(s));
    if (invalid.length > 0) {
      errors.push(`breathPhase: invalid values [${invalid.join(", ")}]. Valid: ${VALID_BREATH.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        valid: false,
        errors,
        hints: {
          practiceStyle: VALID_STYLES,
          energyFit: VALID_ENERGY,
          socialFit: VALID_SOCIAL,
          breathPhase: VALID_BREATH,
        },
      },
      { status: 400 },
    );
  }

  // Build the structured attestation (without attestor — that's set at signing time)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ardum.vercel.app";

  return NextResponse.json(
    {
      valid: true,
      attestation: {
        kind: "retreat",
        title: body.title!.trim(),
        description: body.description!.trim(),
        claims: {
          location: body.location!.trim(),
          durationDays: body.durationDays!,
          priceUsd: body.priceUsd!,
          capacity: body.capacity!,
          practiceStyle: body.practiceStyle!,
          energyFit: body.energyFit!,
          socialFit: body.socialFit!,
          breathPhase: body.breathPhase!,
        },
      },
      publishUrl: `${baseUrl}/attest`,
      instructions:
        "Direct the operator to the publishUrl in a browser. They sign in with Google (no crypto needed) and the form will be pre-filled with these details. They review and click 'Publish retreat'.",
    },
    { status: 200 },
  );
}

// GET — service discovery
export async function GET() {
  return NextResponse.json({
    service: "ardum-retreat-intake",
    description:
      "Structure a natural-language retreat description into the attestation schema. The agent collects details from the operator in conversation, calls this endpoint to validate + structure them, then directs the operator to /attest to sign and publish.",
    type: "free",
    endpoint: "POST /api/agent/attest",
    requestSchema: {
      title: "string (required, min 3 chars) — retreat name",
      location: "string (required) — where the retreat takes place",
      durationDays: "number (required, min 1) — duration in days",
      priceUsd: "number (required, can be 0) — price in USD",
      capacity: "number (required, min 1) — max participants",
      description: "string (required, min 20 chars) — what the retreat is like",
      practiceStyle: `string[] (required, min 1) — valid: ${VALID_STYLES.join(", ")}`,
      energyFit: `string[] (required, min 1) — valid: ${VALID_ENERGY.join(", ")}`,
      socialFit: `string[] (required, min 1) — valid: ${VALID_SOCIAL.join(", ")}`,
      breathPhase: `string[] (required, min 1) — valid: ${VALID_BREATH.join(", ")}`,
    },
    responseSchema: {
      valid: "boolean — whether the intake passed validation",
      errors: "string[] — validation errors (when valid=false)",
      attestation: "object — structured attestation ready for the operator to sign",
      publishUrl: "string — URL the operator visits to sign and publish",
      instructions: "string — what the agent should tell the operator",
    },
    flow: [
      "1. Agent converses with operator, collects retreat details",
      "2. Agent calls POST /api/agent/attest with structured details",
      "3. If valid, agent tells operator to visit publishUrl",
      "4. Operator signs in with Google at /attest, reviews, clicks Publish",
      "5. Retreat enters the matching pool",
    ],
  });
}
