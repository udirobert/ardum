"use client";

/**
 * Color extraction from images using canvas sampling
 * Extracts dominant colors from hero images for ambient canvas gradients
 */

export interface ExtractedPalette {
  primary: string;
  secondary: string;
  accent: string;
}

/**
 * Extract dominant colors from an image URL
 * Uses canvas sampling to get representative colors
 */
export async function extractColorsFromImage(
  imageUrl: string,
  sampleSize = 50
): Promise<ExtractedPalette | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        resolve(null);
        return;
      }

      // Sample from center region of image
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      
      const sourceWidth = img.width * 0.6;
      const sourceHeight = img.height * 0.6;
      const sourceX = (img.width - sourceWidth) / 2;
      const sourceY = (img.height - sourceHeight) / 2;

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sampleSize,
        sampleSize
      );

      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const pixels = imageData.data;

      // Collect color samples
      const colorMap = new Map<string, number>();
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip transparent or very dark pixels
        if (a < 128 || (r + g + b) < 30) continue;

        // Quantize colors to reduce palette size
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        
        const key = `${qr},${qg},${qb}`;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }

      // Sort by frequency and get top 3
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key]) => {
          const [r, g, b] = key.split(",").map(Number);
          return rgbToHex(r, g, b);
        });

      if (sortedColors.length < 3) {
        resolve(null);
        return;
      }

      resolve({
        primary: sortedColors[0],
        secondary: sortedColors[1],
        accent: sortedColors[2],
      });
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageUrl;
  });
}

/**
 * Convert RGB values to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Pre-extract and cache colors for a list of retreats
 * Call this once when retreats are loaded
 */
export async function preExtractPalettes(
  retreats: Array<{ id: string; heroImage: string; palette?: ExtractedPalette }>
): Promise<Map<string, ExtractedPalette>> {
  const paletteMap = new Map<string, ExtractedPalette>();
  
  const promises = retreats.map(async (retreat) => {
    if (retreat.palette) {
      paletteMap.set(retreat.id, retreat.palette);
      return;
    }

    const extracted = await extractColorsFromImage(retreat.heroImage);
    if (extracted) {
      paletteMap.set(retreat.id, extracted);
    }
  });

  await Promise.all(promises);
  return paletteMap;
}
