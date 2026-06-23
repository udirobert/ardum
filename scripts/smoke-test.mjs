// Direct smoke test of the 0G Compute Router
const BASE = process.env.OG_COMPUTE_ROUTER_URL;
const KEY = process.env.OG_COMPUTE_API_KEY;
const MODEL = process.env.OG_COMPUTE_MODEL || "deepseek-v4-flash";

if (!BASE || !KEY) {
  console.error("Usage: OG_COMPUTE_ROUTER_URL=... OG_COMPUTE_API_KEY=... node scripts/smoke-test.mjs");
  process.exit(1);
}

const body = {
  model: MODEL,
  messages: [
    { role: "system", content: "You are a retreat matching agent. Return JSON. Score each retreat on fit for the user." },
    { role: "user", content: JSON.stringify({
      brand: "Stressed executive seeking calm",
      retreats: [
        { id: "r1", name: "Ubud Bliss", location: "Bali", vibe: "wellness", minDuration: 7, maxDuration: 14 }
      ]
    }) },
  ],
  response_format: { type: "json_object" },
};

const res = await fetch(`${BASE}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${KEY}` },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const content = data.choices?.[0]?.message?.content;
console.log("Model:", data.model);
console.log("Usage:", JSON.stringify(data.usage));
console.log("Response:", content?.slice(0, 500));
