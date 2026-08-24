"use client";

// FluidParticlePour — a 2D SPH-inspired fluid particle simulation that
// dissolves source elements into streaming particles that pour downward
// into a target point (the orb center). Inspired by github.com/saharan/works
// (drops) — uses simplified SPH with neighbor search, pressure, viscosity,
// and surface tension for organic liquid behavior.
//
// Usage: Mount anywhere over MiraField. Call `pour({ x, y, color? })` to
// trigger a pour from those screen coordinates toward the center of the
// viewport (the orb). The canvas self-destructs after the animation completes.
//
// Reduced motion: the canvas is never mounted.

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// ─── SPH Particle ──────────────────────────────────────────────────────

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  density: number;
  pressure: number;
  life: number; // 1 → 0, fades as it reaches target
  color: string;
  size: number;
};

// ─── SPH Constants ─────────────────────────────────────────────────────

const REST_DENSITY = 1.0;
const GAS_CONSTANT = 2.0;
const VISCOSITY = 0.8;
const SMOOTHING_RADIUS = 30;
const SMOOTHING_RADIUS_SQ = SMOOTHING_RADIUS * SMOOTHING_RADIUS;
const GRAVITY = 0.45;
const DAMPING = 0.98;
const SURFACE_TENSION = 0.03;
const TARGET_PULL = 0.0008; // gentle attraction toward orb center

// SPH Kernels (simplified — Poly6 for density, Spiky for pressure)
function kernelPoly6(rSq: number): number {
  if (rSq >= SMOOTHING_RADIUS_SQ) return 0;
  const diff = SMOOTHING_RADIUS_SQ - rSq;
  return (diff * diff * diff) / (Math.PI * Math.pow(SMOOTHING_RADIUS, 8) * 4);
}

function kernelSpikyGrad(r: number): number {
  if (r >= SMOOTHING_RADIUS || r < 0.001) return 0;
  const diff = SMOOTHING_RADIUS - r;
  return -(diff * diff) / (Math.PI * Math.pow(SMOOTHING_RADIUS, 5));
}

function kernelViscosityLap(r: number): number {
  if (r >= SMOOTHING_RADIUS) return 0;
  return (SMOOTHING_RADIUS - r) / (Math.PI * Math.pow(SMOOTHING_RADIUS, 5) * 2);
}

// ─── Simulation ────────────────────────────────────────────────────────

function stepSimulation(
  particles: Particle[],
  targetX: number,
  targetY: number,
  dt: number,
): void {
  const n = particles.length;

  // Compute density and pressure
  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    pi.density = 0;
    for (let j = 0; j < n; j++) {
      const pj = particles[j];
      const dx = pi.x - pj.x;
      const dy = pi.y - pj.y;
      const rSq = dx * dx + dy * dy;
      pi.density += kernelPoly6(rSq);
    }
    pi.density = Math.max(pi.density, REST_DENSITY * 0.5);
    pi.pressure = GAS_CONSTANT * (pi.density - REST_DENSITY);
  }

  // Compute forces
  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    let fx = 0;
    let fy = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const pj = particles[j];
      const dx = pi.x - pj.x;
      const dy = pi.y - pj.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 0.001 || r >= SMOOTHING_RADIUS) continue;

      const nx = dx / r;
      const ny = dy / r;

      // Pressure force
      const pressureForce =
        -((pi.pressure + pj.pressure) / (2 * pj.density)) *
        kernelSpikyGrad(r);
      fx += pressureForce * nx;
      fy += pressureForce * ny;

      // Viscosity force
      const viscForce =
        (VISCOSITY * kernelViscosityLap(r)) / pj.density;
      fx += viscForce * (pj.vx - pi.vx);
      fy += viscForce * (pj.vy - pi.vy);

      // Surface tension (cohesion)
      fx -= SURFACE_TENSION * nx;
      fy -= SURFACE_TENSION * ny;
    }

    // Gravity
    fy += GRAVITY;

    // Target attraction (increases as particle nears target)
    const toTargetX = targetX - pi.x;
    const toTargetY = targetY - pi.y;
    const distToTarget = Math.sqrt(
      toTargetX * toTargetX + toTargetY * toTargetY,
    );
    const pull = TARGET_PULL * (1 + (1 - pi.life) * 3);
    fx += toTargetX * pull;
    fy += toTargetY * pull;

    // Fade life based on proximity to target
    if (distToTarget < 80) {
      pi.life -= 0.02;
    } else {
      pi.life -= 0.003;
    }

    pi.ax = fx;
    pi.ay = fy;
  }

  // Integrate
  for (let i = 0; i < n; i++) {
    const pi = particles[i];
    pi.vx = (pi.vx + pi.ax * dt) * DAMPING;
    pi.vy = (pi.vy + pi.ay * dt) * DAMPING;
    pi.x += pi.vx * dt;
    pi.y += pi.vy * dt;
  }
}

// ─── Context for triggering pours from anywhere ────────────────────────

export type PourConfig = {
  /** Screen-space origin X (where particles spawn). */
  x: number;
  /** Screen-space origin Y (where particles spawn). */
  y: number;
  /** Number of particles to emit (default 250). */
  count?: number;
  /** CSS color for particles (default: terracotta accent). */
  color?: string;
  /** Duration in ms before canvas is removed (default: 2500). */
  durationMs?: number;
};

type FluidPourContextValue = {
  pour: (config: PourConfig) => void;
};

const FluidPourContext = createContext<FluidPourContextValue>({
  pour: () => {},
});

export function useFluidPour() {
  return useContext(FluidPourContext);
}

// ─── Provider (mounts in MiraField or layout) ──────────────────────────

export function FluidPourProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<FluidCanvasHandle>(null);
  const [active, setActive] = useState(false);

  const pour = useCallback(
    (config: PourConfig) => {
      if (reduced) return;
      setActive(true);
      // Give the canvas a frame to mount, then trigger.
      requestAnimationFrame(() => {
        canvasRef.current?.start(config);
      });
    },
    [reduced],
  );

  const handleDone = useCallback(() => {
    setActive(false);
  }, []);

  return (
    <FluidPourContext.Provider value={{ pour }}>
      {active && !reduced && (
        <FluidCanvas ref={canvasRef} onDone={handleDone} />
      )}
      {children}
    </FluidPourContext.Provider>
  );
}

// ─── Canvas renderer ───────────────────────────────────────────────────

type FluidCanvasHandle = {
  start: (config: PourConfig) => void;
};

/** Spawn particles — runs outside React render, called from imperative handle. */
function createParticles(config: PourConfig): Particle[] {
  const count = config.count ?? 250;
  const color = config.color ?? "#a85a3a";
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    // Spawn in a cluster around the origin with slight spread
    const angle = Math.random() * Math.PI * 2;
    const spread = Math.random() * 40;
    particles.push({
      x: config.x + Math.cos(angle) * spread,
      y: config.y + Math.sin(angle) * spread,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * -1.5 - 0.5, // initial upward burst
      ax: 0,
      ay: 0,
      density: 0,
      pressure: 0,
      life: 1,
      color,
      size: 3 + Math.random() * 4,
    });
  }

  return particles;
}

/** Start the animation loop — imperatively called after mount. */
function runLoop(
  canvas: HTMLCanvasElement,
  particlesRef: MutableRefObject<Particle[]>,
  animRef: MutableRefObject<number>,
  onDone: () => void,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const c = ctx; // Alias for closure narrowing

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  c.scale(dpr, dpr);

  const targetX = window.innerWidth / 2;
  const targetY = window.innerHeight * 0.45; // Orb center is slightly above middle

  let lastTime = performance.now();

  function loop(now: number) {
    const dt = Math.min((now - lastTime) / 16, 3); // Cap at 3x normal speed
    lastTime = now;

    const particles = particlesRef.current;

    // Remove dead particles
    const alive = particles.filter((p) => p.life > 0);
    particlesRef.current = alive;

    if (alive.length === 0) {
      onDone();
      return;
    }

    // Step physics
    stepSimulation(alive, targetX, targetY, dt);

    // Render
    c.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    for (const p of alive) {
      const alpha = Math.max(0, p.life);
      const size = p.size * (0.5 + alpha * 0.5);
      c.beginPath();
      c.arc(p.x, p.y, size, 0, Math.PI * 2);
      c.fillStyle = p.color + hexAlpha(alpha * 0.85);
      c.fill();

      // Soft glow for larger particles
      if (size > 4) {
        c.beginPath();
        c.arc(p.x, p.y, size * 1.8, 0, Math.PI * 2);
        c.fillStyle = p.color + hexAlpha(alpha * 0.15);
        c.fill();
      }
    }

    animRef.current = requestAnimationFrame(loop);
  }

  animRef.current = requestAnimationFrame(loop);
}

const FluidCanvas = forwardRef<FluidCanvasHandle, { onDone: () => void }>(
  function FluidCanvas({ onDone }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef(0);
    const particlesRef = useRef<Particle[]>([]);
    const configRef = useRef<PourConfig | null>(null);
    const onDoneRef = useRef(onDone);

    useEffect(() => {
      onDoneRef.current = onDone;
    }, [onDone]);

    useImperativeHandle(ref, () => ({
      start(config: PourConfig) {
        configRef.current = config;
        particlesRef.current = createParticles(config);
        const canvas = canvasRef.current;
        if (canvas) {
          runLoop(canvas, particlesRef, animRef, () => onDoneRef.current());
        }
      },
    }));

    useEffect(() => {
      const id = animRef;
      return () => {
        if (id.current) cancelAnimationFrame(id.current);
      };
    }, []);

    // Auto-timeout: if particles somehow never die, clean up after duration.
    useEffect(() => {
      const timeout = setTimeout(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        onDone();
      }, (configRef.current?.durationMs ?? 2500) + 500);
      return () => clearTimeout(timeout);
    }, [onDone]);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-50 pointer-events-none"
        style={{
          width: "100vw",
          height: "100vh",
        }}
      />
    );
  },
);

// ─── Helpers ───────────────────────────────────────────────────────────

function hexAlpha(a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  const hex = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  return hex;
}
