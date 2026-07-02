import { NextResponse } from "next/server";
import { verifyMessage } from "ethers";

// x402 payment-gated class access endpoint.
//
// GET  → returns 402 Payment Required with payment requirements
// POST → verifies payment signature, grants access, returns tx hash
//
// In production, the POST handler would:
//   1. Verify the EIP-3009 TransferWithAuthorization signature
//   2. Submit to a facilitator (Coinbase CDP) for on-chain settlement
//   3. Return the on-chain tx hash
//
// For the hackathon demo, we verify the personal_sign signature and
// simulate the payment settlement.

export const dynamic = "force-dynamic";

const CLASS_PRICE_USD = 25; // default drop-in class price

export async function GET(req: Request) {
  const url = new URL(req.url);
  const retreat = url.searchParams.get("retreat");
  if (!retreat) {
    return NextResponse.json(
      { error: "Missing retreat parameter." },
      { status: 400 },
    );
  }

  // x402: return 402 Payment Required with payment requirements
  return NextResponse.json(
    {
      error: "Payment Required",
      paymentRequirements: {
        amount: CLASS_PRICE_USD.toString(),
        token: "USDC",
        chainId: 421614, // Arbitrum Sepolia
        description: `Drop-in class access for retreat ${retreat.slice(0, 16)}`,
      },
      payTo: "0x0000000000000000000000000000000000000000", // platform address
    },
    { status: 402 },
  );
}

export async function POST(req: Request) {
  let body: {
    retreat: string;
    payer: string;
    paymentIntent: string;
    signature: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { retreat, payer, paymentIntent, signature } = body;
  if (!retreat || !payer || !paymentIntent || !signature) {
    return NextResponse.json(
      { error: "Missing payment fields." },
      { status: 400 },
    );
  }

  // Verify the signature recovers to the payer
  let recovered: string;
  try {
    recovered = verifyMessage(paymentIntent, signature);
  } catch {
    return NextResponse.json(
      { error: "Invalid payment signature." },
      { status: 400 },
    );
  }

  if (recovered.toLowerCase() !== payer.toLowerCase()) {
    return NextResponse.json(
      { error: "Signature does not match payer." },
      { status: 403 },
    );
  }

  // Verify the payment intent matches the retreat
  let intent: { retreat?: string; amount?: string };
  try {
    intent = JSON.parse(paymentIntent);
  } catch {
    return NextResponse.json(
      { error: "Invalid payment intent." },
      { status: 400 },
    );
  }

  if (intent.retreat !== retreat) {
    return NextResponse.json(
      { error: "Payment intent retreat mismatch." },
      { status: 400 },
    );
  }

  // In production: submit to x402 facilitator for on-chain settlement.
  // For the demo, we simulate a successful payment.
  const txHash = `0x${Math.random().toString(16).slice(2).padStart(64, "0")}`;

  return NextResponse.json({
    ok: true,
    txHash,
    retreat,
    payer: recovered,
    amount: intent.amount,
  });
}
