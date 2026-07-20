"use client";

/**
 * Color extraction utility for retreat hero images.
 * 
 * Track A deliverable for Phase A1: Extract dominant colors from retreat
 * images to populate the AmbientGradient canvas. Uses a simple k-means
 * clustering approach to find 3 dominant colors (primary, secondary, accent).
 * 
 * For the mock catalog, we pre-compute these palettes manually. This utility
 * is for future dynamic retreats (e.g., user-uploaded images or real operator
 * data without pre-computed palettes).
 */

/**
 * Extract dominant colors from an image URL.
 * 
 * Algorithm:
 * 1. Load image into a hidden canvas
 * 2. Sample pixels at regular intervals
 * 3. Apply simple k-means clustering to find 3 dominant colors
 * 4. Return as hex strings
 * 
 * Performance: For a 1000x1000 image, samples ~1000 pixels, runs k-means
 * for 5 iterations. Should complete in <50ms on modern hardware.
 */
export async function extractPalette(imageUrl: string): Promise<{
  primary: string;
  secondary: string;
  accent: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Resize to manageable size for sampling
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Sample pixels at regular intervals (skip every 4th pixel for performance)
        const samples: [number, number, number][] = [];
        for (let i = 0; i < pixels.length; i += 16) { // Every 4th pixel (4 bytes per pixel)
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Skip fully transparent pixels
          if (a < 255) continue;
          
          samples.push([r, g, b]);
        }
        
        // Simple k-means clustering to find 3 dominant colors
        const clusters = kMeansClustering(samples, 3, 5);
        
        // Sort clusters by size (largest first)
        clusters.sort((a, b) => b.size - a.size);
        
        // Convert to hex
        const primary = rgbToHex(clusters[0].center);
        const secondary = rgbToHex(clusters[1].center);
        const accent = rgbToHex(clusters[2].center);
        
        resolve({ primary, secondary, accent });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Simple k-means clustering implementation.
 * 
 * @param points - Array of [r, g, b] color samples
 * @param k - Number of clusters (we use 3 for primary/secondary/accent)
 * @param iterations - Number of k-means iterations (5 is usually sufficient)
 * @returns Array of clusters, each with center color and size
 */
function kMeansClustering(
  points: [number, number, number][],
  k: number,
  iterations: number
): { center: [number, number, number]; size: number }[] {
  if (points.length === 0) {
    return [
      { center: [128, 128, 128], size: 1 },
      { center: [64, 64, 64], size: 1 },
      { center: [192, 192, 192], size: 1 },
    ];
  }
  
  // Initialize centers randomly from the points
  const centers: [number, number, number][] = [];
  const step = Math.floor(points.length / k);
  for (let i = 0; i < k; i++) {
    centers.push([...points[i * step]] as [number, number, number]);
  }
  
  const assignments: number[] = new Array(points.length).fill(0);
  
  for (let iter = 0; iter < iterations; iter++) {
    // Assign each point to nearest center
    for (let i = 0; i < points.length; i++) {
      let minDist = Infinity;
      let minCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const dist = colorDistance(points[i], centers[c]);
        if (dist < minDist) {
          minDist = dist;
          minCluster = c;
        }
      }
      
      assignments[i] = minCluster;
    }
    
    // Recompute centers
    for (let c = 0; c < k; c++) {
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      
      for (let i = 0; i < points.length; i++) {
        if (assignments[i] === c) {
          sumR += points[i][0];
          sumG += points[i][1];
          sumB += points[i][2];
          count++;
        }
      }
      
      if (count > 0) {
        centers[c] = [
          Math.round(sumR / count),
          Math.round(sumG / count),
          Math.round(sumB / count),
        ];
      }
    }
  }
  
  // Count cluster sizes
  const sizes = new Array(k).fill(0);
  for (const assignment of assignments) {
    sizes[assignment]++;
  }
  
  return centers.map((center, i) => ({ center, size: sizes[i] }));
}

/**
 * Euclidean distance between two RGB colors.
 */
function colorDistance(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Convert RGB tuple to hex string.
 */
function rgbToHex(rgb: [number, number, number]): string {
  const r = Math.max(0, Math.min(255, rgb[0]));
  const g = Math.max(0, Math.min(255, rgb[1]));
  const b = Math.max(0, Math.min(255, rgb[2]));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
