/**
 * AmbientGradient - Reactive canvas background for retreat exploration
 * 
 * Extracts dominant colors from the active retreat's hero image and creates
 * a soft, evolving gradient field that complements the current selection.
 * 
 * Implementation:
 * - Canvas-based radial gradients (2 blobs)
 * - Color extraction from retreat palette
 * - Smooth tweening between states (400ms)
 * - Performance-optimized (30fps when idle)
 */

import { useEffect, useRef } from "react";
import type { Retreat } from "@/inventory/retreat";

interface AmbientGradientProps {
  retreat: Retreat | null;
  className?: string;
}

export default function AmbientGradient({ retreat, className = "" }: AmbientGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const gradientRef = useRef<{
    colors: string[];
    targetColors: string[];
    progress: number;
  }>({
    colors: ["#1a120d", "#2d1f1a"],
    targetColors: ["#1a120d", "#2d1f1a"],
    progress: 1,
  });

  useEffect(() => {
    if (!retreat?.palette) return;

    // Update target colors when retreat changes
    gradientRef.current.targetColors = [
      retreat.palette.primary,
      retreat.palette.secondary,
    ];
    gradientRef.current.progress = 0;
  }, [retreat?.id, retreat?.palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastTime;

      if (elapsed > frameInterval) {
        lastTime = timestamp - (elapsed % frameInterval);

        // Tween colors
        const g = gradientRef.current;
        if (g.progress < 1) {
          g.progress = Math.min(1, g.progress + 0.025);
          for (let i = 0; i < g.colors.length; i++) {
            g.colors[i] = interpolateColor(
              g.colors[i],
              g.targetColors[i],
              g.progress
            );
          }
        }

        // Draw gradients
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Base fill
        ctx.fillStyle = "#0c0806";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Primary gradient blob (top-left)
        const gradient1 = ctx.createRadialGradient(
          canvas.width * 0.2,
          canvas.height * 0.3,
          0,
          canvas.width * 0.2,
          canvas.height * 0.3,
          canvas.width * 0.6
        );
        gradient1.addColorStop(0, `${g.colors[0]}40`);
        gradient1.addColorStop(1, "transparent");
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Secondary gradient blob (bottom-right)
        const gradient2 = ctx.createRadialGradient(
          canvas.width * 0.8,
          canvas.height * 0.7,
          0,
          canvas.width * 0.8,
          canvas.height * 0.7,
          canvas.width * 0.5
        );
        gradient2.addColorStop(0, `${g.colors[1]}30`);
        gradient2.addColorStop(1, "transparent");
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ opacity: 0.6 }}
    />
  );
}

// Helper: interpolate between two hex colors
function interpolateColor(color1: string, color2: string, progress: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
