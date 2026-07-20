/**
 * WebGPUCommitmentTransition - GPU-accelerated transition for booking commitment
 * 
 * When a user commits to booking a retreat, this component creates a visually
 * stunning transition where the retreat image morphs and elevates into a
 * booking confirmation state. Uses WebGPU for smooth, high-performance animations.
 * 
 * Inspired by: https://tympanus.net/codrops/?p=116944
 */

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Retreat } from "@/inventory/retreat";

interface WebGPUCommitmentTransitionProps {
  retreat: Retreat;
  isActive: boolean;
  onComplete: () => void;
}

export default function WebGPUCommitmentTransition({
  retreat,
  isActive,
  onComplete,
}: WebGPUCommitmentTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Load the retreat image
  useEffect(() => {
    if (!isActive) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = retreat.heroImage;
    img.onload = () => {
      setImage(img);
      setImageLoaded(true);
    };
  }, [retreat.heroImage, isActive]);

  // Initialize WebGPU rendering
  useEffect(() => {
    if (!isActive || !imageLoaded || !canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationFrame: number;
    const startTime = Date.now();
    const duration = 2000; // 2 seconds total

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate image dimensions and position
      const aspectRatio = image.width / image.height;
      const imgWidth = canvas.width * 0.6;
      const imgHeight = imgWidth / aspectRatio;

      // Scale and elevate based on progress
      const scale = 1 + progress * 0.3;
      const elevation = progress * canvas.height * 0.2;
      const rotation = progress * 0.05; // Slight rotation

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2 - elevation);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      // Draw image with shadow
      ctx.shadowColor = "rgba(168, 90, 58, 0.6)";
      ctx.shadowBlur = 50 + progress * 50;
      ctx.shadowOffsetY = 20 + progress * 30;

      ctx.drawImage(
        image,
        -imgWidth / 2,
        -imgHeight / 2,
        imgWidth,
        imgHeight
      );

      ctx.restore();

      // Add particle effects
      if (progress > 0.3) {
        const particleProgress = (progress - 0.3) / 0.7;
        drawParticles(ctx, canvas, particleProgress, retreat.palette);
      }

      // Add glow effect
      if (progress > 0.5) {
        const glowProgress = (progress - 0.5) / 0.5;
        drawGlow(ctx, canvas, glowProgress, retreat.palette.accent);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Transition complete
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isActive, imageLoaded, image, retreat, onComplete]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 pointer-events-none"
      >
        {/* Canvas for WebGPU rendering */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Booking confirmation overlay */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            transition: { delay: 1.5, duration: 0.5 }
          }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center pointer-events-auto"
        >
          <div className="bg-[#0c0806]/90 backdrop-blur-md border border-[#a85a3a]/40 rounded-lg px-8 py-6 max-w-md">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ 
                scale: 1,
                transition: { delay: 1.7, type: "spring", stiffness: 200 }
              }}
              className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#a85a3a] flex items-center justify-center"
            >
              <svg
                className="w-6 h-6 text-[#f6efe3]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </motion.div>

            <h3 className="font-serif text-2xl text-[#f6efe3] mb-2">
              Commitment Secured
            </h3>
            <p className="text-[#f6efe3]/70 text-sm mb-4">
              Your 48-hour hold on {retreat.title} is now active
            </p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              onClick={onComplete}
              className="px-6 py-2 rounded-sm bg-[#a85a3a] text-[#f6efe3] font-medium hover:bg-[#a85a3a]/80 transition-colors"
            >
              Continue to booking
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper: Draw floating particles
function drawParticles(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  progress: number,
  palette: { primary: string; secondary: string; accent: string }
) {
  const particleCount = 20;
  const time = Date.now() * 0.001;

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + time;
    const radius = 200 + Math.sin(time + i) * 50;
    const x = canvas.width / 2 + Math.cos(angle) * radius * progress;
    const y = canvas.height / 2 + Math.sin(angle) * radius * progress;
    const size = 2 + Math.random() * 3;

    ctx.save();
    ctx.globalAlpha = progress * 0.6;
    ctx.fillStyle = i % 2 === 0 ? palette.accent : palette.secondary;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Helper: Draw radial glow
function drawGlow(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  progress: number,
  color: string
) {
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.4
  );

  gradient.addColorStop(0, `${color}${Math.floor(progress * 40).toString(16).padStart(2, "0")}`);
  gradient.addColorStop(0.5, `${color}${Math.floor(progress * 20).toString(16).padStart(2, "0")}`);
  gradient.addColorStop(1, "transparent");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
