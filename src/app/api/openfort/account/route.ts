import { NextResponse } from "next/server";
import { readServerEnv } from "@/lib/env";

// Openfort account creation + sponsored transaction endpoint.
//
// POST /api/openfort/account
// Body: { action: "create" } → creates a new Openfort account (gasless)
// Body: { action: "sign", accountId, tx } → signs + sponsors a transaction
//
// Uses the Openfort REST API directly (no SDK needed server-side).
// Settles on Base Sepolia (testnet only).

export const dynamic = "force-dynamic";

const OPENFORT_API_BASE = "https://api.openfort.xyz/v1";

export async function POST(req: Request) {
  const env = readServerEnv();

  if (!env.OPENFORT_SECRET_KEY) {
    return NextResponse.json(
      { error: "Openfort not configured. Set OPENFORT_SECRET_KEY." },
      { status: 503 },
    );
  }

  let body: { action: string; accountId?: string; tx?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.OPENFORT_SECRET_KEY}`,
  };

  try {
    if (body.action === "create") {
      // Create a new Openfort account (embedded wallet)
      const res = await fetch(`${OPENFORT_API_BASE}/accounts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chainId: 84532, // Base Sepolia
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json(
          { error: `Openfort create failed: ${err}` },
          { status: res.status },
        );
      }

      const data = await res.json();
      return NextResponse.json({
        accountId: data.id,
        address: data.address,
      });
    }

    if (body.action === "sign" && body.accountId && body.tx) {
      // Sign + sponsor a transaction via Openfort
      // The policy ID sponsors gas on Base Sepolia
      const policyId = process.env.NEXT_PUBLIC_OPENFORT_POLICY_ID ?? "";
      const res = await fetch(
        `${OPENFORT_API_BASE}/accounts/${body.accountId}/transaction_intents`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            chainId: 84532,
            transaction: body.tx,
            policy: policyId || undefined,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json(
          { error: `Openfort sign failed: ${err}` },
          { status: res.status },
        );
      }

      const data = await res.json();
      return NextResponse.json({
        txHash: data.transaction_hash,
        status: data.status,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'create' or 'sign'." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Openfort request failed.",
      },
      { status: 500 },
    );
  }
}
