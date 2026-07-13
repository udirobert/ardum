import { NextResponse } from "next/server";
import { NEUTRAL_VECTOR, type AestheticVector } from "@/aesthetics/image-pool";
import {
  resolveRetreatVision,
  type ResolveRetreatVisionInput,
} from "@/aesthetics/resolve-retreat-vision";

export const dynamic = "force-dynamic";

function parseVector(raw: unknown): AestheticVector {
  if (!raw || typeof raw !== "object") return NEUTRAL_VECTOR;
  const v = raw as Record<string, unknown>;
  const num = (key: keyof AestheticVector) => {
    const n = v[key];
    return typeof n === "number" && n >= 0 && n <= 1 ? n : 0.5;
  };
  return {
    ocean: num("ocean"),
    mountain: num("mountain"),
    jungle: num("jungle"),
    desert: num("desert"),
    forest: num("forest"),
    warm: num("warm"),
    cool: num("cool"),
    minimal: num("minimal"),
    ornate: num("ornate"),
    light: num("light"),
    dark: num("dark"),
    calming: num("calming"),
    energizing: num("energizing"),
    expansive: num("expansive"),
    intimate: num("intimate"),
  };
}

function parseInteractions(
  raw: unknown,
): ResolveRetreatVisionInput["interactions"] {
  if (!Array.isArray(raw)) return undefined;
  const items: NonNullable<ResolveRetreatVisionInput["interactions"]> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.imageId !== "string") continue;
    if (e.reaction !== "resonate" && e.reaction !== "skip") continue;
    items.push({ imageId: e.imageId, reaction: e.reaction });
  }
  return items.length > 0 ? items : undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      vector?: unknown;
      intention?: string;
      interactions?: unknown;
    };

    const artifact = resolveRetreatVision({
      vector: parseVector(body.vector),
      intention: body.intention,
      interactions: parseInteractions(body.interactions),
    });

    return NextResponse.json(artifact);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vision could not be resolved.",
      },
      { status: 500 },
    );
  }
}
