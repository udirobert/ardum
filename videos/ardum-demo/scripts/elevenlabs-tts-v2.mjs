// Generate voiceover with ElevenLabs API — female voice, storytelling tone
import fs from "fs";
import path from "path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("ELEVENLABS_API_KEY not set"); process.exit(1); }

// Sarah — Mature, Reassuring, Confident (female, American)
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const MODEL = "eleven_turbo_v2_5";

// Storytelling script — less technical, more human, highlights differentiators
const text = `Picture this. You're burned out. You know you need a retreat — not just a vacation, but something that actually fits where you are in your life.

But every travel site asks the same question: where do you want to go? Dates? Budget? Filters?

You don't know where. You know what you need.

That's where Ardum starts. You tell Mira — your AI guide — what you're trying to make space for. She listens. She asks the right questions. Energy, solitude, budget. And then she recommends one retreat. Not a list of fifty. One.

Here's where it gets interesting. Mira doesn't just find retreats — she can actually book them for you. Sign in with Google. Confirm the deposit. Done. No wallet setup, no gas fees, no crypto knowledge required. It just works.

And it's not just for humans. Any AI agent can use Ardum's API to book retreats autonomously. Capture an intention, find a match, place a deposit on-chain, sign the attestation. We proved it — one USDC deposited to escrow on Arbitrum, verified on-chain.

Ardum is booking infrastructure for the agent economy. Any agent, any user, zero crypto friction.

The shape of your practice.`;

const outFile = path.join(path.dirname(process.argv[1]), "..", "audio", "voiceover-v2.mp3");

console.log("Generating voiceover with ElevenLabs...");
console.log(`Voice: Sarah (${VOICE_ID}) — Mature, Reassuring, Confident`);
console.log(`Text length: ${text.length} chars`);

const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
  method: "POST",
  headers: {
    "xi-api-key": API_KEY,
    "Content-Type": "application/json",
    "Accept": "audio/mpeg",
  },
  body: JSON.stringify({
    text,
    model_id: MODEL,
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
    },
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error(`ElevenLabs API error: ${response.status} ${err}`);
  process.exit(1);
}

const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync(outFile, buffer);
console.log(`\nVoiceover saved: ${outFile} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
