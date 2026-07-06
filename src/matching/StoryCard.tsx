// StoryCard — the 1080×1920 IG-Stories match artifact.
//
// One pure-SVG component, two production paths:
//   1. <StoryCard />                                  — renders inline on the page
//                                                       as a scaled preview
//   2. storyCardToSVG(args) → "<svg>...</svg>" string — feed into a canvas to
//                                                       produce a downloadable PNG
//
// Why pure SVG (no WebGL, no Three.js, no <foreignObject>):
//   - WebGL canvases are not trivially rasterisable into a PNG via 2D canvas
//   - <foreignObject> content has cross-browser quirks when rasterised via
//     canvas.toBlob(): Safari in particular can emit blank rects for HTML
//     inside SVG. Native <text>+<tspan> elements rasterise everywhere.
//   - The cloud-field shader at the heart of the page can't be statically
//     rendered; instead the palette it produces is inlined as fills and
//     gradients — same colour logic, deterministic output.
//
// Typography uses system serifs as fallbacks for the Instrument Serif
// typeface. When rendered on-screen, the Instrument Serif webfont (loaded
// by the layout) supplies the prettier glyph shapes. When rasterised to
// PNG via 2D canvas, the browser substitutes the system serif because the
// webfont has not been awaited. The shapes are close enough — same axis
// of calm, same Georgia/Times lineage — that the card still reads as
// "Ardum" rather than "generic."

import * as React from "react";
import type { AestheticVector } from "@/aesthetics/image-pool";

// ── Palette derivation (mirrors MiraOrb's vectorToPalette) ───────────
// Same arithmetic as src/components/MiraOrb.tsx so the card breathes the
// same register as the live app. Bounded shifts (±0.18) keep the result
// reading as "Ardum cream / terracotta" rather than foreign palettes.

const COL_DARK = [0.431, 0.224, 0.145] as const; // accent-ink
const COL_WARM = [0.659, 0.353, 0.227] as const; // accent
const COL_LIGHT = [0.847, 0.659, 0.573] as const; // accent-soft
const COL_CREAM = [0.965, 0.945, 0.906] as const; // background
const COL_INK = [26, 23, 20] as const; // foreground
const COL_MUTED = [82, 74, 66] as const; // muted
const COL_HAIRLINE = [194, 182, 162] as const; // hairline

type RGB = readonly [number, number, number];
type RGB256 = readonly [number, number, number];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function paletteForVector(v: AestheticVector | null | undefined) {
  if (!v) {
    return {
      ink: COL_INK,
      muted: COL_MUTED,
      hairline: COL_HAIRLINE,
      accent: toRGB256(COL_WARM),
      accentInk: toRGB256(COL_DARK),
      accentSoft: toRGB256(COL_LIGHT),
      cream: toRGB256(COL_CREAM),
    };
  }
  const warmth = (v.warm - v.cool) * 0.18;
  const darkness = (v.dark - v.light) * 0.12;
  const cool = (v.cool - v.warm) * 0.10;

  const shift = (
    base: readonly number[],
    r: number,
    g: number,
    b: number,
  ): RGB256 => [
    Math.round(clamp01(base[0] + r) * 255),
    Math.round(clamp01(base[1] + g) * 255),
    Math.round(clamp01(base[2] + b) * 255),
  ];

  return {
    ink: COL_INK,
    muted: COL_MUTED,
    hairline: COL_HAIRLINE,
    accent: shift(
      COL_WARM,
      warmth * 0.5 - cool * 0.4 - darkness * 0.2,
      -warmth * 0.15 - darkness * 0.1,
      -warmth * 0.25 + cool * 0.35,
    ),
    accentInk: shift(
      COL_DARK,
      warmth * 0.6 - cool * 0.5,
      -warmth * 0.2 + cool * 0.1 - darkness * 0.3,
      -warmth * 0.3 + cool * 0.4,
    ),
    accentSoft: shift(
      COL_LIGHT,
      warmth * 0.3 - cool * 0.2 - darkness * 0.15,
      warmth * 0.1 - darkness * 0.1,
      -warmth * 0.1 + cool * 0.25,
    ),
    cream: shift(
      COL_CREAM,
      warmth * 0.05 - cool * 0.04 - darkness * 0.08,
      -cool * 0.02 - darkness * 0.06,
      cool * 0.05 - darkness * 0.05,
    ),
  };
}

function toRGB256(rgb: RGB): RGB256 {
  return [
    Math.round(rgb[0] * 255),
    Math.round(rgb[1] * 255),
    Math.round(rgb[2] * 255),
  ];
}

function rgbStr(c: RGB256, alpha = 1) {
  return alpha < 1
    ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
    : `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ── Public types ─────────────────────────────────────────────────────

export type StoryCardArgs = {
  retreatTitle: string;
  retreatLocation: string;
  durationDays: number;
  priceUsd: number;
  capacity: number;
  practiceStyle: string[];
  /** Mira's single-line quotation — drawn from matchLetter(). */
  miraQuote: string;
  /** Optional aesthetic vector. Defaults to Ardum's neutral warm cream. */
  aestheticVector?: AestheticVector | null;
  /** Optional return label. Defaults to the "claim your own" copy. */
  appName?: string;
  appUrl?: string;
};

// ── Component ────────────────────────────────────────────────────────

const VIEW = { w: 1080, h: 1920 };

export default function StoryCard(args: StoryCardArgs) {
  const {
    retreatTitle,
    retreatLocation,
    durationDays,
    priceUsd,
    capacity,
    practiceStyle,
    miraQuote,
    aestheticVector,
    appName = "Ardum",
    appUrl = "the shape of your practice",
  } = args;

  const palette = paletteForVector(aestheticVector);
  const bgStop0 = rgbStr(palette.cream, 1);
  const bgStop1 = rgbStr(palette.accentSoft, 0.45);

  // Wrap lengths tuned to viewBox 1080 wide, with comfortable side margins.
  // Each glyph in the Instrument-Serif-sized serif (108px) is wide, so
  // 11 chars/line keeps the wrapped title reading as one composed block
  // rather than a stack of single words. If the title exceeds three
  // lines we append "…" to the third so the truncation is visible.
  const titleLines = wrapWithEllipsis(retreatTitle, 11, 3);
  const quoteLines = wrapText(miraQuote, 32).slice(0, 4);

  const detailLine = `${durationDays} days · $${priceUsd.toLocaleString()} · cohort of ${capacity}`;
  const tagsLine = practiceStyle.slice(0, 3).join(" · ").toUpperCase();

  // Y anchors — each block's *first* baseline. Subsequent <tspan>s add
  // dy="line-height-em" rather than absolute y. We compute the
  // title block's height first so the blocks below can be placed
  // relative to it.
  const titleBlockTop = 760;
  const titleLineHeight = 115; // 108px font, line-height 1.06
  const titleBlockBottom =
    titleBlockTop + titleLines.length * titleLineHeight;
  const locationY = titleBlockBottom + 60;

  const ANCHOR = {
    wordmarkY: 280,
    quoteY: 380,
    quoteLineHeight: 60, // 44px font, line-height 1.36
    rule1Y: 650,
    titleY: titleBlockTop,
    titleLineHeight,
    locationY,
    detailY: locationY + 60,
    tagsY: locationY + 130,
    rule2Y: 1690,
    footLabelY: 1835,
    footLine2Y: 1880,
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Ardum match card for ${retreatTitle} in ${retreatLocation}`}
    >
      <defs>
        <radialGradient id="sc-bg" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={bgStop0} />
          <stop offset="100%" stopColor={bgStop1} />
        </radialGradient>
        <filter id="sc-noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" />
          <feColorMatrix
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0"
          />
        </filter>
      </defs>

      {/* Background — cream + radial gradient + grain */}
      <rect width={VIEW.w} height={VIEW.h} fill={rgbStr(palette.cream, 1)} />
      <rect width={VIEW.w} height={VIEW.h} fill="url(#sc-bg)" />
      <rect width={VIEW.w} height={VIEW.h} filter="url(#sc-noise)" opacity="0.55" />

      {/* Top Mira mark — anchor dot + halo */}
      <g transform={`translate(${VIEW.w / 2}, 200)`}>
        <circle r="6" fill={rgbStr(palette.accent, 1)} />
        <circle
          r="22"
          fill="none"
          stroke={rgbStr(palette.accent, 0.35)}
          strokeWidth="1"
        />
      </g>

      {/* Mira wordmark */}
      <text
        x={VIEW.w / 2}
        y={ANCHOR.wordmarkY}
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize={28}
        fill={rgbStr(palette.muted, 1)}
        letterSpacing="0.04em"
      >
        Mira
      </text>

      {/* Mira's quote — wrapped across multiple tspan lines */}
      <text
        x={VIEW.w / 2}
        y={ANCHOR.quoteY}
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize={44}
        fill={rgbStr(palette.ink, 1)}
        letterSpacing="-0.01em"
      >
        {quoteLines.map((line, i) => (
          <tspan
            key={i}
            x={VIEW.w / 2}
            dy={i === 0 ? 0 : ANCHOR.quoteLineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>

      {/* Hairline above title */}
      <line
        x1={360}
        y1={ANCHOR.rule1Y}
        x2={VIEW.w - 360}
        y2={ANCHOR.rule1Y}
        stroke={rgbStr(palette.hairline, 1)}
        strokeWidth="1"
      />

      {/* Retreat title — wrapped across multiple tspan lines */}
      <text
        x={VIEW.w / 2}
        y={ANCHOR.titleY}
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, 'Times New Roman', serif"
        fontSize={108}
        fill={rgbStr(palette.ink, 1)}
        letterSpacing="-0.025em"
        fontWeight={400}
      >
        {titleLines.map((line, i) => (
          <tspan
            key={i}
            x={VIEW.w / 2}
            dy={i === 0 ? 0 : ANCHOR.titleLineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>

      {/* Location — italic medium */}
      <text
        x={VIEW.w / 2}
        y={ANCHOR.locationY}
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize={44}
        fill={rgbStr(palette.muted, 1)}
        letterSpacing="-0.01em"
      >
        {retreatLocation}
      </text>

      {/* Detail row */}
      <text
        x={VIEW.w / 2}
        y={ANCHOR.detailY}
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
        fontSize={32}
        fill={rgbStr(palette.muted, 1)}
      >
        {detailLine}
      </text>

      {/* Practice style tags */}
      {tagsLine && (
        <text
          x={VIEW.w / 2}
          y={ANCHOR.tagsY}
          textAnchor="middle"
          fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
          fontSize={22}
          fill={rgbStr(palette.accentInk, 0.7)}
          letterSpacing="0.18em"
        >
          {tagsLine}
        </text>
      )}

      {/* Mid-line hairline */}
      <line
        x1={200}
        y1={ANCHOR.rule2Y}
        x2={VIEW.w - 200}
        y2={ANCHOR.rule2Y}
        stroke={rgbStr(palette.hairline, 0.7)}
        strokeWidth="1"
      />

      {/* Bottom Mira mark — larger, repeated for visual rhyme */}
      <g transform={`translate(${VIEW.w / 2}, 1770)`}>
        <circle r="4" fill={rgbStr(palette.accent, 1)} />
        <circle
          r="18"
          fill="none"
          stroke={rgbStr(palette.accent, 0.3)}
          strokeWidth="1"
        />
      </g>

      {/* Footer */}
      <text
        x={VIEW.w / 2}
        y={ANCHOR.footLabelY}
        textAnchor="middle"
        fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
        fontSize={22}
        fill={rgbStr(palette.muted, 0.85)}
        letterSpacing="0.22em"
      >
        MATCHED BY MIRA · REASONING VISIBLE
      </text>
      <text
        x={VIEW.w / 2}
        y={ANCHOR.footLine2Y}
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize={26}
        fill={rgbStr(palette.accentInk, 0.85)}
      >
        {`${appName} — ${appUrl}`}
      </text>
    </svg>
  );
}

// Greedy word-wrap that never splits a word. Empty input → [""]
// so the SVG <text> block has at least one tspan.
function wrapText(s: string, maxChars: number): string[] {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
      continue;
    }
    if ((current + " " + w).length <= maxChars) {
      current = current + " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Trim a wrapped result to `maxLines` and append an ellipsis to the
// last visible line if anything was dropped. Returns the full wrap
// unchanged if it fits, so callers don't need to special-case it.
function wrapWithEllipsis(
  s: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const lines = wrapText(s, maxChars);
  if (lines.length <= maxLines) return lines;
  const trimmed = lines.slice(0, maxLines);
  const lastIdx = trimmed.length - 1;
  trimmed[lastIdx] = trimmed[lastIdx] + "…";
  return trimmed;
}
