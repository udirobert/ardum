import "server-only";

// Direct ATRIP API adapter — talks to the Atlas sandbox/production API
// over HTTP using x-atlas-client-id / x-atlas-client-secret headers.
//
// This is the "standard platform integration" path (Path 01 in the
// hackathon brief) and does not require the `atlas-flight` Python CLI.
// The CLI adapter (cli.ts) wraps the same search capability but shells
// out to a Python binary with browser-based OAuth. This module lets the
// agent flow search flights with only server-side env vars.
//
// API contract: https://resources.atriptech.com/api-document/readme-1/making-requests.md
// Search endpoint: POST https://sandbox.atriptech.com/search.do
//
// Required env (either naming is fine):
//   ATLAS_CLIENT_ID / ATLAS_CLIENT_SECRET — ATRIP standard names
//   ATLAS_ACCESS_KEY / ATLAS_SECRET_KEY   — hackathon pack names (preferred)
//
// When unset, searchFlights throws a clear configuration error so the
// agent flow can degrade gracefully (the flights route returns 503).

const SANDBOX_BASE = "https://sandbox.atriptech.com";

/** ATRIP envelope: status 0 = success, non-zero = error. */
type AtripSearchResponse = {
  status: number;
  msg: string;
  routings?: AtripRouting[];
};

/** One routing (offer) from the search response. */
export type AtripRouting = {
  routingIdentifier: string;
  currency: string;
  adultPrice: number;
  adultTax: number;
  transactionFee: number;
  transactionFeeMode?: string;
  fromSegments: AtripSegment[];
  retSegments?: AtripSegment[];
  rule?: {
    hasBaggage: number;
    refundRules?: unknown[];
    changesRules?: unknown[];
  };
};

export type AtripSegment = {
  carrier: string;
  flightNumber: string;
  depAirport: string;
  arrAirport: string;
  depTime: string;
  arrTime: string;
  stopCities: string | null;
  cabin: string;
  aircraftCode?: string;
};

/** Normalized offer — matches the AtlasOffer shape from cli.ts. */
export type AtlasOffer = {
  offer_id: string;
  search_id: string;
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  depart_time: string;
  arrive_time: string;
  duration_minutes: number;
  stops: number;
  total_price: number;
  currency: string;
  price_status: "current" | "reference";
  bookable: boolean;
  cabin: string;
  segments?: Array<{
    segment_id: string;
    airline: string;
    flight_number: string;
    origin: string;
    destination: string;
    depart_time: string;
    arrive_time: string;
    aircraft?: string;
  }>;
};

export type AtlasSearchResult = {
  search_id: string;
  offers: AtlasOffer[];
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string;
  adults: number;
};

/** True when ATRIP credentials are configured. */
export function isAtripConfigured(): boolean {
  return Boolean(atlasClientId() && atlasClientSecret());
}

function atlasClientId(): string | undefined {
  return process.env.ATLAS_CLIENT_ID ?? process.env.ATLAS_ACCESS_KEY;
}

function atlasClientSecret(): string | undefined {
  return process.env.ATLAS_CLIENT_SECRET ?? process.env.ATLAS_SECRET_KEY;
}

function atripBase(): string {
  return process.env.ATLAS_API_BASE ?? SANDBOX_BASE;
}

/**
 * Search flights via the ATRIP search.do endpoint.
 *
 * @param params.origin — IATA code (e.g. "KUL")
 * @param params.destination — IATA code (e.g. "DPS")
 * @param params.departDate — "YYYY-MM-DD" (converted to YYYYMMDD)
 * @param params.adults — passenger count (1-9)
 * @param params.returnDate — optional "YYYY-MM-DD" for round-trip
 * @param params.currency — optional settlement currency (e.g. "USD")
 */
export async function searchFlightsViaAtrip(params: {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  adults?: number;
  returnDate?: string; // YYYY-MM-DD
  currency?: string;
}): Promise<AtlasSearchResult> {
  const clientId = atlasClientId();
  const clientSecret = atlasClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "ATLAS_CLIENT_ID and ATLAS_CLIENT_SECRET (or ATLAS_ACCESS_KEY and ATLAS_SECRET_KEY) must be set for direct ATRIP flight search.",
    );
  }

  const adults = params.adults ?? 1;
  const fromDate = params.departDate.replace(/-/g, ""); // YYYYMMDD
  const isRoundTrip = Boolean(params.returnDate);
  const retDate = params.returnDate?.replace(/-/g, "");

  // ATRIP requires childNum and infantNum even when 0.
  const body: Record<string, unknown> = {
    tripType: isRoundTrip ? "2" : "1",
    adultNum: adults,
    childNum: 0,
    infantNum: 0,
    fromCity: params.origin.toUpperCase(),
    toCity: params.destination.toUpperCase(),
    fromDate,
  };
  if (isRoundTrip && retDate) body.retDate = retDate;
  if (params.currency) body.currency = params.currency;

  let resp: Response;
  try {
    resp = await fetch(`${atripBase()}/search.do`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        "Accept-Encoding": "gzip",
        "x-atlas-client-id": clientId,
        "x-atlas-client-secret": clientSecret,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `ATRIP search request failed: ${err instanceof Error ? err.message : "network error"}`,
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `ATRIP search returned HTTP ${resp.status}: ${text.slice(0, 200)}`,
    );
  }

  const data = (await resp.json()) as AtripSearchResponse;
  if (data.status !== 0) {
    throw new Error(
      `ATRIP search error (status ${data.status}): ${data.msg || "unknown"}`,
    );
  }

  const routings = data.routings ?? [];
  const searchId = `atrip-${Date.now()}`;

  const offers: AtlasOffer[] = routings.map((r) => {
    const seg = r.fromSegments?.[0];
    const lastSeg = r.fromSegments?.[r.fromSegments.length - 1];
    const totalPrice = r.adultPrice + r.adultTax + (r.transactionFee ?? 0);
    const stops = Math.max(0, (r.fromSegments?.length ?? 1) - 1);
    return {
      offer_id: r.routingIdentifier,
      search_id: searchId,
      airline: seg?.carrier ?? "",
      flight_number: seg?.flightNumber ?? "",
      origin: seg?.depAirport ?? params.origin,
      destination: lastSeg?.arrAirport ?? params.destination,
      depart_time: seg?.depTime ?? "",
      arrive_time: lastSeg?.arrTime ?? "",
      duration_minutes: 0, // ATRIP doesn't return duration directly; compute from times if needed
      stops,
      total_price: Math.round(totalPrice * 100) / 100,
      currency: r.currency,
      price_status: "current",
      bookable: true,
      cabin: seg?.cabin ?? "Economy",
      segments: r.fromSegments?.map((s, si) => ({
        segment_id: `${r.routingIdentifier}-seg${si}`,
        airline: s.carrier,
        flight_number: s.flightNumber,
        origin: s.depAirport,
        destination: s.arrAirport,
        depart_time: s.depTime,
        arrive_time: s.arrTime,
        aircraft: s.aircraftCode,
      })),
    };
  });

  return {
    search_id: searchId,
    offers,
    origin: params.origin.toUpperCase(),
    destination: params.destination.toUpperCase(),
    depart_date: params.departDate,
    return_date: params.returnDate,
    adults,
  };
}
