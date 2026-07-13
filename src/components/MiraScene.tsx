"use client";

// Hero-tier Mira — an anemone shell of instanced capsules reaching toward
// orbiting glass satellites, around a warm transmission core. Posture,
// valence, and reactions arrive as MorphParams and are eased per frame.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, MeshTransmissionMaterial } from "@react-three/drei";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { MorphParams } from "@/agent/mira-presence";
import { MIRA_FRAG, MIRA_VERT } from "./mira-scene-shaders";

type RGB = [number, number, number];

type Props = {
  size: number;
  morph: MorphParams;
  palette: { dark: RGB; warm: RGB; light: RGB; cream: RGB };
  reactionPulse: number;
  impulse?: number;
};

const SHELL_RADIUS = 0.62;
const CAPSULE_SCALE = 0.05;
const MAX_SATELLITES = 4;
const FAR_AWAY = new THREE.Vector3(0, 0, 50);
const TMP_COLOR = new THREE.Vector3();

const ATTRACTOR_CONFIGS = [
  { speed: 1.0, phase: 0.9, plane: 0 },
  { speed: 0.75, phase: 2.1, plane: 1 },
  { speed: 0.5, phase: 1.4, plane: 2 },
  { speed: 1.2, phase: 0.5, plane: 0 },
] as const;

function attractorPosition(
  out: THREE.Vector3,
  index: number,
  t: number,
  orbitSpeed: number,
  orbit: number,
  impulse: number,
) {
  const c = ATTRACTOR_CONFIGS[index];
  const angle = t * orbitSpeed * c.speed * (1 + impulse * 0.4) + c.phase;
  if (c.plane === 0) {
    out.set(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 0);
  } else if (c.plane === 1) {
    out.set(Math.cos(angle) * orbit, 0, Math.sin(angle) * orbit);
  } else {
    out.set(0, Math.cos(angle) * orbit, Math.sin(angle) * orbit);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function CapsuleShell({
  morph,
  palette,
  reactionPulse,
  impulse = 0,
}: Omit<Props, "size">) {
  const group = useRef<THREE.Group>(null);
  const { size: viewport } = useThree();
  const count = viewport.width >= 96 ? 2400 : 1400;

  const satelliteRefs = useRef<(THREE.Mesh | null)[]>([]);
  const cur = useRef<MorphParams>({ ...morph });

  const geometry = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.28, 4, 3, 6);

    const offsets = new Float32Array(count * 3);
    const quats = new Float32Array(count * 4);
    const rands = new Float32Array(count);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      dir.set(Math.cos(theta) * r, y, Math.sin(theta) * r).normalize();
      quat.setFromUnitVectors(up, dir);

      offsets.set([dir.x, dir.y, dir.z], i * 3);
      quats.set([quat.x, quat.y, quat.z, quat.w], i * 4);
      // Deterministic per-capsule phase seed (render-pure, stable across mounts).
      rands[i] = Math.abs(Math.sin(i * 127.1 + 311.7)) % 1;
    }

    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute("aQuat", new THREE.InstancedBufferAttribute(quats, 4));
    geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(rands, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: MIRA_VERT,
        fragmentShader: MIRA_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: CAPSULE_SCALE },
          uRadius: { value: SHELL_RADIUS },
          uReach: { value: 0.35 },
          uTurbulence: { value: 0.75 },
          uPinch: { value: 0 },
          uImpulse: { value: 0 },
          uAsymmetry: { value: 0 },
          uBrightness: { value: 0.55 },
          uAttractor0: { value: new THREE.Vector3().copy(FAR_AWAY) },
          uAttractor1: { value: new THREE.Vector3().copy(FAR_AWAY) },
          uAttractor2: { value: new THREE.Vector3().copy(FAR_AWAY) },
          uAttractor3: { value: new THREE.Vector3().copy(FAR_AWAY) },
          uDark: { value: new THREE.Vector3() },
          uWarm: { value: new THREE.Vector3() },
          uLight: { value: new THREE.Vector3() },
          uCream: { value: new THREE.Vector3() },
        },
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // r3f useFrame intentionally mutates uniforms and transforms each tick.
  /* eslint-disable react-hooks/immutability */
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;

    // Ease toward the posture target so state changes glide, never snap.
    const target = morph;
    const c = cur.current;
    const M = 0.05;
    c.turbulence = lerp(c.turbulence, target.turbulence, M);
    c.brightness = lerp(c.brightness, target.brightness, M);
    c.blobCount = lerp(c.blobCount, target.blobCount, M);
    c.orbitRadius = lerp(c.orbitRadius, target.orbitRadius, M);
    c.orbitSpeed = lerp(c.orbitSpeed, target.orbitSpeed, M);
    c.pinch = lerp(c.pinch, target.pinch, M);
    c.bloom = lerp(c.bloom, target.bloom, M);
    c.asymmetry = lerp(c.asymmetry, target.asymmetry, M);

    const u = material.uniforms;
    u.uTime.value = t;
    u.uTurbulence.value = c.turbulence + impulse * 0.5;
    u.uPinch.value = c.pinch + reactionPulse * 0.4;
    u.uReach.value = 0.35 + c.bloom * 1.4 + reactionPulse * 0.3 + impulse * 0.3;
    u.uBrightness.value = c.brightness + reactionPulse * 0.15 + impulse * 0.2;
    u.uImpulse.value = impulse;
    u.uAsymmetry.value = c.asymmetry;

    const PAL = 0.06;
    (u.uDark.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.dark), PAL);
    (u.uWarm.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.warm), PAL);
    (u.uLight.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.light), PAL);
    (u.uCream.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.cream), PAL);

    // Attractors orbit in shell-anchor space; satellites mirror them in
    // group-local space so both stay aligned under the group's rotation.
    const orbit = 1.0 + c.orbitRadius * 2.5 + impulse * 0.15;
    const attractors = [
      u.uAttractor0.value,
      u.uAttractor1.value,
      u.uAttractor2.value,
      u.uAttractor3.value,
    ] as THREE.Vector3[];

    for (let i = 0; i < MAX_SATELLITES; i++) {
      const presence = Math.max(0, Math.min(1, c.blobCount - i));
      const sat = satelliteRefs.current[i];
      if (presence <= 0.01) {
        attractors[i].copy(FAR_AWAY);
        sat?.scale.setScalar(0.0001);
        continue;
      }
      attractorPosition(attractors[i], i, t, c.orbitSpeed, orbit, impulse);
      if (sat) {
        sat.position.copy(attractors[i]).multiplyScalar(SHELL_RADIUS);
        sat.scale.setScalar(0.13 * presence);
        sat.rotation.y = t * 0.4 + i;
      }
    }

    g.rotation.y = t * (0.08 + impulse * 0.05);
    g.rotation.x = Math.sin(t * 0.12) * 0.08;
    const breath = 1 + Math.sin(t * 0.85) * 0.05 + impulse * 0.08;
    g.scale.setScalar(breath);
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group ref={group}>
      <instancedMesh args={[geometry, material, count]} frustumCulled={false} />
      {Array.from({ length: MAX_SATELLITES }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            satelliteRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 32, 32]} />
          <meshPhysicalMaterial
            transmission={1}
            thickness={0.35}
            roughness={0.08}
            ior={1.45}
            color="#f0dcc8"
            attenuationColor="#d8a892"
            attenuationDistance={1.2}
            envMapIntensity={0.12}
          />
        </mesh>
      ))}
    </group>
  );
}

function GlassCore({ impulse }: { impulse: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    ref.current.rotation.y = -t * 0.15;
    ref.current.rotation.z = Math.sin(t * 0.2) * 0.1;
    const s = 0.46 + impulse * 0.06;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 48, 48]} />
      <MeshTransmissionMaterial
        backside
        samples={6}
        resolution={256}
        transmission={0.98}
        thickness={0.65}
        chromaticAberration={0.12}
        anisotropy={0.25}
        distortion={0.15 + impulse * 0.2}
        distortionScale={0.35}
        temporalDistortion={0.18}
        roughness={0.05}
        ior={1.45}
        color="#f6d4c0"
        attenuationColor="#6e3925"
        attenuationDistance={1.8}
        envMapIntensity={0.25}
      />
    </mesh>
  );
}

function Backdrop() {
  const { scene } = useThree();
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/immutability -- transparent canvas over page background */
    scene.background = null;
  }, [scene]);
  return (
    <mesh position={[0, 0, -2]} scale={[6, 6, 1]}>
      <planeGeometry />
      <meshBasicMaterial color="#f6e8dc" transparent opacity={0.15} />
    </mesh>
  );
}

function SceneInner(props: Omit<Props, "size">) {
  const impulse = props.impulse ?? 0;
  return (
    <>
      <Backdrop />
      <ambientLight intensity={0.4} color="#f6e8dc" />
      <directionalLight position={[-2, 3, 2]} intensity={1.6} color="#ffe8d0" />
      <directionalLight position={[2, -1, -2]} intensity={0.35} color="#6e3925" />
      <pointLight position={[0, 0, 1.5]} intensity={0.8 * (1 + impulse)} color="#d8a892" />
      <Environment preset="sunset" />
      <GlassCore impulse={impulse} />
      <CapsuleShell {...props} impulse={impulse} />
      <EffectComposer enableNormalPass={false}>
        <Bloom
          intensity={1.0 + impulse * 0.5}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0015, 0.0015)}
        />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </>
  );
}

export default function MiraScene({
  size,
  morph,
  palette,
  reactionPulse,
  impulse = 0,
}: Props) {
  const reduced = useReducedMotion();
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);

  if (reduced) {
    return (
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 35% 30%, rgba(168,90,58,0.55), rgba(110,57,37,0.9))",
        }}
      />
    );
  }

  return (
    <div style={{ width: size, height: size }} className="relative">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, 3.2], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{ width: size, height: size }}
      >
        <SceneInner
          morph={morph}
          palette={palette}
          reactionPulse={reactionPulse}
          impulse={impulse}
        />
      </Canvas>
    </div>
  );
}
