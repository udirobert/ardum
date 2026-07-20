// CLI seed: POSTs the seed Bali retreat attestations to the running app's
// /api/attestations/seed endpoint. Use after `npm run dev`.
//
//   npm run seed                 # seeds against http://localhost:3000
//   npm run seed -- https://ardum.famile.xyz

const baseUrl = process.argv[2] ?? "http://localhost:3000";

async function main() {
  const url = `${baseUrl.replace(/\/$/, "")}/api/attestations/seed`;
  console.log(`Seeding attestations via POST ${url}`);
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    console.error(`Seed failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const json = await res.json();
  console.log(`Seeded ${json.seeded.length} attestations.`);
  for (const s of json.seeded) {
    console.log(`  ${s.rootHash}  → ${s.storedOn}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
