import { NextResponse } from "next/server";
import { readServerEnv } from "@/lib/env";

// Magic Server Wallet (TEE) endpoint.
//
// POST /api/magic/wallet
// Body: { jwt: string }  — JWT from your auth provider (Google OIDC, etc.)
// Returns: { public_address: string } — the practitioner's embedded wallet
//
// This is the server-side wallet creation path described in Magic's
// Server Wallet docs (tee.express.magiclabs.com/v1/wallet). It's an
// alternative to the client-side connectWithUI() flow — works without
// an iframe, and is the pattern used in the Particle UA + Magic demo.
//
// Requires:
//   MAGIC_SECRET_KEY — server-only, never exposed to client
//   MAGIC_OIDC_PROVIDER_ID — set up via the identity provider endpoint
//
// To set up the OIDC provider (one-time):
//   curl -X POST 'https://tee.express.magiclabs.com/v1/identity/provider' \
//     -H 'Content-Type: application/json' \
//     -H 'X-Magic-Secret-Key: <MAGIC_SECRET_KEY>' \
//     -d '{ "issuer": "https://accounts.google.com", ... }'

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const env = readServerEnv();

  if (!env.MAGIC_SECRET_KEY) {
    return NextResponse.json(
      { error: "Magic server wallet not configured. Set MAGIC_SECRET_KEY." },
      { status: 503 },
    );
  }

  let body: { jwt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { jwt } = body;
  if (!jwt) {
    return NextResponse.json(
      { error: "Missing JWT in request body." },
      { status: 400 },
    );
  }

  if (!env.MAGIC_OIDC_PROVIDER_ID) {
    return NextResponse.json(
      {
        error:
          "Missing MAGIC_OIDC_PROVIDER_ID. Set up an OIDC provider first via the Magic API.",
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch("https://tee.express.magiclabs.com/v1/wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        "X-Magic-Secret-Key": env.MAGIC_SECRET_KEY,
        "X-OIDC-Provider-ID": env.MAGIC_OIDC_PROVIDER_ID,
        "X-Magic-Chain": "ETH",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Magic wallet API error: ${errText}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      public_address: data.public_address,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Magic wallet request failed.",
      },
      { status: 500 },
    );
  }
}
