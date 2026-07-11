import { NextResponse } from "next/server";
import { runDueAutomation } from "@/automation/runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configured = process.env.AUTOMATION_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || supplied !== configured) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(await runDueAutomation());
}
