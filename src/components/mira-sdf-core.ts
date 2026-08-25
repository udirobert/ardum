// Raymarched SDF core shaders — a living liquid interior for Mira's orb.
// Inspired by github.com/phobon/raymarching-tsl and kishimisu's raymarching
// starter. Signed-distance-field metaballs with smooth-union blending,
// noise displacement, and simple lighting produce topology-changing liquid
// blob merges driven by MorphParams.
// The exponential smooth-min (log-sum-exp) blend follows koji014's
// "interactive-droplets" ray-marched metaball technique for rounded, liquid
// merges; spire-1 orbit + fbm displacement remain Ardum's own.
//
// Rendered on a fullscreen quad inside the R3F scene, positioned behind the
// capsule shell. The fragment shader does all the work — the vertex shader
// just passes through normalized coordinates.

export const SDF_CORE_VERT = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const SDF_CORE_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uBlobCount;    // 1–4 active SDF primitives
uniform float uOrbitSpeed;   // rotation velocity
uniform float uTurbulence;   // noise displacement amplitude
uniform float uAsymmetry;    // non-uniform scaling
uniform float uBloom;        // smooth-union blending radius
uniform float uPinch;        // inversion / contraction
uniform float uBrightness;   // overall luminance
uniform float uImpulse;      // interaction pulse
uniform vec2  uResolution;   // render target size
uniform vec3  uDark;         // palette: deep tone
uniform vec3  uWarm;         // palette: mid-warm
uniform vec3  uLight;        // palette: highlights
uniform vec3  uCream;        // palette: bright peak

varying vec2 vUv;

// ─── SDF Primitives ─────────────────────────────────────────────────────

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 radii) {
  float k0 = length(p / radii);
  float k1 = length(p / (radii * radii));
  return k0 * (k0 - 1.0) / k1;
}

// Smooth minimum (exponential / log-sum-exp) — a rounded, purely liquid merge.
// Unlike the polynomial smooth min, the exponential kernel produces a clean
// tapering neck between bodies and avoids the wider hump at larger blend radii.
// Note the sign: here a *smaller* k yields a *wider, more fluid* merge (the
// transition width is ~1/k), so callers pass a blend width that inverts to k.
// Far sentinel values (1e6) underflow exp(-k*1e6) to 0 and collapse to the
// other operand, so a "min" accumulator is safe to chain through this too.
float smin(float a, float b, float k) {
  float e = exp(-k * a) + exp(-k * b);
  return -log(e) / k;
}

// ─── Noise ──────────────────────────────────────────────────────────────

// Simple 3D hash for organic displacement
float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
      mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x),
      f.y
    ),
    mix(
      mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
      mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x),
      f.y
    ),
    f.z
  );
}

// Fractional Brownian motion for richer displacement
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise3D(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ─── Scene SDF ──────────────────────────────────────────────────────────

float sceneSDF(vec3 p) {
  float t = uTime;

  // Noise displacement — organic surface deformation
  float disp = fbm(p * 2.5 + t * 0.3) * uTurbulence * 0.15;

  // Core sphere — always present
  float core = sdSphere(p + disp * normalize(p + 0.001), 0.32);

  // Blend width driven by bloom (posture) + impulse — higher blend reads more
  // liquid. The exponential smooth-min's spacing is the inverse (~1/k), so we
  // invert the width into `k`. Range here lands k ≈ 8 (tight) .. ~2.5 (warm,
  // fully merged), keeping exp() inside safe float range for our field scale.
  float w = 0.10 + uBloom * 0.3 + uImpulse * 0.15;
  float k = 1.0 / (w + 0.02);

  // Orbiting blobs — count controlled by uBlobCount
  float blobs = 1e6;

  // Blob 1
  if (uBlobCount > 0.5) {
    float angle1 = t * uOrbitSpeed * 0.8;
    vec3 p1 = vec3(
      cos(angle1) * 0.38,
      sin(angle1 * 0.7) * 0.25 * (1.0 + uAsymmetry * 0.5),
      sin(angle1) * 0.38
    );
    float r1 = 0.14 + uImpulse * 0.04;
    float b1 = sdSphere(p - p1 + disp * 0.5, r1);
    blobs = smin(blobs, b1, k);
  }

  // Blob 2
  if (uBlobCount > 1.5) {
    float angle2 = t * uOrbitSpeed * 0.6 + 2.094;
    vec3 p2 = vec3(
      sin(angle2) * 0.35 * (1.0 - uAsymmetry * 0.3),
      cos(angle2 * 1.3) * 0.3,
      cos(angle2) * 0.35
    );
    float r2 = 0.12 + uImpulse * 0.03;
    float b2 = sdEllipsoid(
      p - p2 + disp * 0.4,
      vec3(r2 * 1.2, r2, r2 * 0.9)
    );
    blobs = smin(blobs, b2, k);
  }

  // Blob 3
  if (uBlobCount > 2.5) {
    float angle3 = t * uOrbitSpeed * 1.1 + 4.189;
    vec3 p3 = vec3(
      cos(angle3 * 0.9) * 0.42,
      sin(angle3) * 0.18 - uPinch * 0.15,
      sin(angle3 * 0.9) * 0.28
    );
    float r3 = 0.10 + uImpulse * 0.025;
    float b3 = sdSphere(p - p3 + disp * 0.3, r3);
    blobs = smin(blobs, b3, k);
  }

  // Blob 4
  if (uBlobCount > 3.5) {
    float angle4 = t * uOrbitSpeed * 0.5 + 1.047;
    vec3 p4 = vec3(
      sin(angle4 * 1.2) * 0.3,
      cos(angle4) * 0.4 * (1.0 + uAsymmetry * 0.4),
      cos(angle4 * 0.8) * 0.33
    );
    float r4 = 0.09;
    float b4 = sdSphere(p - p4 + disp * 0.35, r4);
    blobs = smin(blobs, b4, k);
  }

  // Smooth union: blobs merge into core with liquid topology change
  float scene = smin(core, blobs, k);

  // Pinch: contracts the entire field inward
  scene += uPinch * 0.08 * (1.0 - smoothstep(0.0, 0.5, length(p)));

  return scene;
}

// ─── Raymarching ────────────────────────────────────────────────────────

vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  return normalize(vec3(
    sceneSDF(p + vec3(h, 0, 0)) - sceneSDF(p - vec3(h, 0, 0)),
    sceneSDF(p + vec3(0, h, 0)) - sceneSDF(p - vec3(0, h, 0)),
    sceneSDF(p + vec3(0, 0, h)) - sceneSDF(p - vec3(0, 0, h))
  ));
}

float raymarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) return t;
    if (t > 4.0) break;
    t += d;
  }
  return -1.0;
}

// ─── Lighting & Shading ─────────────────────────────────────────────────

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  // Camera: looking at origin from z = 2.2
  vec3 ro = vec3(0.0, 0.0, 2.2);
  vec3 rd = normalize(vec3(uv, -1.8));

  float t = raymarch(ro, rd);

  if (t < 0.0) {
    // Miss — transparent background (composited over the dusk field)
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec3 p = ro + rd * t;
  vec3 N = calcNormal(p);
  vec3 V = normalize(ro - p);

  // Two-light setup matching MiraScene's directional lights
  vec3 L1 = normalize(vec3(-0.6, 0.85, 0.4));
  vec3 L2 = normalize(vec3(0.5, -0.3, -0.6));

  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.35;

  // Specular (Blinn-Phong)
  vec3 H1 = normalize(L1 + V);
  float spec1 = pow(max(dot(N, H1), 0.0), 32.0) * 0.6;
  vec3 H2 = normalize(L2 + V);
  float spec2 = pow(max(dot(N, H2), 0.0), 16.0) * 0.2;

  // Fresnel rim
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.5);

  // Color: blend across palette based on position + normal
  float yFactor = smoothstep(-0.4, 0.4, p.y);
  float edgeFactor = smoothstep(0.0, 0.5, length(p.xz));
  vec3 baseColor = mix(uDark, uWarm, yFactor * 0.8);
  baseColor = mix(baseColor, uLight, edgeFactor * 0.4 * uBrightness);

  // Compose lighting
  vec3 col = baseColor * (0.35 + diff1 * 0.55 + diff2);
  col += uCream * spec1;
  col += uWarm * spec2;
  col += uCream * fresnel * (0.3 + uImpulse * 0.4) * uBrightness;

  // Subsurface-scatter approximation: warm glow from behind
  float scatter = max(dot(-N, L1), 0.0);
  col += uWarm * scatter * 0.15 * uBrightness;

  // Soft edge fade to transparent (so it blends into the capsule shell)
  float edgeAlpha = smoothstep(0.5, 0.35, length(p.xz));
  float alpha = 0.85 + fresnel * 0.15;
  alpha *= edgeAlpha;

  gl_FragColor = vec4(col, alpha);
}
`;
