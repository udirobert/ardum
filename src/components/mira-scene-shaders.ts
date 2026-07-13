// Warm terracotta attractor-deformation shaders — inspired by
// emmelleppi/threejs-challenge-0, tuned for Ardum's palette.

export const MIRA_VERT = /* glsl */ `
uniform float uTime;
uniform float uPinch;
uniform float uBloom;
uniform float uTurbulence;
uniform float uImpulse;
uniform vec3 uAttractor0;
uniform vec3 uAttractor1;
uniform vec3 uAttractor2;
uniform vec3 uAttractor3;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDisp;

float attract(vec3 pos, vec3 center) {
  float d = length(pos - center);
  return clamp(1.0 / (3.5 * d * d + 0.08), 0.0, 1.0);
}

void main() {
  vec3 pos = position;
  vec3 norm = normal;

  float d0 = attract(pos, uAttractor0);
  float d1 = attract(pos, uAttractor1);
  float d2 = attract(pos, uAttractor2);
  float d3 = attract(pos, uAttractor3);
  float displacement = max(max(d0, d1), max(d2, d3));
  displacement = mix(displacement, 1.0 - displacement, uPinch * 0.65);
  vDisp = displacement;

  pos += norm * displacement * (0.22 + uBloom * 0.28) * uTurbulence;
  pos += norm * sin(uTime * 1.4 + length(pos) * 4.0) * 0.012 * uTurbulence;
  pos += norm * uImpulse * 0.08 * sin(uTime * 8.0);

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(normalMatrix * norm);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const MIRA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uBrightness;
uniform float uImpulse;
uniform vec3 uDark;
uniform vec3 uWarm;
uniform vec3 uLight;
uniform vec3 uCream;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDisp;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(vec3(-0.6, 0.85, 0.4));
  float ndl = max(dot(N, L), 0.0);

  float vein = sin(vDisp * 12.0 + uTime * 0.35) * 0.5 + 0.5;
  vec3 col = mix(uDark, uWarm, vein);
  col = mix(col, uLight, pow(ndl, 2.0) * 0.55 * uBrightness);
  col = mix(col, uCream, smoothstep(0.55, 0.92, vDisp) * 0.35 * uBrightness);

  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += fresnel * uCream * (0.35 + uImpulse * 0.25);

  float rim = smoothstep(0.2, 0.95, ndl);
  col *= 0.55 + rim * 0.55;

  gl_FragColor = vec4(col, 0.92 + fresnel * 0.08);
}
`;
