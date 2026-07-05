"use client";

// Home page — the arrival-first structure.
//
// State machine:
//   "arriving"  — ArrivalScreen is visible (Mira orb + cloud field + question)
//   "intake"    — ArrivalScreen unmounts; Intake slides up with its own cloud
//                 atmosphere (The Reading) that shifts as answers arrive.
//
// The Intake is mounted immediately (for fingerprint / Cognee access) but
// its cloud field only activates when it becomes the active phase — avoids a
// second WebGL context running during the arrival screen.

import { useState } from "react";
import Intake from "@/calibration/Intake";
import ArrivalScreen from "@/components/ArrivalScreen";

type Phase = "arriving" | "intake";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("arriving");

  return (
    <div className="relative">
      {/* ── Arrival screen ───────────────────────────────────────────── */}
      {/* Unmounted once the practitioner clicks Begin — its cloud context
          is released and the Intake's own atmosphere takes over. */}
      {phase === "arriving" && (
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
      )}

      {/* ── Intake ───────────────────────────────────────────────────── */}
      {/* Always mounted so fingerprint reads and Cognee fetch happen early.
          Slides in from below when phase === "intake". The `active` prop
          gates the cloud field so it only mounts when the intake is visible. */}
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
        <Intake active={phase === "intake"} />
      </div>
    </div>
  );
}
