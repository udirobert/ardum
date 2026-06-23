"use client";

import { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/useReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Loads an image with a progressive blur reveal when it scrolls into view.
// Shows a palette-matched gradient while loading. Falls back to the
// gradient if the image fails.

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  aspectRatio?: string;
  fallbackGradient?: string;
  objectPosition?: string;
};

export default function ProgressiveBlurImage({
  src,
  alt,
  width,
  height,
  className = "",
  aspectRatio = "16/9",
  fallbackGradient = "linear-gradient(135deg, #efe7d6 0%, #d8a892 100%)",
  objectPosition = "center",
}: Props) {
  const [ref, revealed] = useReveal({ threshold: 0.05 });
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Placeholder — visible until the image loads */}
      {(!loaded || errored) && (
        <div
          className="absolute inset-0 skeleton-pulse"
          style={{ background: fallbackGradient }}
        />
      )}

      {/* The image — only starts loading when scrolled into view */}
      {revealed && !errored && (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`
            object-cover w-full h-full transition-all duration-800
            ${loaded && !reduced ? "blur-in" : ""}
          `.trim()}
          style={{
            objectFit: "cover",
            objectPosition,
            willChange: "filter, transform",
          }}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      )}
    </div>
  );
}
