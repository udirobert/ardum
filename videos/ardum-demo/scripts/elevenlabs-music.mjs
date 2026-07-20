// Generate music with ElevenLabs Music API
import fs from "fs";
import path from "path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("ELEVENLABS_API_KEY not set"); process.exit(1); }

const prompt = "A warm, uplifting ambient electronic track for a tech product demo video. Starts calm and curious with soft synth pads, builds gradually with light percussion and a gentle melodic motif, then lifts into an inspiring, hopeful section with warm bass and shimmering textures. Ends with a soft, resolved fade. No vocals. Cinematic, modern, optimistic. 80 bpm.";

const outFile = path.join(path.dirname(process.argv[1]), "..", "audio", "bgm-eleven.mp3");
fs.mkdirSync(path.dirname(outFile), { recursive: true });

console.log("Generating music with ElevenLabs Music API...");
console.log(`Prompt: ${prompt.slice(0, 80)}...`);

const response = await fetch("https://api.elevenlabs.io/v1/music", {
  method: "POST",
  headers: {
    "xi-api-key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt,
    music_length_ms: 80000,
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
