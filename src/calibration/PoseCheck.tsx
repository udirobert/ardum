"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseBaseline } from "./schema";
import { posesForBaseline } from "@/lib/yoga-poses";

// MediaPipe-based pose sample. Runs entirely client-side — video frames never
// leave the browser tab. The component is opt-in: if the user skips, the
// matching agent runs on intake answers alone.

type Status = "idle" | "requesting" | "sampling" | "done" | "error";

export default function PoseCheck({
  enabled,
  baseline,
  skipped,
  onEnable,
  onComplete,
  onSkip,
  onUndoSkip,
}: {
  enabled: boolean;
  baseline?: PoseBaseline;
  skipped: boolean;
  onEnable: () => void;
  onComplete: (b: PoseBaseline) => void;
  onSkip: () => void;
  onUndoSkip: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function run() {
      setStatus("requesting");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();

        // Dynamically import the heavy MediaPipe bundle.
        const vision = await import("@mediapipe/tasks-vision");
        const { PoseLandmarker, FilesetResolver } = vision;

        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        setStatus("sampling");

        // Sample for ~5s. Capture landmarker output, derive a simplified
        // baseline.
        const samples: Sample[] = [];
        const start = performance.now();
        const DURATION_MS = 5000;

        await new Promise<void>((resolve) => {
          let raf = 0;
          const tick = () => {
            const now = performance.now();
            const t = now - start;
            const result = landmarker.detectForVideo(v, now);
            if (result.landmarks?.[0]) {
              samples.push({
                t,
                landmarks: result.landmarks[0],
                worldLandmarks: result.worldLandmarks?.[0] ?? [],
              });
            }
            if (t < DURATION_MS) {
              raf = requestAnimationFrame(tick);
            } else {
              cancelAnimationFrame(raf);
              resolve();
            }
          };
          raf = requestAnimationFrame(tick);
        });

        landmarker.close();
        if (cancelled) return;

        const baseline = deriveBaseline(samples);
        onComplete(baseline);
        setStatus("done");
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Pose sample failed.");
        setStatus("error");
      }
    }

    run();

    const cleanup = () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    return cleanup;
  }, [enabled, onComplete]);

  // Stop the camera as soon as the panel unmounts (or sampling finishes).
  useEffect(() => {
    if (status === "done" || status === "error" || !enabled) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [status, enabled]);

  // Explicit "skipped" confirmation so the user sees their choice landed.
  // Before this, clicking Skip set runPose=false (already false) and the
  // UI didn't change — the button looked broken.
  if (skipped && !baseline) {
    return (
      <div className="border border-dashed border-[color:var(--hairline)] rounded-sm p-5 bg-[color:var(--surface)] flex flex-wrap items-baseline gap-x-4 gap-y-1 fade-in-up">
        <p className="tag flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent-soft)]"
          />
          pose check skipped
        </p>
        <p className="text-sm text-[color:var(--muted)]">
          The agent will match on your stated energy only.
        </p>
        <button
          type="button"
          onClick={onUndoSkip}
          className="ml-auto text-sm underline underline-offset-4 decoration-[color:var(--hairline)] hover:decoration-[color:var(--accent)] text-[color:var(--muted)] hover:text-foreground transition-colors"
        >
          Add a sample instead
        </button>
      </div>
    );
  }

  if (!enabled && !baseline) {
    return (
      <div className="border border-[color:var(--hairline)] rounded-sm p-6 bg-[color:var(--surface)] surface-card">
        <p className="why mb-4 max-w-prose">
          Run a short posture sample and the agent can match against your
          actual mobility and breath phase — not just your stated energy.
          Your video stays in this browser tab; only derived signals are
          sent upstream.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={onEnable}
            className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
          >
            Run a 5-second sample
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors"
          >
            Skip — match on stated energy only
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[color:var(--hairline)] rounded-sm p-6 bg-[color:var(--surface)]">
      <div className="relative w-full max-w-md">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full rounded-sm border border-[color:var(--hairline)] ${
            status === "done" ? "opacity-40" : ""
          }`}
        />
        {(status === "requesting" || status === "sampling") && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-[color:var(--background)]/85 backdrop-blur-sm border border-[color:var(--hairline)]">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft"
            />
            <span className="tag">
              {status === "requesting" ? "requesting camera" : "local · not uploaded"}
            </span>
          </div>
        )}
      </div>
      <div className="mt-4">
        {status === "requesting" && (
          <p className="why pulse-soft">requesting camera permission…</p>
        )}
        {status === "sampling" && (
          <p className="why pulse-soft">
            sampling — stand relaxed, arms by your sides, breathe normally.
            The camera sees you, but the frames never leave this tab.
          </p>
        )}
        {status === "error" && (
          <p className="text-[color:var(--accent-ink)] text-sm">
            {error ?? "Pose sample failed."}
          </p>
        )}
        {status === "done" && baseline && (
          <div className="fade-in-up">
            <p className="why mb-5">
              Baseline captured. Only the derived signals are sent— the
              frames stay on this device.
            </p>

            {/* Matched pose illustrations — the payoff moment */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {posesForBaseline(baseline).map((pose) => (
                <div
                  key={pose.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)] hover:border-[color:var(--accent-soft)] transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pose.svgUrl}
                    alt={pose.english}
                    className="w-20 h-20 object-contain opacity-80"
                    style={{
                      filter:
                        "sepia(40%) saturate(1.3) hue-rotate(-15deg) brightness(0.9)",
                    }}
                    loading="lazy"
                  />
                  <div className="text-center">
                    <p className="text-xs font-medium leading-tight">
                      {pose.english}
                    </p>
                    <p className="tag opacity-60 text-[10px] leading-tight mt-0.5">
                      {pose.sanskrit}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Benefit copy of first matched pose */}
            <p className="why text-sm opacity-70 mb-4 max-w-prose">
              {posesForBaseline(baseline)[0]?.benefit}
            </p>

            {/* Raw baseline signals as quiet secondary detail */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs opacity-60">
              <dt className="text-[color:var(--muted)]">shoulder</dt>
              <dd>{baseline.shoulderMobility}</dd>
              <dt className="text-[color:var(--muted)]">hip</dt>
              <dd>{baseline.hipMobility}</dd>
              <dt className="text-[color:var(--muted)]">breath</dt>
              <dd>{baseline.breathPhase}</dd>
              <dt className="text-[color:var(--muted)]">confidence</dt>
              <dd>{Math.round(baseline.confidence * 100)}%</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

// --- heuristic signal derivation -----------------------------------------

type Sample = {
  t: number;
  landmarks: { x: number; y: number; z: number; visibility?: number }[];
  worldLandmarks: { x: number; y: number; z: number; visibility?: number }[];
};

// MediaPipe Pose landmark indices:
// 11 left shoulder, 12 right shoulder, 23 left hip, 24 right hip,
// 25 left knee, 26 right knee, 27 left ankle, 28 right ankle,
// 0  nose
const LM = {
  NOSE: 0,
  LSHO: 11,
  RSHO: 12,
  LHIP: 23,
  RHIP: 24,
  LKNEE: 25,
  RKNEE: 26,
  LANK: 27,
  RANK: 28,
};

function avgVis(s: Sample): number {
  let sum = 0;
  let n = 0;
  for (const lm of s.landmarks) {
    if (typeof lm.visibility === "number") {
      sum += lm.visibility;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  // Angle ABC at vertex b, in degrees, 0..180.
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (m === 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * (180 / Math.PI);
}

function deriveBaseline(samples: Sample[]): PoseBaseline {
  if (samples.length === 0) {
    return {
      shoulderMobility: "open",
      hipMobility: "open",
      breathPhase: "even",
      confidence: 0,
    };
  }

  // Confidence: mean visibility across frames.
  const confidence = samples.reduce((s, x) => s + avgVis(x), 0) / samples.length;

  // Shoulder mobility: ratio of shoulder-shoulder distance to torso length
  // (shoulder midpoint → hip midpoint). Arms-by-sides gives a low ratio;
  // arms-extended gives a high ratio.
  let shoulderRatioSum = 0;
  let shoulderN = 0;
  for (const s of samples) {
    const ls = s.landmarks[LM.LSHO];
    const rs = s.landmarks[LM.RSHO];
    const lh = s.landmarks[LM.LHIP];
    const rh = s.landmarks[LM.RHIP];
    if (!ls || !rs || !lh || !rh) continue;
    const shoulders = dist(ls, rs);
    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const torso = dist(shoulderMid, hipMid);
    if (torso > 0) {
      shoulderRatioSum += shoulders / torso;
      shoulderN++;
    }
  }
  const shoulderRatio =
    shoulderN > 0 ? shoulderRatioSum / shoulderN : 1; // ~1 = arms-by-sides
  const shoulderMobility: PoseBaseline["shoulderMobility"] =
    shoulderRatio > 1.6 ? "very-open" : shoulderRatio > 1.1 ? "open" : "tight";

  // Hip mobility: knee bend (angle at knee). 180° = locked straight.
  let kneeSum = 0;
  let kneeN = 0;
  for (const s of samples) {
    const lh = s.landmarks[LM.LHIP];
    const lk = s.landmarks[LM.LKNEE];
    const la = s.landmarks[LM.LANK];
    const rh = s.landmarks[LM.RHIP];
    const rk = s.landmarks[LM.RKNEE];
    const ra = s.landmarks[LM.RANK];
    if (lh && lk && la) {
      kneeSum += angleAt(lh, lk, la);
      kneeN++;
    }
    if (rh && rk && ra) {
      kneeSum += angleAt(rh, rk, ra);
      kneeN++;
    }
  }
  const kneeAngle = kneeN > 0 ? kneeSum / kneeN : 180;
  // Larger knee angle = straighter legs = less hip flex range visible =
  // we report as "tight" (standing). Smaller knee angle = more bend.
  const hipMobility: PoseBaseline["hipMobility"] =
    kneeAngle < 165 ? "very-open" : kneeAngle < 175 ? "open" : "tight";

  // Breath: variance of shoulder-mid Y position. Higher variance → more
  // motion → shallower/faster breathing.
  const shoulderYs: number[] = [];
  for (const s of samples) {
    const ls = s.landmarks[LM.LSHO];
    const rs = s.landmarks[LM.RSHO];
    if (!ls || !rs) continue;
    shoulderYs.push((ls.y + rs.y) / 2);
  }
  const mean =
    shoulderYs.reduce((s, y) => s + y, 0) /
    Math.max(1, shoulderYs.length);
  const variance =
    shoulderYs.reduce((s, y) => s + (y - mean) ** 2, 0) /
    Math.max(1, shoulderYs.length);
  // Variance is tiny (normalized coords). Thresholds chosen empirically.
  const breathPhase: PoseBaseline["breathPhase"] =
    variance < 1e-5 ? "extended" : variance < 5e-5 ? "even" : "shallow";

  return {
    shoulderMobility,
    hipMobility,
    breathPhase,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}
