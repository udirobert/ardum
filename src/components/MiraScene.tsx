"use client";

// Hero-tier Mira — attractor deformation + warm glass core + bloom.

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

function AttractorShell({
  morph,
  palette,
  reactionPulse,
  impulse = 0,
}: Omit<Props, "size">) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uPinch: { value: morph.pinch },
      uBloom: { value: morph.bloom },
      uTurbulence: { value: morph.turbulence },
      uBrightness: { value: morph.brightness },
      uImpulse: { value: 0 },
      uAttractor0: { value: new THREE.Vector3() },
      uAttractor1: { value: new THREE.Vector3() },
      uAttractor2: { value: new THREE.Vector3() },
      uAttractor3: { value: new THREE.Vector3() },
      uDark: { value: new THREE.Vector3(...palette.dark) },
      uWarm: { value: new THREE.Vector3(...palette.warm) },
      uLight: { value: new THREE.Vector3(...palette.light) },
      uCream: { value: new THREE.Vector3(...palette.cream) },
    };
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: MIRA_VERT,
      fragmentShader: MIRA_FRAG,
      transparent: true,
    });
  }, [palette.cream, palette.dark, palette.light, palette.warm, morph.bloom, morph.brightness, morph.pinch, morph.turbulence]);

  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 5), []);

  // r3f useFrame intentionally mutates shader uniforms each tick.
  /* eslint-disable react-hooks/immutability */
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const m = mesh.current;
    if (!m) return;
    const u = mat.uniforms as Record<string, THREE.IUniform>;

    u.uTime.value = t;
    u.uPinch.value = morph.pinch + reactionPulse * 0.4 + impulse * 0.25;
    u.uBloom.value = morph.bloom + reactionPulse * 0.15 + impulse * 0.35;
    u.uTurbulence.value = morph.turbulence + impulse * 0.5;
    u.uBrightness.value = morph.brightness + impulse * 0.2;
    u.uImpulse.value = impulse;
    u.uDark.value.set(...palette.dark);
    u.uWarm.value.set(...palette.warm);
    u.uLight.value.set(...palette.light);
    u.uCream.value.set(...palette.cream);

    const configs = [
      { speed: 1.0, phase: 0.9, plane: 0 },
      { speed: 0.75, phase: 2.1, plane: 1 },
      { speed: 0.5, phase: 1.4, plane: 2 },
      { speed: 1.2, phase: 0.5, plane: 0 },
    ];
    const attractors = [
      u.uAttractor0.value as THREE.Vector3,
      u.uAttractor1.value as THREE.Vector3,
      u.uAttractor2.value as THREE.Vector3,
      u.uAttractor3.value as THREE.Vector3,
    ];
    const orbit = morph.orbitRadius * 4.5 + 0.35 + impulse * 0.25;

    for (let i = 0; i < 4; i++) {
      if (i >= morph.blobCount) {
        attractors[i].set(0, 0, 0);
        continue;
      }
      const c = configs[i];
      const angle = t * morph.orbitSpeed * c.speed * (1 + impulse * 0.4) + c.phase;
      if (c.plane === 0) {
        attractors[i].set(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 0);
      } else if (c.plane === 1) {
        attractors[i].set(Math.cos(angle) * orbit, 0, Math.sin(angle) * orbit);
      } else {
        attractors[i].set(0, Math.cos(angle) * orbit, Math.sin(angle) * orbit);
      }
    }

    m.rotation.y = t * (0.08 + impulse * 0.05);
    m.rotation.x = Math.sin(t * 0.12) * 0.08;
    const breath = 1 + Math.sin(t * 0.85) * 0.06 + impulse * 0.08;
    m.scale.setScalar(breath);
  });
  /* eslint-enable react-hooks/immutability */

  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => mat.dispose(), [mat]);

  return <mesh ref={mesh} geometry={geo} material={mat} />;
}

function GlassCore({ impulse }: { impulse: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    ref.current.rotation.y = -t * 0.15;
    ref.current.rotation.z = Math.sin(t * 0.2) * 0.1;
    const s = 0.42 + impulse * 0.06;
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
      <AttractorShell {...props} impulse={impulse} />
      <EffectComposer enableNormalPass={false}>
        <Bloom
          intensity={1.1 + impulse * 0.5}
          luminanceThreshold={0.28}
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
