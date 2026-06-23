import { NextResponse, type NextRequest } from "next/server";
import { getMatchRun, getProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

// Returns the match run (and profile, for the header) for a given session.
// The match page polls this briefly on mount; the run is already saved by
// the POST to /api/agent/match, so the first poll should succeed.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  const run = getMatchRun(sessionId);
  if (!run) {
    return NextResponse.json(
      { error: "Run not ready yet." },
      { status: 404 }
    );
  }
  return NextResponse.json({
    run,
    profile: getProfile(sessionId),
  });
}
