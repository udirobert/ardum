"use client";

import { useEffect, useState } from "react";

// Device capability tier for gating expensive GPU effects.
//
// "high" — dedicated GPU or high-DPI integrated; safe for the raymarched
//   SDF core (64-step march at 512×512 every frame).
// "standard" — typical integrated GPU; the capsule shell + SimpleCore +
//   postprocessing read well without the raymarch cost.
// "low" — weak mobile / low-power; defer all heavy effects.
//
// Signals (first one wins, in priority order):
//   1. prefers-reduced-motion → "low"
//   2. high devicePixelRatio (≥ 2.5) without a discrete GPU → "standard"
//   3. WebGL renderer string (when available) — Intel/Apple GPU strings
//      with high DPR are "standard"; discrete (NVIDIA/AMD/Apple discrete)
//      is "high".
//   4. fallthrough → "standard"
//
// This is intentionally a one-shot probe (no reactive re-sampling) because
// GPU capability does not change during a session.

type DeviceTier = "high" | "standard" | "low";

function probeGpuTier(): DeviceTier {
  if (typeof window === "undefined") return "standard";

  // Reduced motion → no heavy GPU work.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "low";
  }

  const dpr = window.devicePixelRatio || 1;

  // Try to read the renderer string via the debug extension. This is
  // the most reliable signal for discrete vs integrated. Unavailable
  // in most privacy-focused browsers — fall through to the DPR signal.
  let renderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
      }
    }
  } catch {
    // ignore — privacy mode or blocked
  }

  const r = renderer.toLowerCase();

  // Discrete GPUs can carry the SDF core regardless of DPR.
  const discrete =
    r.includes("nvidia") ||
    r.includes("amd") ||
    r.includes("radeon") ||
    // Apple discrete (M-Pro / Metal names with "radeon pro" excluded above)
    r.includes("apple m") && (r.includes("max") || r.includes("ultra") || r.includes("pro"));

  if (discrete) return "high";

  // High DPR without a discrete GPU → the raymarch fills 2.5–3× the
  // pixels of a standard display on an integrated chip. That's the
  // case the SDF core is worst at; gate it down.
  if (dpr >= 2.5) return "standard";

  // Known integrated GPUs at moderate DPR → standard.
  if (r.includes("intel") || r.includes("apple")) return "standard";

  // Unknown GPU at modest DPR — give it the benefit of the doubt
  // for the liquid interior; the frame-rate gate below will catch
  // a sustained miss.
  return "high";
}

/** One-shot device capability tier. Stays "standard" during SSR. */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>("standard");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot probe
    setTier(probeGpuTier());
  }, []);

  return tier;
}
