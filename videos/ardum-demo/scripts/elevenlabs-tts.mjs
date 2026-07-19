// Generate voiceover with ElevenLabs API
// Usage: ELEVENLABS_API_KEY=... node scripts/elevenlabs-tts.mjs

import fs from "fs";
import path from "path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("ELEVENLABS_API_KEY not set"); process.exit(1); }

// Voice: "Adam" — calm, confident narrator
const VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam
const MODEL = "eleven_turbo_v2_5";

// The full script as one continuous narration
const text = `Most travel products start with inventory. Where do you want to go?

Ardum starts with intention. What are you trying to make space for?

You tell Mira what you need. She clarifies — energy, budget, solitude or cohort. She recommends one retreat. Not a list — one.

When you're ready, you grant authority. Not a checkout — a grant. Mira handles the rest. Magic login, Particle Universal Account, cross-chain deposit to escrow. You never see a wallet, a chain name, or pay gas.

But here's the bigger story. Any AI agent can use Ardum's API to book retreats autonomously. Capture intention. Clarify. Recommend. Hold. Execute on-chain deposit. Sign attestation. Booked.

This is real. One USDC deposited to escrow on Arbitrum Sepolia. Verified on-chain.

Ardum is booking infrastructure for the agent economy. Any agent. Any user. Zero crypto friction.`;

const outDir = path.dirname(process.argv[1]);
const outFile = path.join(outDir, "..", "audio", "voiceover.mp3");

fs.mkdirSync(path.dirname(outFile), { recursive: true });

console.log("Generating voiceover with ElevenLabs...");
console.log(`Voice: Adam (${VOICE_ID})`);
console.log(`Model: ${MODEL}`);
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
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
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
