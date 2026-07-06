"use client";

// CloudField — a procedural, volumetric cloud/mist field rendered live in
// WebGL. This is the generative visual layer of the aesthetic journey: not
// a stock photo, but an atmosphere that drifts, recolors, and thickens in
// response to the user's evolving preference vector — the *same* vector
// that drives the ambient drone (see AmbientDrone.vectorToDroneParams).
// Image and sound finally move together.
//
// The clouds are raymarched through a 3D fbm noise field with a simple
// single-scatter light model (Beer's law), following the approach in
// dghez/THREEJS_Procedural-clouds, reduced to a dependency-free raw-WebGL
// backdrop tuned for Ardum's warm terracotta/cream palette.
//
//   warm ↔ cool        → sky + cloud hue (terracotta/cream ↔ slate/blue)
//   energizing ↔ calming → drift speed + turbulence
//   light ↔ dark        → overall luminance
//   expansive ↔ intimate → cloud scale (broad soft forms ↔ close, dense)

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { AestheticVector } from "./image-pool";

type CloudFieldProps = {
  vector: AestheticVector;
  /** "backdrop" = subtler atmosphere behind content, "vision" = fuller payoff */
  variant?: "backdrop" | "vision";
  className?: string;
};

type CloudParams = {
  speed: number;
  turbulence: number;
  density: number;
  brightness: number;
  scale: number;
  sky: [number, number, number];
  warm: [number, number, number]; // cloud highlight
  dark: [number, number, number]; // cloud shadow
};

const mix3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Palette anchors (sRGB 0–1) across the warm↔cool × dark↔light square.
const SKY_WARM_LIGHT: [number, number, number] = [0.965, 0.925, 0.86]; // cream
const SKY_COOL_LIGHT: [number, number, number] = [0.83, 0.86, 0.9]; // pale slate
const SKY_WARM_DARK: [number, number, number] = [0.17, 0.11, 0.1]; // dusk terracotta
const SKY_COOL_DARK: [number, number, number] = [0.1, 0.12, 0.17]; // night slate

const HI_WARM: [number, number, number] = [1.0, 0.93, 0.82]; // warm cream highlight
const HI_COOL: [number, number, number] = [0.92, 0.95, 0.98]; // cool white highlight
const LO_WARM: [number, number, number] = [0.55, 0.3, 0.2]; // terracotta shadow
const LO_COOL: [number, number, number] = [0.34, 0.4, 0.48]; // slate shadow

// Map an aesthetic vector to cloud parameters — the visual twin of
// AmbientDrone.vectorToDroneParams.
export function vectorToCloudParams(
  v: AestheticVector,
  variant: "backdrop" | "vision",
): CloudParams {
  const warmth = v.warm - v.cool; // -1 cool .. 1 warm
  const energy = v.energizing - v.calming; // -1 calm .. 1 energizing
  const bright = v.light - v.dark; // -1 dark .. 1 light
  const space = v.expansive - v.intimate; // -1 intimate .. 1 expansive

  // Bias the neutral (0,0,0,0) state toward Ardum's warm/cream brand
  // palette. warmBias=0.65 means a neutral vector starts at 65% warm
  // rather than the exact midpoint. brightBias=0.7 keeps the initial sky
  // luminous so the backdrop never looks broken before any interactions.
  const warmBias = 0.65;
  const brightBias = 0.70;
  // Lerp the raw 0-1 warm/bright values toward brand bias anchors so the
  // neutral (0,0,0,0) vector reads as warm/cream rather than grey.
  const wt = Math.min(1, Math.max(0, (warmth + 1) / 2 * 0.45 + warmBias * 0.55));
  const brightRaw = (bright + 1) / 2;
  const bt = Math.min(1, brightRaw * 0.5 + brightBias * 0.5);
  const visionLift = variant === "vision" ? 0.10 : 0;

  const sky = mix3(
    mix3(SKY_COOL_DARK, SKY_WARM_DARK, wt),
    mix3(SKY_COOL_LIGHT, SKY_WARM_LIGHT, wt),
    Math.min(1, bt + visionLift),
  );
  const warm = mix3(HI_COOL, HI_WARM, wt);
  const dark = mix3(LO_COOL, LO_WARM, wt);

  return {
    speed: 0.05 + Math.max(0, energy) * 0.14 + (variant === "vision" ? 0.02 : 0),
    turbulence: 0.85 + Math.abs(energy) * 0.55,
    // Intimate + dark preferences → denser, closer clouds.
    density: 0.45 + Math.max(0, -space) * 0.28 + Math.max(0, -bright) * 0.12,
    // Brightness: neutral maps to 0.78 (luminous cream), not 0.55.
    brightness: 0.62 + bright * 0.28 + visionLift,
    // Expansive → larger, softer forms (lower frequency).
    scale: 1.5 - space * 0.45,
    sky,
    warm,
    dark,
  };
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_turb;
uniform float u_density;
uniform float u_bright;
uniform float u_scale;
uniform vec3  u_sky;
uniform vec3  u_warm;
uniform vec3  u_dark;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
        mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
        mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.3);
    a *= 0.5;
  }
  return v;
}

float cloudDensity(vec3 p) {
  vec3 drift = vec3(u_time * u_speed, u_time * u_speed * 0.15, u_time * u_speed * 0.4);
  float d = fbm(p * u_scale + drift * u_turb);
  d = smoothstep(0.55 - u_density * 0.35, 0.95, d);
  return d * u_density;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;

  vec3 ro = vec3(0.0, 0.0, -4.0);
  vec3 rd = normalize(vec3(uv, 1.4));
  vec3 sun = normalize(vec3(-0.5, 0.7, 0.3));

  const int STEPS = 20;
  float tStart = 2.0;
  float tEnd = 8.0;
  float stepSize = (tEnd - tStart) / float(STEPS);
  float t = tStart;

  float transmittance = 1.0;
  vec3 acc = vec3(0.0);

  for (int i = 0; i < STEPS; i++) {
    vec3 pos = ro + rd * t;
    float d = cloudDensity(pos);
    if (d > 0.01) {
      // Single-scatter: sample density toward the sun for self-shadowing.
      float lit = cloudDensity(pos + sun * 0.35);
      float shadow = clamp(d - lit, 0.0, 1.0);
      vec3 col = mix(u_dark, u_warm, shadow * 1.6 + 0.15) * u_bright;
      float a = d * 0.42;
      acc += transmittance * a * col;
      transmittance *= (1.0 - a);
      if (transmittance < 0.02) break;
    }
    t += stepSize;
  }

  // Vertical sky gradient — lighter toward the top.
  float grad = clamp(uv.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = u_sky * (0.82 + grad * 0.28);

  vec3 final = acc + sky * transmittance;
  gl_FragColor = vec4(final, 1.0);
}
`;

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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (
  c: [number, number, number],
  target: [number, number, number],
  t: number,
) => {
  c[0] = lerp(c[0], target[0], t);
  c[1] = lerp(c[1], target[1], t);
  c[2] = lerp(c[2], target[2], t);
};

export default function CloudField({
  vector,
  variant = "backdrop",
  className,
}: CloudFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vectorRef = useRef(vector);
  const variantRef = useRef(variant);
  const reduced = useReducedMotion();

  useEffect(() => {
    vectorRef.current = vector;
  }, [vector]);
  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl", { alpha: false, antialias: false }) as
        | WebGLRenderingContext
        | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
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
      density: gl.getUniformLocation(prog, "u_density"),
      bright: gl.getUniformLocation(prog, "u_bright"),
      scale: gl.getUniformLocation(prog, "u_scale"),
      sky: gl.getUniformLocation(prog, "u_sky"),
      warm: gl.getUniformLocation(prog, "u_warm"),
      dark: gl.getUniformLocation(prog, "u_dark"),
    };

    // Render at a reduced scale for perf — clouds are soft, so this is
    // imperceptible but much cheaper than full-res raymarching.
    const renderScale = variantRef.current === "vision" ? 0.8 : 0.65;
    let ro: ResizeObserver | null = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * renderScale));
      const h = Math.max(1, Math.round(rect.height * renderScale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(u.res, canvas.width, canvas.height);
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
    }

    // Current params ease toward the target derived from the live vector.
    const cur = vectorToCloudParams(vectorRef.current, variantRef.current);
    let raf = 0;
    const start = performance.now();

    // Track visibility — pause the RAF loop when the canvas is off-screen
    // (e.g. the user has scrolled down to the reasoning section). This
    // saves GPU cycles without any visible change.
    let visible = true;
    const io: IntersectionObserver | null =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0]?.isIntersecting ?? true;
              if (visible && !reduced && !raf) {
                raf = requestAnimationFrame(draw);
              } else if (!visible && raf) {
                cancelAnimationFrame(raf);
                raf = 0;
              }
            },
            { threshold: 0 },
          )
        : null;
    if (io) io.observe(canvas);

    const draw = (now: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      const target = vectorToCloudParams(vectorRef.current, variantRef.current);
      const k = 0.03;
      cur.speed = lerp(cur.speed, target.speed, k);
      cur.turbulence = lerp(cur.turbulence, target.turbulence, k);
      cur.density = lerp(cur.density, target.density, k);
      cur.brightness = lerp(cur.brightness, target.brightness, k);
      cur.scale = lerp(cur.scale, target.scale, k);
      lerp3(cur.sky, target.sky, k);
      lerp3(cur.warm, target.warm, k);
      lerp3(cur.dark, target.dark, k);

      gl.uniform1f(u.time, (now - start) / 1000);
      gl.uniform1f(u.speed, cur.speed);
      gl.uniform1f(u.turb, cur.turbulence);
      gl.uniform1f(u.density, cur.density);
      gl.uniform1f(u.bright, cur.brightness);
      gl.uniform1f(u.scale, cur.scale);
      gl.uniform3fv(u.sky, cur.sky);
      gl.uniform3fv(u.warm, cur.warm);
      gl.uniform3fv(u.dark, cur.dark);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    if (reduced) draw(start + 4000);
    else raf = requestAnimationFrame(draw);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
