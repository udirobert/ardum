"use client";

// Mira — the agent persona that guides users through Ardum.
//
// The orb is a living presence: domain-warped marble inside a morphing
// metaball silhouette. Posture, valence, and reactions come from
// src/agent/mira-presence.ts (operational projection). See
// docs/design/mira-presence.md.

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { readAestheticVector } from "@/aesthetics/aesthetic-store";
import type { AestheticVector } from "@/aesthetics/image-pool";
import {
  breathDuration,
  mergePresence,
  morphParamsForTier,
  presenceAnnouncement,
  renderTier,
  ringStyle,
  STEADY_PRESENCE,
  type MiraActivity,
  type MiraPresence,
  type MorphParams,
} from "@/agent/mira-presence";

import { useMiraImpulse } from "@/components/MiraImpulse";

const MiraScene = dynamic(() => import("./MiraScene"), { ssr: false });

const SCENE_MIN_PX = 64;

type MiraOrbProps = {
  /** Journey posture — projected from episode or activity helpers. */
  presence?: MiraPresence;
  /** Transient overlay when busy / narrating (merged via mergePresence). */
  activity?: MiraActivity;
  size?: number;
  children?: ReactNode;
  className?: string;
  aestheticVector?: AestheticVector | null;
};

// Ardum base palette (sRGB 0–1).
const COL_DARK = [0.431, 0.224, 0.145] as const;
const COL_WARM = [0.659, 0.353, 0.227] as const;
const COL_LIGHT = [0.847, 0.659, 0.573] as const;
const COL_CREAM = [0.965, 0.945, 0.906] as const;

type RGB = [number, number, number];

function vectorToPalette(v: AestheticVector | null | undefined): {
  dark: RGB;
  warm: RGB;
  light: RGB;
  cream: RGB;
} {
  if (!v) {
    return {
      dark: [...COL_DARK] as RGB,
      warm: [...COL_WARM] as RGB,
      light: [...COL_LIGHT] as RGB,
      cream: [...COL_CREAM] as RGB,
    };
  }

  const warmth = (v.warm - v.cool) * 0.18;
  const darkness = (v.dark - v.light) * 0.12;
  const expansion = (v.expansive - v.intimate) * 0.04;
  const cool = (v.cool - v.warm) * 0.1;

  const shift = (
    base: readonly number[],
    r: number,
    g: number,
    b: number,
  ): RGB => [
    Math.max(0, Math.min(1, base[0] + r)),
    Math.max(0, Math.min(1, base[1] + g)),
    Math.max(0, Math.min(1, base[2] + b)),
  ];

  return {
    dark: shift(
      COL_DARK,
      warmth * 0.6 - cool * 0.5,
      -warmth * 0.2 + cool * 0.1 - darkness * 0.3,
      -warmth * 0.3 + cool * 0.4,
    ),
    warm: shift(
      COL_WARM,
      warmth * 0.5 - cool * 0.4 - darkness * 0.2,
      -warmth * 0.15 - darkness * 0.1,
      -warmth * 0.25 + cool * 0.35,
    ),
    light: shift(
      COL_LIGHT,
      warmth * 0.3 - cool * 0.2 - darkness * 0.15 + expansion * 0.05,
      warmth * 0.1 - darkness * 0.1 + expansion * 0.05,
      -warmth * 0.1 + cool * 0.25 + expansion * 0.05,
    ),
    cream: shift(
      COL_CREAM,
      warmth * 0.05 - cool * 0.04 - darkness * 0.08,
      -cool * 0.02 - darkness * 0.06,
      cool * 0.05 - darkness * 0.05,
    ),
  };
}

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
uniform float u_blobCount;
uniform float u_orbitRadius;
uniform float u_orbitSpeed;
uniform float u_pinch;
uniform float u_bloom;
uniform float u_asymmetry;
uniform float u_reaction;
uniform float u_metaball; // 1 = full morph, 0 = circle mask (inline tier)
uniform vec3  u_dark;
uniform vec3  u_warm;
uniform vec3  u_light;
uniform vec3  u_cream;

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

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdCircle(vec2 p, vec2 c, float r) {
  return length(p - c) - r;
}

float metaballField(vec2 p, float t) {
  float pinch = u_pinch + u_reaction * 0.35;
  float bloom = u_bloom + u_reaction * 0.12;
  vec2 asym = vec2(u_asymmetry * 0.12, -u_asymmetry * 0.08);
  float baseR = 0.36 + bloom * 0.1 - pinch * 0.06;
  float field = sdCircle(p, asym, baseR);

  for (int i = 0; i < 4; i++) {
    if (float(i) >= u_blobCount) break;
    float fi = float(i);
    float angle = t * u_orbitSpeed * (0.65 + fi * 0.21) + fi * 1.5708;
    float rad = u_orbitRadius * (fi < 0.5 ? 0.0 : 1.0);
    vec2 center = vec2(cos(angle), sin(angle)) * rad + asym;
    float r = 0.13 - pinch * 0.045 + bloom * 0.035;
    field = smin(field, sdCircle(p, center, r), 0.085);
  }
  return field;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv - 0.5;
  float t = u_time * u_speed;

  float field = metaballField(p, u_time);
  float circleR = length(p);
  float shapeDist = mix(circleR - 0.42, field, u_metaball);
  float alpha = smoothstep(0.018, -0.012, shapeDist);
  if (alpha <= 0.001) discard;

  vec2 q = vec2(fbm(p * 3.2 + t * 0.10),
                fbm(p * 3.2 + vec2(5.2, 1.3) + t * 0.12));
  vec2 s = vec2(fbm(p * 3.2 + q * u_turb + t * 0.15 + vec2(1.7, 9.2)),
                fbm(p * 3.2 + q * u_turb + t * 0.126 + vec2(8.3, 2.8)));
  float f = fbm(p * 3.2 + s * u_turb);

  vec3 col = mix(u_dark, u_warm, clamp(f * 1.7, 0.0, 1.0));
  col = mix(col, u_light, pow(clamp(s.x, 0.0, 1.0), 2.0) * 0.6 * u_bright);
  float vein = smoothstep(0.55, 0.62, f) * u_bright * 0.35;
  col = mix(col, u_cream, vein);

  vec2 lightPos = vec2(-0.16, 0.16);
  float diff = clamp(1.0 - length(p - lightPos) * 1.35, 0.0, 1.0);
  col += diff * diff * 0.22;
  col *= 1.0 - smoothstep(0.32, 0.5, circleR) * 0.35 * (1.0 - u_metaball * 0.5);

  gl_FragColor = vec4(col, alpha);
}
`;

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

const REACTION_MS = 2400;

export default function MiraOrb({
  presence = STEADY_PRESENCE,
  activity,
  size = 48,
  children,
  className,
  aestheticVector,
}: MiraOrbProps) {
  const orbRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presenceRef = useRef(presence);
  const reduced = useReducedMotion();
  const paletteRef = useRef(vectorToPalette(aestheticVector));
  const reactionRef = useRef<{
    eventId?: string;
    startedAt: number;
    active: boolean;
  }>({ startedAt: 0, active: false });

  const tier = renderTier(size);
  const effectivePresence = mergePresence(presence, activity);
  const ring = ringStyle(effectivePresence.posture);
  const useScene = size >= SCENE_MIN_PX;
  const [storedVector] = useState(() =>
    typeof window !== "undefined" ? readAestheticVector() : null,
  );
  const resolvedVector = aestheticVector ?? storedVector;
  const [reactionPulse, setReactionPulse] = useState(0);
  const { impulse } = useMiraImpulse();
  const morph = morphParamsForTier(effectivePresence, tier);
  const palette = vectorToPalette(resolvedVector);

  useEffect(() => {
    presenceRef.current = mergePresence(presence, activity);
  }, [presence, activity]);

  useEffect(() => {
    const rx = effectivePresence.reaction;
    if (rx && rx.eventId !== reactionRef.current.eventId) {
      reactionRef.current = {
        eventId: rx.eventId,
        startedAt: performance.now(),
        active: true,
      };
    }
  }, [effectivePresence.reaction]);

  useEffect(() => {
    if (useScene) return;
    const orb = orbRef.current;
    if (!orb) return;
    orb.style.animationDuration = breathDuration(effectivePresence.posture);
  }, [effectivePresence.posture, useScene]);

  useEffect(() => {
    paletteRef.current = vectorToPalette(resolvedVector);
  }, [resolvedVector]);

  useEffect(() => {
    if (!reactionRef.current.active) return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - reactionRef.current.startedAt;
      if (elapsed > REACTION_MS) {
        reactionRef.current.active = false;
        setReactionPulse(0);
        return;
      }
      setReactionPulse(Math.sin((elapsed / REACTION_MS) * Math.PI));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [effectivePresence.reaction?.eventId]);

  useEffect(() => {
    if (useScene) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (liveGLOrbs >= MAX_GL_ORBS) return;

    const gl =
      canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      }) ||
      (canvas.getContext("experimental-webgl", {
        alpha: true,
        premultipliedAlpha: false,
      }) as WebGLRenderingContext | null);
    if (!gl) return;

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
      blobCount: gl.getUniformLocation(prog, "u_blobCount"),
      orbitRadius: gl.getUniformLocation(prog, "u_orbitRadius"),
      orbitSpeed: gl.getUniformLocation(prog, "u_orbitSpeed"),
      pinch: gl.getUniformLocation(prog, "u_pinch"),
      bloom: gl.getUniformLocation(prog, "u_bloom"),
      asymmetry: gl.getUniformLocation(prog, "u_asymmetry"),
      reaction: gl.getUniformLocation(prog, "u_reaction"),
      metaball: gl.getUniformLocation(prog, "u_metaball"),
      dark: gl.getUniformLocation(prog, "u_dark"),
      warm: gl.getUniformLocation(prog, "u_warm"),
      light: gl.getUniformLocation(prog, "u_light"),
      cream: gl.getUniformLocation(prog, "u_cream"),
    };

    const initPal = paletteRef.current;
    gl.uniform3fv(u.dark, initPal.dark);
    gl.uniform3fv(u.warm, initPal.warm);
    gl.uniform3fv(u.light, initPal.light);
    gl.uniform3fv(u.cream, initPal.cream);

    const curPal = {
      dark: [...initPal.dark] as RGB,
      warm: [...initPal.warm] as RGB,
      light: [...initPal.light] as RGB,
      cream: [...initPal.cream] as RGB,
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    gl.viewport(0, 0, px, px);
    gl.uniform2f(u.res, px, px);
    gl.uniform1f(u.metaball, tier === "inline" ? 0 : 1);

    liveGLOrbs++;

    const targetMorph = (): MorphParams =>
      morphParamsForTier(
        presenceRef.current,
        renderTier(size),
      );

    const cur: MorphParams = { ...targetMorph() };
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const target = targetMorph();
      const M = 0.04;
      cur.speed = lerp(cur.speed, target.speed, M);
      cur.turbulence = lerp(cur.turbulence, target.turbulence, M);
      cur.brightness = lerp(cur.brightness, target.brightness, M);
      cur.blobCount = lerp(cur.blobCount, target.blobCount, M);
      cur.orbitRadius = lerp(cur.orbitRadius, target.orbitRadius, M);
      cur.orbitSpeed = lerp(cur.orbitSpeed, target.orbitSpeed, M);
      cur.pinch = lerp(cur.pinch, target.pinch, M);
      cur.bloom = lerp(cur.bloom, target.bloom, M);
      cur.asymmetry = lerp(cur.asymmetry, target.asymmetry, M);

      const tpal = paletteRef.current;
      const PALR = 0.025;
      for (let i = 0; i < 3; i++) {
        curPal.dark[i] = lerp(curPal.dark[i], tpal.dark[i], PALR);
        curPal.warm[i] = lerp(curPal.warm[i], tpal.warm[i], PALR);
        curPal.light[i] = lerp(curPal.light[i], tpal.light[i], PALR);
        curPal.cream[i] = lerp(curPal.cream[i], tpal.cream[i], PALR);
      }

      let reactionPulse = 0;
      if (reactionRef.current.active) {
        const elapsed = now - reactionRef.current.startedAt;
        if (elapsed > REACTION_MS) {
          reactionRef.current.active = false;
        } else {
          reactionPulse = Math.sin((elapsed / REACTION_MS) * Math.PI);
        }
      }

      gl.uniform3fv(u.dark, curPal.dark);
      gl.uniform3fv(u.warm, curPal.warm);
      gl.uniform3fv(u.light, curPal.light);
      gl.uniform3fv(u.cream, curPal.cream);
      gl.uniform1f(u.time, (now - start) / 1000);
      gl.uniform1f(u.speed, cur.speed);
      gl.uniform1f(u.turb, cur.turbulence);
      gl.uniform1f(u.bright, cur.brightness);
      gl.uniform1f(u.blobCount, cur.blobCount);
      gl.uniform1f(u.orbitRadius, cur.orbitRadius);
      gl.uniform1f(u.orbitSpeed, cur.orbitSpeed);
      gl.uniform1f(u.pinch, cur.pinch);
      gl.uniform1f(u.bloom, cur.bloom);
      gl.uniform1f(u.asymmetry, cur.asymmetry);
      gl.uniform1f(u.reaction, reactionPulse);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    if (reduced) {
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
  }, [size, reduced, tier, useScene]);

  const ringRadius = (size - 8) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const gapSize =
    ring === "open"
      ? ringCircumference * 0.18
      : ring === "radiating"
        ? ringCircumference * 0.25
        : 0;
  const visibleLength = ringCircumference - gapSize;

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      {useScene ? (
        <div className="relative" style={{ width: size, height: size }} aria-hidden>
          <MiraScene
            size={size}
            morph={morph}
            palette={palette}
            reactionPulse={reactionPulse}
            impulse={impulse}
          />
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={ringRadius}
              stroke="rgba(110,57,37,0.45)"
              strokeWidth="0.75"
              strokeDasharray={`${visibleLength} ${gapSize}`}
              strokeLinecap="round"
              style={{
                transition: "stroke-dasharray 1.2s ease-in-out",
                transform: "rotate(-90deg)",
                transformOrigin: "center",
              }}
            />
          </svg>
        </div>
      ) : (
      <div
        ref={orbRef}
        className="relative rounded-full mira-orb"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 35% 30%, rgba(168,90,58,0.35), rgba(168,90,58,0.08) 60%, transparent 80%)",
          border: "1px solid rgba(168,90,58,0.15)",
        }}
        aria-hidden
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-full"
        />
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, rgba(246,241,231,0.35), transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(168,90,58,0.2), transparent 70%)",
            transform: "scale(1.4)",
          }}
        />
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
        {ring === "radiating" && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            style={{ overflow: "visible" }}
          >
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const dotR = size / 2 + 3;
              const cx =
                Math.round((size / 2 + dotR * Math.cos(rad)) * 1000) / 1000;
              const cy =
                Math.round((size / 2 + dotR * Math.sin(rad)) * 1000) / 1000;
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
      )}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {presenceAnnouncement(effectivePresence)}
      </span>
      {children}
    </div>
  );
}

export type { MiraPresence, MiraActivity };
