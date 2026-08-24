import { NextResponse } from "next/server";
import { isCliAvailable, getAuthStatus, searchFlights } from "@/atlas/cli";
import { isAtripConfigured, searchFlightsViaAtrip } from "@/atlas/atrip";

export const dynamic = "force-dynamic";

// Agent-callable flight search endpoint (Atlas Flight Booking Skill).
//
// Two integration paths (per the hackathon brief):
//   Path 01 — Direct ATRIP API (x-atlas-client-id / x-atlas-client-secret)
//   Path 02 — atlas-flight CLI (browser-based OAuth)
//
// When ATLAS_CLIENT_ID + ATLAS_CLIENT_SECRET are set, the direct ATRIP API
// is used — no Python CLI dependency, no browser OAuth. This is the
// primary path for serverless / agent deployments.
//
// When the env vars are absent, the route falls back to the CLI adapter,
// which manages its own authorization via browser-based ATRIP OAuth.
//
// Request:
//   {
//     "origin": "KUL",        // IATA code
//     "destination": "DPS",   // IATA code
//     "departDate": "2026-09-15",
//     "adults": 1,
//     "returnDate": "2026-09-22",  // optional
//     "currency": "USD"            // optional
//   }
//
// Response (200):
//   {
//     "search_id": "...",
//     "offers": [{ offer_id, airline, flight_number, ... }],
//     "auth": { authenticated, ticketing_available }
//   }
//
// Response (401 — authorization required):
//   {
//     "auth": { authenticated: false },
//     "authorization_url": "https://www.atriptech.com/...",
//     "message": "Atlas authorization required. Visit the URL, then retry."
//   }

type FlightsRequest = {
  origin?: string;
  destination?: string;
  departDate?: string;
  adults?: number;
  returnDate?: string;
  currency?: string;
};

function isIataCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

function isDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  let body: FlightsRequest;
  try {
    body = (await req.json()) as FlightsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { origin, destination, departDate } = body;
  const adults = body.adults ?? 1;

  // Validate
  const missing: string[] = [];
  if (!origin) missing.push("origin");
  if (!destination) missing.push("destination");
  if (!departDate) missing.push("departDate");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }
  if (!isIataCode(origin!) || !isIataCode(destination!)) {
    return NextResponse.json(
      { error: "origin and destination must be 3-letter IATA codes." },
      { status: 400 },
    );
  }
  if (!isDateString(departDate!)) {
    return NextResponse.json(
      { error: "departDate must be YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (adults < 1 || adults > 9) {
    return NextResponse.json(
      { error: "adults must be 1-9." },
      { status: 400 },
    );
  }

  // ── Primary: direct ATRIP API (server-side credentials, no CLI) ────
  if (isAtripConfigured()) {
    try {
      const result = await searchFlightsViaAtrip({
        origin: origin!,
        destination: destination!,
        departDate: departDate!,
        adults,
        returnDate: body.returnDate,
        currency: body.currency,
      });

      return NextResponse.json({
        search_id: result.search_id,
        offers: result.offers,
        origin: result.origin,
        destination: result.destination,
        depart_date: result.depart_date,
        return_date: result.return_date,
        adults: result.adults,
        provider: "atrip",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Flight search failed.";
      return NextResponse.json({ error: message, provider: "atrip" }, { status: 502 });
    }
  }

  // ── Fallback: atlas-flight CLI (browser-based ATRIP OAuth) ────────
  const cliReady = await isCliAvailable();
  if (!cliReady) {
    return NextResponse.json(
      {
        error:
          "Neither direct ATRIP credentials nor the atlas-flight CLI are available. Set ATLAS_CLIENT_ID + ATLAS_CLIENT_SECRET, or run: uv tool install --force --python 3.12 atlas-flight-booking==0.3.12 && atlas-flight auth login",
      },
      { status: 503 },
    );
  }

  // Check auth status — pass search params through even if ticketing is
  // unavailable (comparison-only offers still have value).
  const auth = await getAuthStatus().catch(() => ({
    authenticated: false,
    ticketing_available: false,
  }));

  if (!auth.authenticated) {
    // Return the auth status with the search not attempted. The caller can
    // start the login flow and retry. We don't auto-start login because the
    // caller may want to handle the redirect differently (agent vs browser).
    return NextResponse.json(
      {
        auth: { authenticated: false },
        message:
          "Atlas authorization required. Run atlas-flight auth login to get the URL.",
        hint: "GET /api/agent/flights for service discovery and auth instructions.",
      },
      { status: 401 },
    );
  }

  // Search
  try {
    const result = await searchFlights({
      origin: origin!,
      destination: destination!,
      departDate: departDate!,
      adults,
      returnDate: body.returnDate,
      currency: body.currency,
    });

    return NextResponse.json({
      search_id: result.search_id,
      offers: result.offers,
      origin: result.origin,
      destination: result.destination,
      depart_date: result.depart_date,
      return_date: result.return_date,
      adults: result.adults,
      auth: {
        authenticated: true,
        ticketing_available: auth.ticketing_available ?? false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Flight search failed.";
    return NextResponse.json(
      { error: message, auth: { authenticated: true } },
      { status: 502 },
    );
  }
}

// GET — service discovery
export async function GET() {
  return NextResponse.json({
    service: "ardum-agent-flights",
    description:
      "Search live flights via the Atlas Flight Booking CLI. Agent-callable endpoint for integrating flight discovery into the retreat-booking flow.",
    type: "free",
    endpoint: "POST /api/agent/flights",
    requestSchema: {
      origin: "string (required) — 3-letter IATA code (e.g. KUL)",
      destination: "string (required) — 3-letter IATA code (e.g. DPS)",
      departDate: "string (required) — YYYY-MM-DD",
      adults: "number (optional, default 1) — 1-9",
      returnDate: "string (optional) — YYYY-MM-DD for round-trip",
      currency: "string (optional) — e.g. USD, MYR",
    },
    responseSchema: {
      search_id: "string — Atlas opaque search ID",
      offers: "array — normalized flight offers with offer_id, price, airline, etc.",
      auth: "object — { authenticated, ticketing_available }",
    },
    auth: "No signature required. The atlas-flight CLI manages its own ATRIP authorization (browser-based). If not authorized, POST returns 401 with instructions.",
    prerequisite: "atlas-flight CLI must be installed and authorized on the server.",
    flow: "1. Agent calls /api/agent/match → retreat matched. 2. Agent calls /api/agent/flights → flights to retreat destination. 3. Agent calls /api/agent/book → on-chain deposit + attestation.",
  });
}
