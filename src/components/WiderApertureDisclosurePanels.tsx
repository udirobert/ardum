import type {
  CohortEvidence,
  InspectedClaim,
  PublicEvidence,
} from "@/evidence/wider-aperture";

const MUTED = "rgba(246,239,227,0.7)";
const FAINT = "rgba(246,239,227,0.55)";
const CREAM = "#f6efe3";

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
    <div className="space-y-3">
      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
        {evidence.summary}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: FAINT }}>
        Sources · Ardum anonymized journeys (n={evidence.sampleSize}) ·
        contributed with consent
        <br />
        Confidence · {evidence.provenance} aggregate · refreshed{" "}
        {formatRefreshed(evidence.refreshedAt)}
      </p>
    </div>
  );
}

export function PublicEvidencePanel({ evidence }: { evidence: PublicEvidence }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
        {evidence.summary}
      </p>
      {evidence.claims.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: FAINT }}>
            Claims inspected
          </p>
          <ul className="space-y-2">
            {evidence.claims.map((claim, index) => (
              <ClaimLine key={`${claim.text}-${index}`} claim={claim} />
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs" style={{ color: FAINT }}>
        Refreshed {formatRefreshed(evidence.refreshedAt)}
      </p>
    </div>
  );
}

function ClaimLine({ claim }: { claim: InspectedClaim }) {
  return (
    <li className="text-xs leading-relaxed" style={{ color: MUTED }}>
      <span style={{ color: CREAM }}>&ldquo;{claim.text}&rdquo;</span>
      {" — "}
      {claim.sourceUrl ? (
        <a
          href={claim.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-90"
          style={{ color: CREAM }}
        >
          {claim.sourceLabel}
        </a>
      ) : (
        claim.sourceLabel
      )}
      {" · fetched "}
      {formatRefreshed(claim.fetchedAt)}
      {" · "}
      {claim.provenance}
    </li>
  );
}
