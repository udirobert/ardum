"use client";

// Home page — the new arrival-first structure.
//
// Old structure: hero → "how it works" explainer → Intake form
// New structure: ArrivalScreen (Mira orb + cloud field + one question) → Intake
//
// The "how it works" explainer is gone. Trust is earned by doing, not reading.
// The practitioner arrives to Mira, not to copy about Mira.
//
// State machine:
//   "arriving"  — ArrivalScreen is visible; Intake is hidden below
//   "intake"    — ArrivalScreen fades out; Intake slides up and becomes active
//
// The Intake is mounted immediately (for perf / fingerprint access) but
// visually hidden until the practitioner clicks "Begin" on the arrival screen.

import { useState } from "react";
import Intake from "@/calibration/Intake";
import ArrivalScreen from "@/components/ArrivalScreen";

type Phase = "arriving" | "intake";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("arriving");

  return (
    <div className="relative">
      {/* ── Arrival screen ───────────────────────────────────────────── */}
      {/* Hidden once the practitioner clicks Begin, not unmounted — keeps
          the cloud WebGL context warm and avoids a layout jump. */}
      <div
        style={{
          display: phase === "intake" ? "none" : "block",
        }}
      >
        <ArrivalScreen
          onBegin={() => {
            setPhase("intake");
            // Scroll to intake smoothly, accounting for the layout header.
            requestAnimationFrame(() => {
              const el = document.getElementById("intake");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
        />
      </div>

      {/* ── Intake ───────────────────────────────────────────────────── */}
      {/* Always mounted so fingerprint reads and Cognee fetch happen early.
          Slides in from below when phase === "intake". */}
      <div
        id="intake"
        style={
          phase === "arriving"
            ? {
                // Visually hidden but in the DOM — allows smooth scroll target
                // and keeps the component warm. aria-hidden so screen readers
                // skip it until the practitioner is ready.
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
                position: "absolute",
                width: "100%",
                top: "100vh",
              }
            : {
                // Slide up from below with a gentle ease.
                animation: "arrival-slide-up 600ms cubic-bezier(0.22,1,0.36,1) both",
              }
        }
        aria-hidden={phase === "arriving"}
      >
        <Intake />
      </div>
    </div>
  );
}
