"use client";

// Hero-tier Mira — an anemone shell of instanced capsules reaching toward
// orbiting glass satellites, around a warm transmission core. Posture,
// valence, and reactions arrive as MorphParams and are eased per frame.

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useWebGLAvailable } from "@/hooks/useWebGLAvailable";
import type { MorphParams } from "@/agent/mira-presence";
import { MIRA_FRAG, MIRA_VERT } from "./mira-scene-shaders";
import { SDF_CORE_VERT, SDF_CORE_FRAG } from "./mira-sdf-core";
import {
  frameDelta,
  paramsChanged,
  smoothApproach,
  smoothFactor,
} from "@/lib/motion";

type RGB = [number, number, number];

type Props = {
  size: number;
  morph: MorphParams;
  palette: { dark: RGB; warm: RGB; light: RGB; cream: RGB };
  reactionPulse: number;
  impulse?: number;
  /** 0–1 surface-tension drip when a hold is active. */
  holdTension?: number;
  /** Fill the parent instead of rendering a fixed `size` square. */
  fill?: boolean;
  /** Fires once the scene can be shown — GL created, or static reduced-motion frame mounted. */
  onReady?: () => void;
};

const SHELL_RADIUS = 0.62;
const CAPSULE_SCALE = 0.05;
// Per-second morph rates (frame-rate-independent replacements for the old
// per-frame lerp factors): MORPH_BASE_RATE ≈ the old 0.12/frame at 60 Hz.
const MORPH_BASE_RATE = 7.6;
const MORPH_KICK = 1.9; // burst multiplier when a posture changes
const MORPH_KICK_DECAY = 5.0; // per-second decay back to the glide rate
const PALETTE_RATE = 3.5; // per-second palette blend (was PAL 0.06/frame)
const PARALLAX_RATE = 2.75; // per-second camera parallax (was 0.045/frame)
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
  holdTension = 0,
}: Omit<Props, "size">) {
  const group = useRef<THREE.Group>(null);
  const { size: viewport } = useThree();
  const count = viewport.width >= 96 ? 2400 : 1400;

  const satelliteRefs = useRef<(THREE.Mesh | null)[]>([]);
  const cur = useRef<MorphParams>({ ...morph });
  const prevT = useRef(0);
  const lastTarget = useRef<MorphParams>({ ...morph });
  const kick = useRef(1);

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
          uHoldTension: { value: 0 },
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

    // Ease toward the posture target so motion glides, never snaps.
    // Frame-rate independent via `dt`, with a response burst on change.
    const dt = frameDelta(prevT.current, t);
    prevT.current = t;
    if (paramsChanged(morph, lastTarget.current)) {
      kick.current = MORPH_KICK;
      lastTarget.current = { ...morph };
    }
    kick.current = 1 + (kick.current - 1) * Math.exp(-MORPH_KICK_DECAY * dt);
    const rate = MORPH_BASE_RATE * kick.current;

    const target = morph;
    const c = cur.current;
    c.turbulence = smoothApproach(c.turbulence, target.turbulence, rate, dt);
    c.brightness = smoothApproach(c.brightness, target.brightness, rate, dt);
    c.blobCount = smoothApproach(c.blobCount, target.blobCount, rate, dt);
    c.orbitRadius = smoothApproach(c.orbitRadius, target.orbitRadius, rate, dt);
    c.orbitSpeed = smoothApproach(c.orbitSpeed, target.orbitSpeed, rate, dt);
    c.pinch = smoothApproach(c.pinch, target.pinch, rate, dt);
    c.bloom = smoothApproach(c.bloom, target.bloom, rate, dt);
    c.asymmetry = smoothApproach(c.asymmetry, target.asymmetry, rate, dt);

    const u = material.uniforms;
    u.uTime.value = t;
    u.uTurbulence.value = c.turbulence + impulse * 0.5;
    u.uPinch.value = c.pinch + reactionPulse * 0.4;
    u.uReach.value = 0.35 + c.bloom * 1.4 + reactionPulse * 0.3 + impulse * 0.3;
    u.uBrightness.value = c.brightness + reactionPulse * 0.15 + impulse * 0.2;
    u.uImpulse.value = impulse;
    u.uAsymmetry.value = c.asymmetry;
    u.uHoldTension.value = lerp(u.uHoldTension.value, holdTension, 0.06);

    const pf = smoothFactor(PALETTE_RATE, dt);
    (u.uDark.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.dark), pf);
    (u.uWarm.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.warm), pf);
    (u.uLight.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.light), pf);
    (u.uCream.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.cream), pf);

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

/**
 * SDFCore — raymarched signed-distance-field metaball interior.
 * Renders on a screen-space quad using a custom fragment shader that
 * raymarches SDF primitives with smooth-union blending. The topology of
 * the blobs changes continuously as they orbit and merge — something
 * mesh geometry cannot achieve.
 *
 * Inspired by github.com/phobon/raymarching-tsl.
 */
function SDFCore({
  morph,
  palette,
  impulse = 0,
}: {
  morph: MorphParams;
  palette: { dark: RGB; warm: RGB; light: RGB; cream: RGB };
  impulse: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const cur = useRef<MorphParams>({ ...morph });
  const prevT = useRef(0);
  const lastTarget = useRef<MorphParams>({ ...morph });
  const kick = useRef(1);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SDF_CORE_VERT,
        fragmentShader: SDF_CORE_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uBlobCount: { value: morph.blobCount },
          uOrbitSpeed: { value: morph.orbitSpeed },
          uTurbulence: { value: morph.turbulence },
          uAsymmetry: { value: morph.asymmetry },
          uBloom: { value: morph.bloom },
          uPinch: { value: morph.pinch },
          uBrightness: { value: morph.brightness },
          uImpulse: { value: impulse },
          uResolution: { value: new THREE.Vector2(512, 512) },
          uDark: { value: new THREE.Vector3(...palette.dark) },
          uWarm: { value: new THREE.Vector3(...palette.warm) },
          uLight: { value: new THREE.Vector3(...palette.light) },
          uCream: { value: new THREE.Vector3(...palette.cream) },
        },
      }),
    // Stable across renders — uniforms are mutated in useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  // r3f useFrame intentionally mutates uniforms each tick (same pattern as CapsuleShell).
  /* eslint-disable react-hooks/immutability */
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const target = morph;
    const c = cur.current;
    const dt = frameDelta(prevT.current, t);
    prevT.current = t;
    if (paramsChanged(morph, lastTarget.current)) {
      kick.current = MORPH_KICK;
      lastTarget.current = { ...morph };
    }
    kick.current = 1 + (kick.current - 1) * Math.exp(-MORPH_KICK_DECAY * dt);
    const rate = MORPH_BASE_RATE * kick.current;

    c.turbulence = smoothApproach(c.turbulence, target.turbulence, rate, dt);
    c.brightness = smoothApproach(c.brightness, target.brightness, rate, dt);
    c.blobCount = smoothApproach(c.blobCount, target.blobCount, rate, dt);
    c.orbitSpeed = smoothApproach(c.orbitSpeed, target.orbitSpeed, rate, dt);
    c.pinch = smoothApproach(c.pinch, target.pinch, rate, dt);
    c.bloom = smoothApproach(c.bloom, target.bloom, rate, dt);
    c.asymmetry = smoothApproach(c.asymmetry, target.asymmetry, rate, dt);

    const u = material.uniforms;
    u.uTime.value = t;
    u.uBlobCount.value = c.blobCount;
    u.uOrbitSpeed.value = c.orbitSpeed * (1 + impulse * 0.3);
    u.uTurbulence.value = c.turbulence + impulse * 0.3;
    u.uAsymmetry.value = c.asymmetry;
    u.uBloom.value = c.bloom;
    u.uPinch.value = c.pinch;
    u.uBrightness.value = c.brightness + impulse * 0.15;
    u.uImpulse.value = impulse;

    // Update resolution if viewport changed
    const { width, height } = state.size;
    const res = u.uResolution.value as THREE.Vector2;
    // Cap at 512 for performance — SDF is fragment-heavy
    const scale = Math.min(1, 512 / Math.max(width, height));
    res.set(width * scale, height * scale);

    // Palette lerp
    const pf = smoothFactor(PALETTE_RATE, dt);
    (u.uDark.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.dark), pf);
    (u.uWarm.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.warm), pf);
    (u.uLight.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.light), pf);
    (u.uCream.value as THREE.Vector3).lerp(TMP_COLOR.set(...palette.cream), pf);
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-1}>
      {/* Fullscreen quad — rendered in clip space via the vertex shader */}
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Lightweight core for standard tier (64–95px) — a simple lit sphere
 *  with the terracotta palette. No raymarching cost. */
function SimpleCore({ impulse }: { impulse: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    ref.current.rotation.y = -t * 0.15;
    ref.current.rotation.z = Math.sin(t * 0.2) * 0.1;
    const s = 0.42 + impulse * 0.05;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhysicalMaterial
        color="#d8a078"
        roughness={0.15}
        metalness={0.05}
        clearcoat={0.4}
        clearcoatRoughness={0.2}
        envMapIntensity={0.3}
      />
    </mesh>
  );
}

function Backdrop({ fill }: { fill: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/immutability -- transparent canvas over page background */
    scene.background = null;
  }, [scene]);
  // The soft plane lifts badge-tier scenes off light pages; over the
  // full-bleed dusk field it reads as a pale column, so fill drops it.
  if (fill) return null;
  return (
    <mesh position={[0, 0, -2]} scale={[6, 6, 1]}>
      <planeGeometry />
      <meshBasicMaterial color="#f6e8dc" transparent opacity={0.15} />
    </mesh>
  );
}

function StaticOrbFallback({
  fill,
  size,
}: {
  fill: boolean;
  size: number;
}) {
  const boxStyle = fill
    ? ({ width: "100%", height: "100%" } as const)
    : ({ width: size, height: size } as const);
  return (
    <div
      className={fill ? "" : "rounded-full"}
      style={{
        ...boxStyle,
        background: fill
          ? "radial-gradient(circle at 50% 42%, rgba(168,90,58,0.45), rgba(38,22,16,0.9) 55%, rgba(13,9,8,1))"
          : "radial-gradient(circle at 35% 30%, rgba(168,90,58,0.55), rgba(110,57,37,0.9))",
      }}
    />
  );
}

/** Catches postprocessing failures (common in headless / limited GL). */
class PostFxErrorBoundary extends Component<
  { children: ReactNode; onFailed: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailed();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PostProcessing({
  fill,
  impulse,
  onFailed,
}: {
  fill: boolean;
  impulse: number;
  onFailed: () => void;
}) {
  const { gl } = useThree();
  const [ready, setReady] = useState(false);

  // EffectComposer reads renderer alpha on first paint; defer until the
  // r3f loop has a live GL context (headless Chrome otherwise throws).
  useEffect(() => {
    if (!gl?.domElement) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [gl]);

  if (!ready) return null;

  return (
    <PostFxErrorBoundary onFailed={onFailed}>
      <EffectComposer enableNormalPass={false}>
        <Bloom
          intensity={(fill ? 0.85 : 1.0) + impulse * 0.5}
          luminanceThreshold={fill ? 0.55 : 0.4}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={
            new THREE.Vector2(fill ? 0.0006 : 0.0015, fill ? 0.0006 : 0.0015)
          }
        />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </PostFxErrorBoundary>
  );
}

function SceneInner({
  fill = false,
  skipPostFx = false,
  onPostFxFailed,
  ...props
}: Omit<Props, "size"> & {
  skipPostFx?: boolean;
  onPostFxFailed: () => void;
}) {
  const impulse = props.impulse ?? 0;
  const [postFxFailed, setPostFxFailed] = useState(false);
  const disablePostFx = skipPostFx || postFxFailed;

  return (
    <>
      <Backdrop fill={fill} />
      {fill && <PointerParallax />}
      <ambientLight intensity={0.4} color="#f6e8dc" />
      <directionalLight position={[-2, 3, 2]} intensity={1.6} color="#ffe8d0" />
      <directionalLight position={[2, -1, -2]} intensity={0.35} color="#6e3925" />
      <pointLight position={[0, 0, 1.5]} intensity={0.8 * (1 + impulse)} color="#d8a892" />
      <Environment preset="sunset" />
      {/* SDF core is fragment-heavy — only render at hero (fill) tier.
          Standard tier (64–95px) gets a simple lit sphere as the core. */}
      {fill ? (
        <SDFCore morph={props.morph} palette={props.palette} impulse={impulse} />
      ) : (
        <SimpleCore impulse={impulse} />
      )}
      <CapsuleShell {...props} impulse={impulse} />
      {!disablePostFx && (
        <PostProcessing
          fill={fill}
          impulse={impulse}
          onFailed={() => {
            setPostFxFailed(true);
            onPostFxFailed();
          }}
        />
      )}
    </>
  );
}

/**
 * The orb is aware of the cursor: the camera drifts with it, so the whole
 * presence subtly parallaxes toward you. Listens on window — the field sits
 * behind pointer-events-none content and could never receive events itself.
 */
function PointerParallax() {
  const target = useRef({ x: 0, y: 0 });
  const prevT = useRef(0);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  // r3f useFrame intentionally mutates the camera each tick.
  useFrame((state) => {
    const c = state.camera;
    const t = state.clock.elapsedTime;
    const dt = frameDelta(prevT.current, t);
    prevT.current = t;
    c.position.x = smoothApproach(
      c.position.x,
      target.current.x * 0.18,
      PARALLAX_RATE,
      dt,
    );
    c.position.y = smoothApproach(
      c.position.y,
      -0.5 + target.current.y * 0.14,
      PARALLAX_RATE,
      dt,
    );
  });
  return null;
}

/** Catches Canvas / scene failures and falls back to the static orb. */
class SceneCanvasErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    onFailed: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailed();
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export default function MiraScene({
  size,
  morph,
  palette,
  reactionPulse,
  impulse = 0,
  holdTension = 0,
  fill = false,
  onReady,
}: Props) {
  const reduced = useReducedMotion();
  const webglAvailable = useWebGLAvailable();
  const [canvasFailed, setCanvasFailed] = useState(false);
  const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  // Bloom runs over the whole framebuffer, so a full-bleed canvas at dpr 2 on
  // a large display is costly. The orb reads soft, so a lighter cap is free.
  const dpr = Math.min(rawDpr, fill ? 1.75 : 2);
  const boxStyle = fill
    ? ({ width: "100%", height: "100%" } as const)
    : ({ width: size, height: size } as const);

  useEffect(() => {
    if (reduced || !webglAvailable || canvasFailed) onReady?.();
  }, [reduced, webglAvailable, canvasFailed, onReady]);

  if (reduced || !webglAvailable || canvasFailed) {
    return <StaticOrbFallback fill={fill} size={size} />;
  }

  return (
    <SceneCanvasErrorBoundary
      onFailed={() => setCanvasFailed(true)}
      fallback={<StaticOrbFallback fill={fill} size={size} />}
    >
      <div style={boxStyle} className="relative">
        <Canvas
          dpr={dpr}
          // Fill mode: pull back so capsule tips keep a margin of dusk instead
          // of clipping, and lift the orb up-frame so its glowing core sits
          // behind the question while the input console sits over dimmer field.
          camera={{ position: fill ? [0, -0.5, 3.5] : [0, 0, 3.2], fov: 42 }}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          style={boxStyle}
          onCreated={() => onReady?.()}
        >
          <SceneInner
            fill={fill}
            morph={morph}
            palette={palette}
            reactionPulse={reactionPulse}
            impulse={impulse}
            holdTension={holdTension}
            onPostFxFailed={() => {}}
          />
        </Canvas>
      </div>
    </SceneCanvasErrorBoundary>
  );
}
