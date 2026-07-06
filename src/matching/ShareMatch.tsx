"use client";

// ShareMatch — the viral loop entry point.
//
// Two affordances, side-by-side, with different intents:
//
//   "Share your match"   → a native share sheet / clipboard link. For
//                           someone who wants to text a friend the URL.
//   "Save to Camera Roll" → a 1080×1920 IG-Stories-friendly PNG of
//                           Mira's match, downloaded via <canvas>.
//
// The PNG is the thing people *post*. The link is the thing they *send*.
// Both are viral channels but they need different shapes.
//
// ── The PNG flow ───────────────────────────────────────────────────────
//
// `renderToStaticMarkup(<StoryCard />)` produces a self-contained <svg>
// string. We wrap it (already an <svg>), URL-encode it as a data URI,
// load it into an Image, draw to an offscreen 1080×1920 canvas, and call
// `canvas.toBlob()` to get the .png file. The whole thing happens in
// the user's browser — no upload, no server.
//
// A 1100ms "Mira is rendering…" delay is intentional. The canvas
// operation itself is sub-300ms on a modern phone, but the dwell time
// matters: it makes the act feel like a small ceremony instead of a
// generic export. Mira never feels like a produce button.
//
// ── The link flow ──────────────────────────────────────────────────────
//
// ?ref= is appended to every shared URL with a stable per-session token.
// We'll route via the existing sessionId (already in the URL) so analytics
// stays simple. Refusing to add a userId query keeps the share link feeling
// private: no info-leak about who is sharing it.

import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import StoryCard, { type StoryCardArgs } from "./StoryCard";
import type { MatchResult } from "./types";

type ShareMatchProps = {
  match: MatchResult;
  /** Optional aesthetic vector from the intake journey — tints the card. */
  aestheticVector?: StoryCardArgs["aestheticVector"];
  /** Optional sessionId used as a relay parameter in the share URL. */
  sessionId?: string;
};

export default function ShareMatch({ match, aestheticVector, sessionId }: ShareMatchProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [renderState, setRenderState] = useState<
    "idle" | "rendering" | "saved" | "error"
  >("idle");
  const renderTimerRef = useRef<number | null>(null);

  const shareUrl =
    typeof window !== "undefined" && sessionId
      ? `${window.location.origin}/match/${match.id}?session=${encodeURIComponent(sessionId)}&ref=share`
      : typeof window !== "undefined"
        ? `${window.location.origin}/match/${match.id}?ref=share`
        : "";

  const shareText = `Mira matched me with ${match.retreatTitle} — ${match.retreatLocation}. Reasoning visible. ${shareUrl}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setExpanded(true);
    }
  }

  async function shareNative() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Ardum — ${match.retreatTitle}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed — fall back to clipboard.
      }
    }
    copyLink();
  }

  // ── Save-to-Camera-Roll flow ─────────────────────────────────────────
  //
  // We clear any in-flight render timer on unmount so a user navigating
  // away mid-render doesn't leave a dangling timeout that sets state on
  // an unmounted component.
  useEffect(() => {
    return () => {
      if (renderTimerRef.current !== null) {
        window.clearTimeout(renderTimerRef.current);
      }
    };
  }, []);

  async function downloadStory() {
    if (renderState === "rendering") return; // guard against double-click
    setRenderState("rendering");

    // The dwell makes it feel like a breath, not a button. We start the
    // canvas work immediately but the UI lags it on purpose.
    const dwell = new Promise<void>((resolve) => {
      renderTimerRef.current = window.setTimeout(() => {
        renderTimerRef.current = null;
        resolve();
      }, 1100);
    });

    try {
      const blob = await svgToPngBlob({
        retreatTitle: match.retreatTitle,
        retreatLocation: match.retreatLocation,
        durationDays: match.durationDays,
        priceUsd: match.priceUsd,
        capacity: match.capacity,
        practiceStyle: match.practiceStyle,
        miraQuote: match.headline || `I found a retreat that fits where you are right now.`,
        aestheticVector: aestheticVector ?? null,
        appName: "Ardum",
        appUrl: "the shape of your practice",
      });

      await dwell;
      triggerDownload(
        blob,
        `ardum-${slug(match.retreatTitle)}-${slug(match.retreatLocation)}.png`,
      );
      setRenderState("saved");
      window.setTimeout(() => setRenderState("idle"), 3000);
    } catch (err) {
      console.error("[ardum] story card render failed:", err);
      await dwell;
      setRenderState("error");
      window.setTimeout(() => setRenderState("idle"), 4000);
    }
  }

  return (
    <div className="mt-6">
      {/* Collapsed state — the invitation */}
      {!expanded && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={shareNative}
            className="px-4 py-2 rounded-sm border border-[color:var(--accent-soft)] hover:bg-[color:var(--surface)] transition-colors text-sm flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copied ? "Copied!" : "Share your match"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-4 py-2 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors text-sm flex items-center gap-2"
            data-testid="save-for-instagram"
          >
            Save for Instagram →
          </button>
        </div>
      )}

      {/* Expanded state — the IG-Stories card preview + Save action */}
      {expanded && (
        <div
          className="border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card fade-in-up"
          data-testid="share-match-expanded"
        >
          <p className="tag mb-4">share card preview</p>

          {/* The 1080×1920 card, rendered at 1:4 scale so it fits beside
              explanation text on most screens. The SVG scales losslessly,
              so even at this size the rendered glyphs read sharp. */}
          <div className="flex justify-center mb-6">
            <div
              className="relative"
              style={{
                width: 270,
                height: 480,
                boxShadow: "0 4px 22px rgba(26,23,20,0.12)",
                borderRadius: 4,
                overflow: "hidden",
              }}
              data-testid="story-card-preview"
            >
              <StoryCard
                retreatTitle={match.retreatTitle}
                retreatLocation={match.retreatLocation}
                durationDays={match.durationDays}
                priceUsd={match.priceUsd}
                capacity={match.capacity}
                practiceStyle={match.practiceStyle}
                miraQuote={
                  match.headline ||
                  "I found a retreat that fits where you are right now."
                }
                aestheticVector={aestheticVector ?? null}
                appName="Ardum"
                appUrl="the shape of your practice"
              />
            </div>
          </div>

          <p className="text-sm text-[color:var(--muted)] leading-relaxed mb-5 max-w-prose">
            Save this card to your camera roll and post it as a Story. The
            QR-style link behind it pulls anyone who taps into the same
            agent reasoning — they can ask Mira why, and she&apos;ll answer.
          </p>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadStory}
              disabled={renderState === "rendering"}
              className={`px-5 py-2.5 rounded-sm text-sm transition-colors ${
                renderState === "rendering"
                  ? "bg-[color:var(--accent)] text-background mira-glow cursor-wait"
                  : renderState === "saved"
                    ? "bg-[color:var(--accent-ink)] text-background"
                    : renderState === "error"
                      ? "bg-[color:var(--surface-strong)] text-[color:var(--accent-ink)] border border-[color:var(--accent-soft)]"
                      : "bg-[color:var(--foreground)] text-background hover:bg-[color:var(--accent-ink)]"
              }`}
              data-testid="save-to-camera-roll"
            >
              {renderState === "rendering"
                ? "Mira is rendering…"
                : renderState === "saved"
                  ? "Saved to Camera Roll"
                  : renderState === "error"
                    ? "Couldn't render — try again"
                    : "Save to Camera Roll"}
            </button>
            <button
              type="button"
              onClick={shareNative}
              className="text-xs text-[color:var(--muted)] hover:text-foreground transition-colors"
            >
              {copied ? "Copied!" : "Send as link"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-[color:var(--muted)] hover:text-foreground transition-colors ml-auto"
            >
              ← back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Render the StoryCard SVG to a PNG Blob at 1080×1920.
 *
 * Pure browser-side rendering. Uses the React component's static
 * markup to avoid any Server Components / module complexity.
 */
async function svgToPngBlob(args: StoryCardArgs): Promise<Blob> {
  // renderToStaticMarkup returns the inner markup of a component. We
  // wrap it in an <svg> tag if it isn't already one. StoryCard's root
  // is an <svg>, so its serialization is already a complete document.
  const svgMarkup = renderToStaticMarkup(<StoryCard {...args} />);

  // Some browsers (older Safari, headless test envs) require the data
  // URI to be base64-encoded for Image.src decoding to work reliably.
  const encoded = btoa(unescape(encodeURIComponent(svgMarkup)));
  const dataUri = `data:image/svg+xml;base64,${encoded}`;

  const image = await loadImage(dataUri);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable.");
  }
  // Solid backdrop — covers any alpha channel the SVG background
  // doesn't paint to. The cream fill is also baked into the SVG; this
  // is belt-and-braces so the exported PNG never has a transparent
  // area when reposted on a non-cream background.
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.drawImage(image, 0, 0, 1080, 1920);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas produced no blob."));
    }, "image/png");
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Failed to load SVG into an Image element."));
    img.src = src;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Allow the click handler to surface before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
