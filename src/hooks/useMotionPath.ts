"use client";

/**
 * useMotionPath - Hook for generating curved motion path animations
 * 
 * Creates cubic bezier curves between two points for organic, non-linear
 * transitions. Used for animating retreats to/from Mira's orb.
 */

import { useMemo } from "react";

export interface Point {
  x: number;
  y: number;
}

export interface MotionPathConfig {
  /** Curvature strength (0 = straight line, 1 = maximum curve) */
  curviness?: number;
  /** Direction of curve: 'left', 'right', 'up', 'down', or 'auto' */
  curveDirection?: "left" | "right" | "up" | "down" | "auto";
}

/**
 * Generate control points for a cubic bezier curve between two points
 */
export function generateCurvePoints(
  start: Point,
  end: Point,
  config: MotionPathConfig = {}
): [Point, Point, Point, Point] {
  const { curviness = 0.5, curveDirection = "auto" } = config;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Determine curve direction based on relative positions
  let curveOffsetX = 0;
  let curveOffsetY = 0;
  
  if (curveDirection === "auto") {
    // Auto-determine based on movement direction
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal movement - curve vertically
      curveOffsetY = distance * curviness * (dy > 0 ? -1 : 1);
    } else {
      // Vertical movement - curve horizontally
      curveOffsetX = distance * curviness * (dx > 0 ? -1 : 1);
    }
  } else {
    const curveStrength = distance * curviness;
    switch (curveDirection) {
      case "left":
        curveOffsetX = -curveStrength;
        break;
      case "right":
        curveOffsetX = curveStrength;
        break;
      case "up":
        curveOffsetY = -curveStrength;
        break;
      case "down":
        curveOffsetY = curveStrength;
        break;
    }
  }
  
  // Generate two control points for cubic bezier
  const control1: Point = {
    x: start.x + dx * 0.25 + curveOffsetX,
    y: start.y + dy * 0.25 + curveOffsetY,
  };
  
  const control2: Point = {
    x: start.x + dx * 0.75 + curveOffsetX,
    y: start.y + dy * 0.75 + curveOffsetY,
  };
  
  return [start, control1, control2, end];
}

/**
 * Evaluate a point on a cubic bezier curve at parameter t (0-1)
 */
export function evaluateBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Hook to generate motion path keyframes for framer-motion
 * Returns x and y arrays for use in animate prop
 */
export function useMotionPath(
  from: Point,
  to: Point,
  config: MotionPathConfig = {}
) {
  return useMemo(() => {
    const [p0, p1, p2, p3] = generateCurvePoints(from, to, config);
    
    // Generate keyframes by sampling the bezier curve
    const steps = 10;
    const xKeyframes: number[] = [];
    const yKeyframes: number[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = evaluateBezier(p0, p1, p2, p3, t);
      xKeyframes.push(point.x);
      yKeyframes.push(point.y);
    }
    
    return { x: xKeyframes, y: yKeyframes };
  }, [from.x, from.y, to.x, to.y, config.curviness, config.curveDirection]);
}
