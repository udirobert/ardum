"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import type { Retreat } from "@/inventory/retreat";

const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave1 = sin(pos.x * 2.0 + uTime * 0.6) * 0.12;
    float wave2 = sin(pos.y * 3.0 + uTime * 0.4) * 0.08;
    pos.z += wave1 + wave2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float noise = sin(vUv.x * 10.0 + uTime * 0.2) * 0.5 + 0.5;
    vec3 color = mix(uColorA, uColorB, vUv.y + noise * 0.2);
    float alpha = 0.35 - vUv.y * 0.15;
    gl_FragColor = vec4(color, alpha);
  }
`;

interface WavePlaneProps {
  colorA: string;
  colorB: string;
}

function WavePlane({ colorA, colorB }: WavePlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
    }),
    [colorA, colorB]
  );

  useFrame((state: RootState) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  // Update colors when they change without recreating uniforms
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uColorA.value.set(colorA);
    materialRef.current.uniforms.uColorB.value.set(colorB);
  }, [colorA, colorB]);

  return (
    <mesh rotation={[-0.3, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width * 2.5, viewport.height * 2.5, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

interface RetreatWavesProps {
  retreat?: Retreat | null;
  className?: string;
}

export default function RetreatWaves({ retreat, className = "" }: RetreatWavesProps) {
  const [dpr] = useState(() =>
    typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 2)
  );

  const colorA = retreat?.palette?.primary ?? "#0c0806";
  const colorB = retreat?.palette?.accent ?? "#a85a3a";

  return (
    <div className={`fixed inset-0 -z-10 pointer-events-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 60 }}
        dpr={dpr}
        gl={{ antialias: true, alpha: true }}
      >
        <WavePlane colorA={colorA} colorB={colorB} />
      </Canvas>
    </div>
  );
}
