import EvidenceCards, { type EvidenceCard } from "./EvidenceCards";
import type {
  CohortEvidence,
  PublicEvidence,
} from "@/evidence/wider-aperture";

const MUTED = "rgba(246,239,227,0.7)";
const FAINT = "rgba(246,239,227,0.55)";

function formatRefreshed(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CohortEvidencePanel({ evidence }: { evidence: CohortEvidence }) {
  return (
    <EvidenceCards
      total={1}
      cards={[
        {
          title: evidence.intentionShapeLabel,
          body: evidence.summary,
          badge: "reported",
          source: `Ardum anonymized journeys (n=${evidence.sampleSize})`,
          provenance: `${evidence.provenance} aggregate`,
          refreshedAt: evidence.refreshedAt,
        },
      ]}
    />
  );
}

export function PublicEvidencePanel({ evidence }: { evidence: PublicEvidence }) {
  const cards: EvidenceCard[] = evidence.claims.map((claim) => ({
    title: claim.text.length > 80 ? `${claim.text.slice(0, 77)}…` : claim.text,
    body: claim.text,
    badge: "public" as const,
    source: claim.sourceLabel,
    sourceUrl: claim.sourceUrl,
    provenance: claim.provenance,
    refreshedAt: claim.fetchedAt,
  }));

  if (cards.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          {evidence.summary}
        </p>
        <p className="text-xs" style={{ color: FAINT }}>
          Refreshed {formatRefreshed(evidence.refreshedAt)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
        {evidence.summary}
      </p>
      <EvidenceCards cards={cards} total={cards.length} />
      <p className="text-xs" style={{ color: FAINT }}>
        Refreshed {formatRefreshed(evidence.refreshedAt)}
      </p>
    </div>
  );
}
