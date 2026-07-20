"use client";

import { useRef, useEffect } from "react";
import type { Retreat } from "@/inventory/retreat";

interface AmbientCanvasProps {
  retreat: Retreat | null;
}

export default function AmbientCanvas({ retreat }: AmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Animation loop
    let time = 0;
    const animate = () => {
      time += 0.01;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw radial gradient based on retreat palette
      if (retreat) {
        const colors = retreat.palette;
        
        // Primary gradient (large, slow-moving)
        const primaryX = canvas.width * (0.5 + 0.3 * Math.sin(time * 0.5));
        const primaryY = canvas.height * (0.5 + 0.3 * Math.cos(time * 0.3));
        const primaryGradient = ctx.createRadialGradient(
          primaryX, primaryY, 0,
          primaryX, primaryY, canvas.width * 0.8
        );
        primaryGradient.addColorStop(0, hexToRgba(colors.primary, 0.4));
        primaryGradient.addColorStop(1, "transparent");
        ctx.fillStyle = primaryGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Secondary gradient (medium, counter-rotating)
        const secondaryX = canvas.width * (0.5 + 0.4 * Math.cos(time * 0.7));
        const secondaryY = canvas.height * (0.5 + 0.4 * Math.sin(time * 0.5));
        const secondaryGradient = ctx.createRadialGradient(
          secondaryX, secondaryY, 0,
          secondaryX, secondaryY, canvas.width * 0.6
        );
        secondaryGradient.addColorStop(0, hexToRgba(colors.secondary, 0.3));
        secondaryGradient.addColorStop(1, "transparent");
        ctx.fillStyle = secondaryGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Accent gradient (small, fast-moving)
        const accentX = canvas.width * (0.5 + 0.5 * Math.sin(time * 1.2));
        const accentY = canvas.height * (0.5 + 0.5 * Math.cos(time * 0.9));
        const accentGradient = ctx.createRadialGradient(
          accentX, accentY, 0,
          accentX, accentY, canvas.width * 0.4
        );
        accentGradient.addColorStop(0, hexToRgba(colors.accent, 0.25));
        accentGradient.addColorStop(1, "transparent");
        ctx.fillStyle = accentGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [retreat]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
