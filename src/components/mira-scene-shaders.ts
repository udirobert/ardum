// Instanced-capsule shell shaders — a sea-anemone surface of capsules on a
// fibonacci sphere, reaching toward orbiting attractors. Technique study of
// emmelleppi/threejs-challenge-0 (instanced primitives + attractor fields),
// reimplemented for Ardum's palette and MorphParams vocabulary.

export const MIRA_VERT = /* glsl */ `
uniform float uTime;
uniform float uScale;      // capsule base scale
uniform float uRadius;     // shell base radius
uniform float uReach;      // extra capsule length near attractors (bloom)
uniform float uTurbulence; // sway amplitude
uniform float uPinch;      // inverts the attraction field
uniform float uImpulse;    // interaction ripple
uniform float uAsymmetry;  // hemisphere bias
uniform vec3 uAttractor0;
uniform vec3 uAttractor1;
uniform vec3 uAttractor2;
uniform vec3 uAttractor3;

attribute vec3 aOffset;  // unit-sphere anchor
attribute vec4 aQuat;    // rotates +Y onto the anchor normal
attribute float aRand;   // per-capsule phase seed

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vInfluence;
varying float vTip;

vec3 rotateByQuat(vec3 v, vec4 q) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

float attract(vec3 pos, vec3 center) {
  float d = length(pos - center);
  return clamp(1.0 / (3.0 * d * d + 0.12), 0.0, 1.0);
}

void main() {
  // Capsule geometry spans y in [-3, 3]; re-base so it grows outward.
  float tip = clamp((position.y + 3.0) / 6.0, 0.0, 1.0);
  vTip = tip;

  float inf = attract(aOffset, uAttractor0);
  inf = max(inf, attract(aOffset, uAttractor1));
  inf = max(inf, attract(aOffset, uAttractor2));
  inf = max(inf, attract(aOffset, uAttractor3));
  inf = mix(inf, 1.0 - inf, uPinch * 0.65);
  inf = clamp(inf + uAsymmetry * 0.3 * aOffset.x, 0.0, 1.0);
  vInfluence = inf;

  vec3 pos = position;
  pos.y += 3.0;
  float ripple = uImpulse * 0.45 * sin(uTime * 8.0 + aRand * 6.2832);
  pos.y *= 1.0 + inf * uReach + ripple;
  pos.xz *= 1.0 - inf * 0.25;

  // Tips sway; bases stay anchored.
  float sway = uTurbulence * 0.2 * tip * tip;
  pos.x += sin(uTime * (0.9 + aRand * 0.7) + aRand * 6.2832) * sway;
  pos.z += cos(uTime * (0.7 + aRand * 0.9) + aRand * 4.1) * sway;

  pos = rotateByQuat(pos * uScale, aQuat);
  vec3 shell = aOffset * uRadius + pos;

  vec4 world = modelMatrix * vec4(shell, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(normalMatrix * rotateByQuat(normal, aQuat));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const MIRA_FRAG = /* glsl */ `
uniform float uBrightness;
uniform float uImpulse;
uniform vec3 uDark;
uniform vec3 uWarm;
uniform vec3 uLight;
uniform vec3 uCream;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vInfluence;
varying float vTip;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(vec3(-0.6, 0.85, 0.4));
  float ndl = max(dot(N, L), 0.0);

  vec3 col = mix(uDark, uWarm, 0.25 + vTip * 0.75);
  col = mix(col, uLight, vInfluence * 0.7 * uBrightness);
  col = mix(
    col,
    uCream,
    smoothstep(0.7, 1.0, vTip) * (0.25 + vInfluence * 0.5) * uBrightness
  );

  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += fresnel * uCream * (0.25 + uImpulse * 0.3);

  col *= 0.58 + ndl * 0.55;
  gl_FragColor = vec4(col, 1.0);
}
`;
