// fal.ai retreat vision generation — Tier 2 of the aesthetic system.
//
// Generates ONE custom image based on the user's accumulated aesthetic
// preferences. This is the only real-time fal.ai call during the match
// flow — the curated pool (Tier 1) does all the heavy lifting.
//
// The prompt is constructed from the user's dominant aesthetic qualities
// + the retreat's location and practice style, producing a "retreat
// vision" that feels personally crafted.
//
// Token efficiency: 1 call per match, not per interaction. The curated
// pool handles ~8 interactions for zero cost.

import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AestheticVector = {
  ocean: number; mountain: number; jungle: number; desert: number; forest: number;
  warm: number; cool: number; minimal: number; ornate: number; light: number; dark: number;
  calming: number; energizing: number; expansive: number; intimate: number;
};

function buildPrompt(
  vector: AestheticVector,
  retreatTitle: string,
  location: string,
  practiceStyle: string[],
): string {
  // Extract dominant qualities
  const env = [
    { label: "ocean coastline", value: vector.ocean },
    { label: "mountain peaks", value: vector.mountain },
    { label: "lush jungle", value: vector.jungle },
    { label: "desert dunes", value: vector.desert },
    { label: "old-growth forest", value: vector.forest },
  ].sort((a, b) => b.value - a.value)[0];

  const tone = vector.warm > vector.cool ? "warm golden" : "cool blue";
  const light = vector.light > vector.dark ? "bright natural light" : "soft moody light";
  const mood = vector.calming > vector.energizing ? "serene and meditative" : "vibrant and alive";
  const space = vector.expansive > vector.intimate ? "expansive open" : "intimate enclosed";
  const style = vector.minimal > vector.ornate ? "minimalist" : "richly textured";

  const practice = practiceStyle.slice(0, 2).join(" and ") || "yoga";

  return `A ${style} retreat setting in ${location}, designed for ${practice} practice. ` +
    `${env.label} in the background, ${tone} color palette, ${light}, ` +
    `${mood} atmosphere, ${space} composition. ` +
    `No people, no text. Cinematic, photographic quality, soft focus edges. ` +
    `The image should evoke the feeling of arriving at a place where ` +
    `you can finally exhale.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      vector: AestheticVector;
      retreatTitle: string;
      location: string;
      practiceStyle: string[];
    };

    if (!body.vector || !body.retreatTitle) {
      return NextResponse.json(
        { error: "Missing vector or retreat info" },
        { status: 400 },
      );
    }

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      // Fallback: return a curated image URL based on dominant quality
      const dominantEnv = [
        { label: "ocean", value: body.vector.ocean, url: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=70&auto=format&fit=crop" },
        { label: "mountain", value: body.vector.mountain, url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=70&auto=format&fit=crop" },
        { label: "jungle", value: body.vector.jungle, url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=70&auto=format&fit=crop" },
        { label: "desert", value: body.vector.desert, url: "https://images.unsplash.com/photo-1473580044384-34fe828d2e6f?w=800&q=70&auto=format&fit=crop" },
        { label: "forest", value: body.vector.forest, url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70&auto=format&fit=crop" },
      ].sort((a, b) => b.value - a.value)[0];

      return NextResponse.json({
        url: dominantEnv.url,
        fallback: true,
        prompt: buildPrompt(body.vector, body.retreatTitle, body.location, body.practiceStyle),
      });
    }

    fal.config({ credentials: apiKey });

    const prompt = buildPrompt(body.vector, body.retreatTitle, body.location, body.practiceStyle);

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: "landscape_16_9",
        num_inference_steps: 4, // schnell is fast — 4 steps is enough
      },
    });

    const imageUrl = (result.data as { images: { url: string }[] }).images?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Generation produced no image" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: imageUrl,
      prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
