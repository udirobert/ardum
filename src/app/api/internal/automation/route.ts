import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueAutomation } from "@/automation/runner";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  const configured = process.env.AUTOMATION_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied || !safeEqual(supplied, configured)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  // Structured response — see scripts/verify-automation.mjs. The
  // shape is purposefully boring so external monitors (Upptime,
  // cron-job.org's health probes, GitHub Actions' own run summary)
  // can extract `considered` / `checked` / `failed` without
  // parsing free-form logs.
  const startedAt = new Date().toISOString();
  const result = await runDueAutomation();
  const finishedAt = new Date().toISOString();
  const durationMs =
    Date.parse(finishedAt) - Date.parse(startedAt);
  return NextResponse.json({
    ...result,
    // checked + failed is the union of episodes the runner ATTEMPTED,
    // even if some failed mid-tick. Use this as the denominator when
    // reasoning about automation health — checked alone hides failures.
    considered: result.checked + result.failed,
    startedAt,
    finishedAt,
    durationMs,
  });
}
