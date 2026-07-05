/**
 * GooeyFilter — SVG feGaussianBlur + feColorMatrix "gooey" effect.
 *
 * How it works:
 *   1. Blur the alpha channel of a group of elements.
 *   2. Apply a high-contrast threshold (feColorMatrix) that snaps blurred
 *      edges to hard alpha — but elements that are close together have their
 *      blurred halos overlap, so the threshold "joins" them into one blob.
 *
 * Usage:
 *   <GooeyFilter id="intake" blur={8} threshold={20} />
 *   Then on the container: style={{ filter: 'url(#gooey-intake)' }}
 *   (Tailwind: className="[filter:url('#gooey-intake')]")
 *
 * The filter is purely CSS/SVG — zero JS after mount, no WebGL.
 * Render it once per page, outside the scrolling content so it's not
 * affected by overflow:hidden on parents.
 */

export default function GooeyFilter({
  id = "gooey",
  /** Blur radius — controls how far the "liquid bridge" reaches. */
  blur = 8,
  /** Threshold sharpness — higher = snappier merge, lower = softer blobs. */
  threshold = 18,
  /** Lighten the result so it matches the element's original colour better. */
  brightnessBoost = 1,
}: {
  id?: string;
  blur?: number;
  threshold?: number;
  brightnessBoost?: number;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id={`gooey-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          {/* Step 1 — blur the entire layer (alpha + colour) */}
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={blur}
            result="blur"
          />
          {/* Step 2 — high-contrast threshold on alpha to snap merged halos.
              The matrix multiplies [R G B A offset] for each channel output.
              Row 4 (alpha out) = 0*R + 0*G + 0*B + threshold*A + -threshold/2
              → alpha < 0.5/threshold ≈ 0 becomes 0, above → clamps to 1.
              We also slightly boost R G B so colours stay vivid post-blend. */}
          <feColorMatrix
            in="blur"
            mode="matrix"
            values={`
              ${brightnessBoost} 0 0 0 0
              0 ${brightnessBoost} 0 0 0
              0 0 ${brightnessBoost} 0 0
              0 0 0 ${threshold} ${-(threshold / 2)}
            `}
            result="gooey"
          />
          {/* Step 3 — composite the thresholded alpha back over the original
              source so colours come from the real element, not the blurred
              proxy. This prevents the slight desaturation the blur introduces. */}
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
