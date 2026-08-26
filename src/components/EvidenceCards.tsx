"use client";

// EvidenceCards — provenance surfaced as inspectable cards, not text dumps.
//
// The "How this is secured" disclosure and the wider-aperture evidence panels
// currently show evidence as plain text paragraphs. This component presents
// the same data as compact cards: title, body, source badge, and a provenance
// line. Each card enters once and stays available — the same lifecycle as the
// ContextCards primitive, adapted to Ardum's evidence vocabulary.
//
// Evidence vocabulary (replaces PDF/CSV badges):
//   attested  — on-chain attestation (0G Storage root hash)
//   on-chain  — settlement/escrow record (tx hash)
//   semantic  — Cognee-enriched memory (supplementary, lossy)
//   reported  — anonymized cohort evidence (wider-aperture, contributed)
//   public    — public web evidence (inspected claims)
//
// The cards use dusk tokens and Mira's voice register — quiet, not clinical.

import { motion } from "framer-motion";

export type EvidenceBadge =
  | "attested"
  | "on-chain"
  | "semantic"
  | "reported"
  | "public";

export type EvidenceCard = {
  title: string;
  body: string;
  badge: EvidenceBadge;
  source?: string;
  sourceUrl?: string;
  refreshedAt?: string;
  provenance?: string;
};

const BADGE_STYLES: Record<EvidenceBadge, { bg: string; label: string }> = {
  attested: { bg: "var(--accent)", label: "0G" },
  "on-chain": { bg: "var(--accent-ink)", label: "chain" },
  semantic: { bg: "var(--muted)", label: "mem" },
  reported: { bg: "var(--accent-soft)", label: "cohort" },
  public: { bg: "var(--accent-soft)", label: "web" },
};

function formatRefreshed(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EvidenceCards({
  cards,
  total,
}: {
  cards: EvidenceCard[];
  total?: number;
}) {
  return (
    <div className="space-y-2" data-testid="evidence-cards">
      {total !== undefined && (
        <div
          className="flex items-center gap-2 px-0.5"
          style={{ animation: "fade-in 400ms ease-out both" }}
        >
          <span className="tag">evidence</span>
          <span className="inline-flex h-5 items-center rounded-md border border-[color:var(--hairline)] px-1.5 text-[11.5px] font-medium text-[color:var(--muted)] tabular-nums">
            {total}
          </span>
        </div>
      )}

      {cards.map((card, i) => {
        const refreshed = formatRefreshed(card.refreshedAt);
        const badgeStyle = BADGE_STYLES[card.badge];
        return (
          <motion.div
            key={`${card.title}-${i}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 120,
              damping: 20,
              mass: 0.8,
              delay: i * 0.08,
            }}
            className="overflow-hidden rounded-sm border border-[color:var(--hairline)] bg-[color:var(--surface)] surface-card"
          >
            <div className="flex items-center gap-2.5 border-b border-[color:var(--hairline)] px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[color:var(--foreground)]">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                <span className="truncate">{card.title}</span>
              </span>
              <span className="ml-auto shrink-0 text-[12px] text-[color:var(--muted)] tabular-nums">
                {card.provenance}
              </span>
            </div>
            <p className="px-3 pt-2 pb-1 text-[12.5px] leading-relaxed text-[color:var(--muted)]">
              {card.body}
            </p>
            <div className="px-3 pb-3">
              <span
                className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[color:var(--surface)] border border-[color:var(--hairline)] px-2 text-[12px] font-medium text-[color:var(--muted)] transition-colors duration-300 hover:border-[color:var(--accent-soft)]"
              >
                <span
                  className="flex size-3.5 items-center justify-center rounded-[4px] text-[7px] font-bold text-white"
                  style={{ background: badgeStyle.bg }}
                  aria-label={badgeStyle.label}
                >
                  {badgeStyle.label}
                </span>
                {card.sourceUrl ? (
                  <a
                    href={card.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    {card.source}
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="inline-block ml-1"
                      aria-hidden
                    >
                      <path d="M7 17L17 7M7 7h10v10" />
                    </svg>
                  </a>
                ) : (
                  card.source
                )}
                {refreshed && (
                  <span className="text-[color:var(--muted)] opacity-60">
                    · {refreshed}
                  </span>
                )}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
