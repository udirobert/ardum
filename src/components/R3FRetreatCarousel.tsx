/**
 * R3FRetreatCarousel - 3D wavy carousel using React Three Fiber
 * 
 * Renders retreat images as 3D planes arranged in a curved carousel with
 * GLSL shader-based wave displacement. Creates an immersive, gallery-like
 * experience for browsing retreats.
 * 
 * Inspired by: https://tympanus.net/codrops/?p=104645
 */

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { Retreat } from "@/inventory/retreat";

// Vertex shader: creates wavy displacement
const vertexShader = `
  uniform float time;
  uniform float waveIntensity;
  uniform float waveFrequency;
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main() {
    vUv = uv;
    
    // Calculate wave displacement
    float elevation = sin(position.x * waveFrequency + time) * waveIntensity;
    elevation += sin(position.y * waveFrequency * 0.5 + time * 0.7) * waveIntensity * 0.5;
    
    vElevation = elevation;
    
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    modelPosition.y += elevation;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
  }
`;

// Fragment shader: renders texture with elevation-based tinting
const fragmentShader = `
  uniform sampler2D texture;
  uniform vec3 baseColor;
  uniform float elevationInfluence;
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main() {
    vec4 textureColor = texture2D(texture, vUv);
    
    // Add subtle color variation based on elevation
    vec3 finalColor = mix(baseColor, textureColor.rgb, 0.9);
    finalColor += vElevation * elevationInfluence;
    
    gl_FragColor = vec4(finalColor, textureColor.a);
  }
`;

interface RetreatPlaneProps {
  retreat: Retreat;
  position: [number, number, number];
  rotation: [number, number, number];
  isActive: boolean;
  onClick: () => void;
}

function RetreatPlane({
  retreat,
  position,
  rotation,
  isActive,
  onClick,
}: RetreatPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [hovered, setHovered] = useState(false);
  
  const texture = useTexture(retreat.heroImage);
  
  // Parse color from hex string
  const baseColor = useMemo(() => {
    return new THREE.Color(retreat.palette.primary);
  }, [retreat.palette.primary]);
  
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      waveIntensity: { value: 0.1 },
      waveFrequency: { value: 2.0 },
      texture: { value: texture },
      baseColor: { value: baseColor },
      elevationInfluence: { value: 0.05 },
    }),
    [texture, baseColor]
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
    
    if (meshRef.current) {
      // Subtle hover animation
      const targetScale = hovered || isActive ? 1.05 : 1;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onClick={onClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <planeGeometry args={[3, 4, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface CarouselSceneProps {
  retreats: Retreat[];
  activeIndex: number;
  onSelectRetreat: (index: number) => void;
}

function CarouselScene({ retreats, activeIndex, onSelectRetreat }: CarouselSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Arrange planes in a curved arc
  const planes = useMemo(() => {
    const radius = 8;
    const angleStep = (Math.PI * 0.8) / (retreats.length - 1);
    const startAngle = -Math.PI * 0.4;

    return retreats.map((retreat, index) => {
      const angle = startAngle + index * angleStep;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - radius;
      const rotationY = angle;

      return {
        retreat,
        position: [x, 0, z] as [number, number, number],
        rotation: [0, rotationY, 0] as [number, number, number],
        isActive: index === activeIndex,
      };
    });
  }, [retreats, activeIndex]);

  // Rotate carousel based on active index
  useFrame(() => {
    if (groupRef.current) {
      const targetRotation = -(activeIndex / (retreats.length - 1)) * Math.PI * 0.8 + Math.PI * 0.4;
      groupRef.current.rotation.y += (targetRotation - groupRef.current.rotation.y) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {planes.map((plane, index) => (
        <RetreatPlane
          key={plane.retreat.id}
          retreat={plane.retreat}
          position={plane.position}
          rotation={plane.rotation}
          isActive={plane.isActive}
          onClick={() => onSelectRetreat(index)}
        />
      ))}
    </group>
  );
}

interface R3FRetreatCarouselProps {
  retreats: Retreat[];
  activeIndex: number;
  onSelectRetreat: (index: number) => void;
  className?: string;
}

export default function R3FRetreatCarousel({
  retreats,
  activeIndex,
  onSelectRetreat,
  className = "",
}: R3FRetreatCarouselProps) {
  return (
    <div className={`w-full h-[600px] ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0c0806"]} />
        <fog attach="fog" args={["#0c0806", 10, 25]} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <CarouselScene
          retreats={retreats}
          activeIndex={activeIndex}
          onSelectRetreat={onSelectRetreat}
        />
        
        <Environment preset="sunset" />
      </Canvas>
    </div>
  );
}
