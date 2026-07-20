// Generate music with ElevenLabs Music API — with a build/ramp structure
import fs from "fs";
import path from "path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("ELEVENLABS_API_KEY not set"); process.exit(1); }

// Prompt that creates a track with a gradual build
const prompt = "A warm cinematic ambient track for a product demo video that builds gradually. Starts very soft and sparse with just a gentle synth pad and subtle atmosphere — almost silent. At around 20 seconds, introduce a light melodic motif with soft percussion. At around 40 seconds, add warm bass and shimmering textures, lifting into an inspiring, hopeful section. At around 60 seconds, reach a gentle peak with full but soft instrumentation. End with a soft resolved fade. No vocals. Cinematic, modern, optimistic, understated. 85 bpm. The track should feel like it's slowly waking up and coming to life.";

const outFile = path.join(path.dirname(process.argv[1]), "..", "audio", "bgm-ramp.mp3");

console.log("Generating ramp-up music with ElevenLabs Music API...");

const response = await fetch("https://api.elevenlabs.io/v1/music", {
  method: "POST",
  headers: {
    "xi-api-key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt,
    music_length_ms: 90000,
    model_id: "music_v2",
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error(`ElevenLabs Music API error: ${response.status} ${err}`);
  process.exit(1);
}

const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync(outFile, buffer);
console.log(`\nMusic saved: ${outFile} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
