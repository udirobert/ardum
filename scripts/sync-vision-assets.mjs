#!/usr/bin/env node
/**
 * One-time sync of curated vision assets into public/aesthetics/visions/.
 * Run after changing IMAGE_POOL sources — not part of runtime.
 *
 *   node scripts/sync-vision-assets.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "aesthetics", "visions");

const ASSETS = [
  { id: "bali-ocean", url: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&q=80&auto=format&fit=crop" },
  { id: "mountain-mist", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80&auto=format&fit=crop" },
  { id: "jungle-canopy", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80&auto=format&fit=crop" },
  { id: "desert-dunes", url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80&auto=format&fit=crop" },
  { id: "forest-stream", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80&auto=format&fit=crop" },
  { id: "minimal-studio", url: "https://images.unsplash.com/photo-1593810451137-5dc55105dace?w=1600&q=80&auto=format&fit=crop" },
  { id: "tropical-sunset", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80&auto=format&fit=crop" },
  { id: "alpine-lake", url: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1600&q=80&auto=format&fit=crop" },
  { id: "temple-stone", url: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=1600&q=80&auto=format&fit=crop" },
  { id: "desert-night", url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600&q=80&auto=format&fit=crop" },
  { id: "rice-terraces", url: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1600&q=80&auto=format&fit=crop" },
  { id: "nordic-fjord", url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&q=80&auto=format&fit=crop" },
];

fs.mkdirSync(outDir, { recursive: true });

for (const asset of ASSETS) {
  const dest = path.join(outDir, `${asset.id}.jpg`);
  if (fs.existsSync(dest)) {
    console.log(`skip ${asset.id} (exists)`);
    continue;
  }
  console.log(`fetch ${asset.id}…`);
  const res = await fetch(asset.url);
  if (!res.ok) {
    console.error(`failed ${asset.id}: ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`wrote ${dest} (${buf.length} bytes)`);
}

console.log("done");
