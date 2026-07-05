"use client";

// Mira — the agent persona that guides users through Ardum.
//
// Not a chatbot. Not a mascot. A breathing presence that anchors the
// conversation. The orb pulses at a calm 4-second cycle (matching
// a relaxed breathing rhythm of ~15 breaths/min). When Mira is
// "thinking" (processing), the orb breathes slightly faster.
//
// Mira's voice is warm, second-person, present tense. Never says
// "I am an AI." Talks like a guide who has been doing this for years.
//
// Name: Mira (Sanskrit: "ocean" — the vast, calm body that holds depth)
//
// ── The living marble ───────────────────────────────────────────────
//
// The orb is not a static gradient — it is a slice of flowing marble,
// rendered live in WebGL with domain-warped fbm noise. Terracotta veins
// drift through cream and ink, tinted by Mira's state:
//
//   calm     → slow, settled flow (deep breathing)
//   thinking → faster, more turbulent (the mind at work — Ardum, inquiry)
//   speaking → warmer, brighter, expansive (the offering — abhaya)
//
// The marble references mattrossman/magic-marble: fbm + domain warp for
// organic veining. It replaces the old CSS radial-gradient so the agent
// visibly breathes and moves instead of sitting still.
//
// ── The mudra ring ──────────────────────────────────────────────────
//
// Ardum is "mudra" reversed. A mudra is a seal — a closed shape that
// directs energy. Ardum opens the seal. The orb carries a thin ring
// inside it that represents this:
//
//   calm    → ring is complete (the seal — chin mudra, receptivity)
//   thinking → ring has a gap  (the seal opened — Ardum, inquiry)
//   speaking → ring radiates    (the offering — abhaya, fearlessness)
//
// The gap IS the concept. A mudra seals. Ardum opens. The user sees
// this without needing to know Sanskrit.

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type OrbState = "calm" | "thinking" | "speaking";

type MiraOrbProps = {
  /** Breathing state — "calm" (default), "thinking" (faster pulse), "speaking" (gentle expand) */
  state?: OrbState;
  /** Size in px. Default: 48 */
  size?: number;
  /** Optional children rendered below the orb (e.g. a label) */
  children?: ReactNode;
  className?: string;
};

// ── Shader-driven marble ─────────────────────────────────────────────

// Per-state flow parameters. Smoothly interpolated at runtime so the
// orb eases between states instead of snapping.
type MarbleParams = { speed: number; turbulence: number; brightness: number };

const STATE_PARAMS: Record<OrbState, MarbleParams> = {
  calm: { speed: 0.12, turbulence: 0.75, brightness: 0.55 },
  thinking: { speed: 0.45, turbulence: 1.45, brightness: 0.78 },
  speaking: { speed: 0.26, turbulence: 1.0, brightness: 1.15 },
};

// Ardum palette (sRGB 0–1). Ink → terracotta → warm sand, cream highlight.
const COL_DARK = [0.431, 0.224, 0.145]; // accent-ink  #6e3925
const COL_WARM = [0.659, 0.353, 0.227]; // accent      #a85a3a
const COL_LIGHT = [0.847, 0.659, 0.573]; // accent-soft #d8a892
const COL_CREAM = [0.965, 0.945, 0.906]; // background  #f6f1e7

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision mediump float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_turb;
uniform float u_bright;
uniform vec3  u_dark;
uniform vec3  u_warm;
uniform vec3  u_light;
uniform vec3  u_cream;

// Value noise + fbm (domain-warped) → marble veining.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv - 0.5;
  float r = length(p);

  float t = u_time * u_speed;

  // Domain warp — two layers of fbm displace the sample point, giving
  // the swirling marble veins their organic, non-repeating flow.
  vec2 q = vec2(fbm(p * 3.2 + t * 0.10),
                fbm(p * 3.2 + vec2(5.2, 1.3) + t * 0.12));
  vec2 s = vec2(fbm(p * 3.2 + q * u_turb + t * 0.15 + vec2(1.7, 9.2)),
                fbm(p * 3.2 + q * u_turb + t * 0.126 + vec2(8.3, 2.8)));
  float f = fbm(p * 3.2 + s * u_turb);

  // Marble mix: ink in the troughs, terracotta in the body.
  vec3 col = mix(u_dark, u_warm, clamp(f * 1.7, 0.0, 1.0));
  // Warm sand highlights where the second warp field peaks.
  col = mix(col, u_light, pow(clamp(s.x, 0.0, 1.0), 2.0) * 0.6 * u_bright);
  // A few cream veins for depth on the speaking (bright) state.
  float vein = smoothstep(0.55, 0.62, f) * u_bright * 0.35;
  col = mix(col, u_cream, vein);

  // Spherical shading — light from top-left (matches the old 35%/30%).
  vec2 lightPos = vec2(-0.16, 0.16);
  float diff = clamp(1.0 - length(p - lightPos) * 1.35, 0.0, 1.0);
  col += diff * diff * 0.22;
  // Rim darkening for volume.
  col *= 1.0 - smoothstep(0.32, 0.5, r) * 0.35;

  // Soft circular mask.
  float alpha = smoothstep(0.5, 0.46, r);
  gl_FragColor = vec4(col, alpha);
}
`;

// WebGL contexts are a finite resource (~16 per document). Guard against
// exhaustion when many orbs mount at once — beyond the budget, orbs fall
// back to the CSS gradient below.
const MAX_GL_ORBS = 8;
let liveGLOrbs = 0;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function MiraOrb({
  state = "calm",
  size = 48,
  children,
  className,
}: MiraOrbProps) {
  const orbRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  const reduced = useReducedMotion();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sync the CSS breathing-scale animation speed to the state.
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    orb.style.animationDuration =
      state === "thinking" ? "2s" : state === "speaking" ? "3s" : "4s";
  }, [state]);

  // WebGL marble render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (liveGLOrbs >= MAX_GL_ORBS) return; // budget exceeded → CSS fallback

    const gl =
      canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true }) ||
      (canvas.getContext("experimental-webgl", {
        alpha: true,
        premultipliedAlpha: false,
      }) as WebGLRenderingContext | null);
    if (!gl) return; // no WebGL → CSS fallback

    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // Fullscreen quad.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, "u_res"),
      time: gl.getUniformLocation(prog, "u_time"),
      speed: gl.getUniformLocation(prog, "u_speed"),
      turb: gl.getUniformLocation(prog, "u_turb"),
      bright: gl.getUniformLocation(prog, "u_bright"),
      dark: gl.getUniformLocation(prog, "u_dark"),
      warm: gl.getUniformLocation(prog, "u_warm"),
      light: gl.getUniformLocation(prog, "u_light"),
      cream: gl.getUniformLocation(prog, "u_cream"),
    };
    gl.uniform3fv(u.dark, COL_DARK);
    gl.uniform3fv(u.warm, COL_WARM);
    gl.uniform3fv(u.light, COL_LIGHT);
    gl.uniform3fv(u.cream, COL_CREAM);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    gl.viewport(0, 0, px, px);
    gl.uniform2f(u.res, px, px);

    liveGLOrbs++;

    // Current params ease toward the active state's target each frame.
    const cur: MarbleParams = { ...STATE_PARAMS[stateRef.current] };
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const target = STATE_PARAMS[stateRef.current];
      cur.speed = lerp(cur.speed, target.speed, 0.04);
      cur.turbulence = lerp(cur.turbulence, target.turbulence, 0.04);
      cur.brightness = lerp(cur.brightness, target.brightness, 0.04);

      gl.uniform1f(u.time, (now - start) / 1000);
      gl.uniform1f(u.speed, cur.speed);
      gl.uniform1f(u.turb, cur.turbulence);
      gl.uniform1f(u.bright, cur.brightness);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    if (reduced) {
      // Single settled frame, no loop.
      draw(start + 3200);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      liveGLOrbs = Math.max(0, liveGLOrbs - 1);
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    };
  }, [size, reduced]);

  // The mudra ring — an SVG circle that changes based on state.
  const ringRadius = (size - 8) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const gapSize =
    state === "thinking"
      ? ringCircumference * 0.15
      : state === "speaking"
        ? ringCircumference * 0.25
        : 0;
  const visibleLength = ringCircumference - gapSize;

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <div
        ref={orbRef}
        className="relative rounded-full mira-orb"
        style={{
          width: size,
          height: size,
          // CSS-gradient fallback — visible until/unless WebGL paints over it.
          background:
            "radial-gradient(circle at 35% 30%, rgba(168,90,58,0.35), rgba(168,90,58,0.08) 60%, transparent 80%)",
          border: "1px solid rgba(168,90,58,0.15)",
        }}
        aria-hidden
      >
        {/* Live marble */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-full"
        />

        {/* Glass sheen — a soft specular highlight over the marble */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, rgba(246,241,231,0.35), transparent 55%)",
          }}
        />
        {/* Outer halo */}
        <div
          className="absolute inset-0 rounded-full opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(168,90,58,0.2), transparent 70%)",
            transform: "scale(1.4)",
          }}
        />

        {/* The mudra ring — the seal that opens */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={ringRadius}
            stroke="rgba(110,57,37,0.55)"
            strokeWidth="0.75"
            strokeDasharray={`${visibleLength} ${gapSize}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{
              transition: "stroke-dasharray 1.2s ease-in-out",
              transform: "rotate(-90deg)",
              transformOrigin: "center",
            }}
          />
        </svg>

        {/* Speaking state — radiating dots (abhaya, the offering) */}
        {state === "speaking" && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            style={{ overflow: "visible" }}
          >
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const dotR = size / 2 + 3;
              // Round to avoid server/client float-representation hydration drift.
              const cx = Math.round((size / 2 + dotR * Math.cos(rad)) * 1000) / 1000;
              const cy = Math.round((size / 2 + dotR * Math.sin(rad)) * 1000) / 1000;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="0.8"
                  fill="rgba(168,90,58,0.5)"
                  style={{
                    animation: `mira-radiate 3s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              );
            })}
          </svg>
        )}
      </div>
      {children}
    </div>
  );
}
