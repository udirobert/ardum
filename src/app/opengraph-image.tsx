import { ImageResponse } from "next/og";
import { publicEnv } from "@/lib/env";

// Root Open Graph image — shown when ardum.app is shared in chat,
// Slack, Twitter, etc. The design mirrors the ArrivalScreen: cream
// background, the Mira orb as a warm gradient circle, the wordmark
// in serif, and the tagline.

export const alt = "Ardum — the shape of your practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f6f1e7",
          color: "#1a1714",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Mira orb — warm radial gradient circle */}
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 35%, #f6f1e7 0%, #e8d5b8 35%, #a85a3a 70%, #5a2e1c 100%)",
            marginBottom: 48,
            boxShadow: "0 0 80px rgba(168,90,58,0.25)",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 84,
            letterSpacing: "-0.03em",
            color: "#1a1714",
            marginBottom: 16,
          }}
        >
          {publicEnv.NEXT_PUBLIC_APP_NAME}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 32,
            fontStyle: "italic",
            color: "#524a42",
            letterSpacing: "0.01em",
          }}
        >
          the shape of your practice
        </div>

        {/* Sub-line */}
        <div
          style={{
            fontSize: 22,
            color: "#524a42",
            marginTop: 24,
            opacity: 0.7,
          }}
        >
          A persistent guide from intention to confident action.
        </div>
      </div>
    ),
    { ...size }
  );
}
