import { ImageResponse } from "next/og";
import { listAttestations } from "@/lib/og-storage";
import { publicEnv } from "@/lib/env";
import { getMatchRun } from "@/lib/session";

// Open Graph image for /match/[id] — shared match links show a preview
// card in chat, Slack, Twitter, etc. The image pulls the retreat title,
// location, price, days, capacity, and the fit score (if we have a match
// run for this retreat on file).
//
// ImageResponse is rendered by Satori; we keep typography simple (system
// serif + sans fallback) so it works without an extra font fetch.

export const alt = "Ardum retreat match";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const [attestations] = await Promise.all([listAttestations()]);
  const a = attestations.find((x) => x.rootHash === id);

  // Try to find a fit score for this retreat from any saved match run.
  let score: number | null = null;
  const sessions = (globalThis as { __ardumSessions?: Map<string, { matchRun?: import("@/matching/types").MatchRun }> })
    .__ardumSessions;
  if (sessions) {
    for (const s of sessions.values()) {
      const r = s.matchRun;
      if (!r) continue;
      const hit = r.results.find(
        (m) => m.id === id || m.retreatRootHash === id
      );
      if (hit) {
        score = hit.score;
        break;
      }
    }
  }

  const title = a?.title ?? "Retreat match";
  const location = a?.claims.location ?? "";
  const days = a?.claims.durationDays ?? 0;
  const price = a?.claims.priceUsd ?? 0;
  const capacity = a?.claims.capacity ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f6f1e7",
          color: "#1a1714",
          padding: "72px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Top: wordmark + tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            color: "#524a42",
            fontSize: 22,
            letterSpacing: "0.05em",
          }}
        >
          <span style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: 32, color: "#1a1714", letterSpacing: "-0.02em" }}>
            {publicEnv.NEXT_PUBLIC_APP_NAME}
          </span>
          <span style={{ fontStyle: "italic" }}>the shape of your practice</span>
        </div>

        {/* Middle: title + meta */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#524a42", fontSize: 22, marginBottom: 16 }}>
            {location}
          </div>
          <div
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: 88,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#1a1714",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 28,
              color: "#1a1714",
              fontSize: 26,
            }}
          >
            <span>{days} days</span>
            <span>·</span>
            <span>${price.toLocaleString()}</span>
            <span>·</span>
            <span>cohort of {capacity}</span>
          </div>
        </div>

        {/* Bottom: fit score (if known) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid #c2b6a2",
          }}
        >
          <div
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: 28,
              fontStyle: "italic",
              color: "#524a42",
              maxWidth: 720,
              lineHeight: 1.3,
            }}
          >
            matching agent · attested on 0G Storage · reasoning visible at every step
          </div>
          {score !== null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div
                style={{
                  fontFamily: "ui-serif, Georgia, serif",
                  fontSize: 96,
                  lineHeight: 1,
                  color: "#a85a3a",
                }}
              >
                {Math.round(score * 100)}
              </div>
              <div style={{ color: "#524a42", fontSize: 22, marginTop: 4 }}>
                fit score
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
