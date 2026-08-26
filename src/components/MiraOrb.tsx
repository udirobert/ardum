"use client";

// Mira — the agent persona that guides users through Ardum.
//
// The orb is a living presence: domain-warped marble inside a morphing
// metaball silhouette. Posture, valence, and reactions come from
// src/agent/mira-presence.ts (operational projection). See
// docs/design/mira-presence.md.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
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
import { useAttentionSignals, breathMultiplier } from "@/hooks/useAttentionSignals";
import { haptic } from "@/lib/haptics";
import { frameDelta, paramsChanged, smoothApproach, smoothFactor } from "@/lib/motion";

const MiraScene = dynamic(() => import("./MiraScene"), { ssr: false });

/**
 * Warm the hero scene chunk (three/fiber/postprocessing) before the render
 * tree reaches a scene-tier orb. Call from surfaces that will show one —
 * module identity matches the dynamic() import above, so this is a pure
 * prefetch, not a second copy.
 */
export function preloadMiraScene() {
  if (typeof window !== "undefined") void import("./MiraScene");
}

const SCENE_MIN_PX = 64;
// Crossfade from the instant 2D field to the 3D scene once it has a GL
// context; release the 2D context shortly after the fade completes.
const SCENE_FADE_MS = 900;
const UNDERLAY_RELEASE_MS = 1300;

type MiraOrbProps = {
  /** Journey posture — projected from episode or activity helpers. */
  presence?: MiraPresence;
  /** Transient overlay when busy / narrating (merged via mergePresence). */
  activity?: MiraActivity;
  size?: number;
  children?: ReactNode;
  className?: string;
  aestheticVector?: AestheticVector | null;
  /**
   * Fill the parent container as an ambient field instead of a fixed-size
   * badge. Always renders the hero scene; drops the ring/badge chrome.
   * The shell field (MiraField) is the one persistent fill orb; page-level
   * orbs are inline signatures.
   */
  fill?: boolean;
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
uniform float u_lift;     // raises the field center (fill tier matches hero framing)
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
  vec2 p = uv - vec2(0.5, 0.5 + u_lift);
  p.x *= u_res.x / u_res.y;
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
// Frame-rate-independent morph rates (matches MiraScene's budget).
const MORPH_BASE_RATE = 7.6;
const MORPH_KICK = 1.9;
const MORPH_KICK_DECAY = 5.0;
const PALETTE_RATE_2D = 1.52; // per-second palette blend (was PALR 0.025/frame)

export default function MiraOrb({
  presence = STEADY_PRESENCE,
  activity,
  size = 48,
  children,
  className,
  aestheticVector,
  fill = false,
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

  const tier = fill ? "hero" : renderTier(size);
  const effectivePresence = mergePresence(presence, activity);
  const ring = ringStyle(effectivePresence.posture);
  const useScene = fill || size >= SCENE_MIN_PX;
  // Fill mode: the 2D field paints at first frame while the scene chunk
  // loads, then crossfades to the instanced-capsule scene.
  const [sceneReady, setSceneReady] = useState(false);
  const [underlayGone, setUnderlayGone] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const drawsUnderlay = fill && !underlayGone;
  const [storedVector] = useState(() =>
    typeof window !== "undefined" ? readAestheticVector() : null,
  );
  const resolvedVector = aestheticVector ?? storedVector;
  const [reactionPulse, setReactionPulse] = useState(0);
  const [pokePulse, setPokePulse] = useState(0);
  const [pokeEpoch, setPokeEpoch] = useState(0);
  const { impulse } = useMiraImpulse();
  const attention = useAttentionSignals();
  const baseMorph = morphParamsForTier(effectivePresence, tier);
  // Modulate speed with attention — the whole scene breathes differently
  // based on whether the person is idle, focused, or returning.
  const morph: MorphParams = {
    ...baseMorph,
    speed: baseMorph.speed * breathMultiplier(attention),
    // Phase 3 poke: a transient brightness burst layered on the steady
    // nudgeAvailable boost. Decays over ~1.5s so the orb leans in once,
    // then settles to its slightly brighter resting state.
    brightness: baseMorph.brightness + pokePulse * 0.15,
  };
  const palette = vectorToPalette(resolvedVector);
  // Derive holdTension from posture — when Mira is "holding", the capsule
  // shell should exhibit surface-tension drip behavior.
  const holdTension = effectivePresence.posture === "holding" ? 0.7 : 0;

  // Gentle nudge when tab regains focus — Mira noticed you came back.
  const prevAttention = useRef(attention);
  const prevNudge = useRef(false);
  useEffect(() => {
    if (attention === "returning" && prevAttention.current !== "returning") {
      haptic("nudge");
      // If a nudge is waiting when you return, re-poke so you notice it.
      // Deferred to a rAF callback so we don't setState synchronously in
      // the effect body (avoids cascading renders).
      if (effectivePresence.nudgeAvailable) {
        requestAnimationFrame(() => setPokeEpoch((e) => e + 1));
      }
    }
    prevAttention.current = attention;
  }, [attention, effectivePresence.nudgeAvailable]);

  // Poke when a nudge becomes available — a one-time brightness lean-in.
  // For the two most decision-relevant nudge kinds (hold-expiring,
  // price-drop), also fire a gentle haptic so it's felt on mobile, not
  // just seen. The other kinds stay visual-only — restraint by default.
  useEffect(() => {
    if (effectivePresence.nudgeAvailable && !prevNudge.current) {
      setPokeEpoch((e) => e + 1);
      const kind = effectivePresence.nudgeKind;
      if (kind === "hold-expiring" || kind === "price-drop") {
        haptic("nudge");
      }
    }
    prevNudge.current = !!effectivePresence.nudgeAvailable;
  }, [effectivePresence.nudgeAvailable, effectivePresence.nudgeKind]);

  // Decay the poke pulse back to 0 over ~1.5s. The epoch counter restarts
  // the decay cleanly if a second poke fires mid-decay. The peak value is
  // set inside the first rAF tick (not synchronously in the effect body).
  useEffect(() => {
    if (pokeEpoch === 0) return;
    let raf = 0;
    const start = performance.now();
    const POKE_MS = 1500;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= POKE_MS) {
        setPokePulse(0);
        return;
      }
      setPokePulse(1 - elapsed / POKE_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pokeEpoch]);

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
    // Modulate breath duration with attention signals — idle slows, focus quickens.
    const baseDuration = parseFloat(breathDuration(effectivePresence.posture));
    const modulated = baseDuration * breathMultiplier(attention);
    orb.style.animationDuration = `${modulated}s`;
  }, [effectivePresence.posture, useScene, attention]);

  useEffect(() => {
    if (!fill || !sceneReady || underlayGone) return;
    const timer = window.setTimeout(
      () => setUnderlayGone(true),
      UNDERLAY_RELEASE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [fill, sceneReady, underlayGone]);

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
    if (useScene && !drawsUnderlay) return;
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
      lift: gl.getUniformLocation(prog, "u_lift"),
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

    const dpr = Math.min(window.devicePixelRatio || 1, fill ? 1.5 : 2);
    const fitCanvas = () => {
      const rect = fill ? canvas.getBoundingClientRect() : null;
      const px = Math.max(1, Math.round((rect?.width ?? size) * dpr));
      const py = Math.max(1, Math.round((rect?.height ?? size) * dpr));
      canvas.width = px;
      canvas.height = py;
      gl.viewport(0, 0, px, py);
      gl.uniform2f(u.res, px, py);
    };
    fitCanvas();
    gl.uniform1f(u.metaball, tier === "inline" ? 0 : 1);
    gl.uniform1f(u.lift, fill ? 0.08 : 0);

    liveGLOrbs++;

    const targetMorph = (): MorphParams =>
      morphParamsForTier(presenceRef.current, tier);

    const cur: MorphParams = { ...targetMorph() };
    let raf = 0;
    const start = performance.now();
    let prevSec = -1;
    let lastTarget: MorphParams = { ...targetMorph() };
    let kick = 1;

    const draw = (now: number) => {
      const target = targetMorph();
      // Frame-rate independent via real dt, with a response burst on change.
      const sec = now / 1000;
      const dt = prevSec < 0 ? 0 : frameDelta(prevSec, sec);
      prevSec = sec;
      if (paramsChanged(target, lastTarget)) {
        kick = MORPH_KICK;
        lastTarget = { ...target };
      }
      kick = 1 + (kick - 1) * Math.exp(-MORPH_KICK_DECAY * dt);
      const rate = MORPH_BASE_RATE * kick;
      cur.speed = smoothApproach(cur.speed, target.speed, rate, dt);
      cur.turbulence = smoothApproach(cur.turbulence, target.turbulence, rate, dt);
      cur.brightness = smoothApproach(cur.brightness, target.brightness, rate, dt);
      cur.blobCount = smoothApproach(cur.blobCount, target.blobCount, rate, dt);
      cur.orbitRadius = smoothApproach(cur.orbitRadius, target.orbitRadius, rate, dt);
      cur.orbitSpeed = smoothApproach(cur.orbitSpeed, target.orbitSpeed, rate, dt);
      cur.pinch = smoothApproach(cur.pinch, target.pinch, rate, dt);
      cur.bloom = smoothApproach(cur.bloom, target.bloom, rate, dt);
      cur.asymmetry = smoothApproach(cur.asymmetry, target.asymmetry, rate, dt);

      const tpal = paletteRef.current;
      const pfr = smoothFactor(PALETTE_RATE_2D, dt);
      for (let i = 0; i < 3; i++) {
        curPal.dark[i] = lerp(curPal.dark[i], tpal.dark[i], pfr);
        curPal.warm[i] = lerp(curPal.warm[i], tpal.warm[i], pfr);
        curPal.light[i] = lerp(curPal.light[i], tpal.light[i], pfr);
        curPal.cream[i] = lerp(curPal.cream[i], tpal.cream[i], pfr);
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

    let resizeObserver: ResizeObserver | null = null;
    if (fill && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        fitCanvas();
        // Resizing the backing store clears the canvas; the animated path
        // repaints next frame, the static path must repaint here.
        if (reduced) draw(start + 3200);
      });
      resizeObserver.observe(canvas);
    }

    if (reduced) {
      draw(start + 3200);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      liveGLOrbs = Math.max(0, liveGLOrbs - 1);
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    };
  }, [size, reduced, tier, useScene, fill, drawsUnderlay]);

  if (fill) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`relative h-full w-full ${className ?? ""}`}
      >
        {drawsUnderlay && (
          <canvas
            ref={canvasRef}
            aria-hidden
            className="absolute inset-0 h-full w-full"
            style={{
              opacity: sceneReady ? 0 : 1,
              // Ease-out crossfade: the scene fades in gently rather than
              // snapping over the 2D field, so the handoff never spikes
              // in luminance.
              transition: `opacity ${SCENE_FADE_MS}ms cubic-bezier(0.16,1,0.3,1)`,
            }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            opacity: sceneReady ? 1 : 0,
            transition: `opacity ${SCENE_FADE_MS}ms cubic-bezier(0.16,1,0.3,1)`,
          }}
        >
          <MiraScene
            fill
            size={size}
            morph={morph}
            palette={palette}
            reactionPulse={reactionPulse}
            impulse={impulse}
            holdTension={holdTension}
            onReady={handleSceneReady}
          />
        </div>
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {presenceAnnouncement(effectivePresence)}
        </span>
        {children}
      </motion.div>
    );
  }

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
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`flex flex-col items-center gap-3 ${className ?? ""}`}
    >
      {useScene ? (
        <div
          className="relative"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <MiraScene
            size={size}
            morph={morph}
            palette={palette}
            reactionPulse={reactionPulse}
            impulse={impulse}
            holdTension={holdTension}
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
    </motion.div>
  );
}

export type { MiraPresence, MiraActivity };
