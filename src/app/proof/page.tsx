import Link from "next/link";
import RevealSection from "@/components/RevealSection";
import {
  ESCROW_CONTRACT_ADDRESS,
  SETTLE_CHAIN_ID,
  USDC_ADDRESS,
} from "@/booking/constants";

/** Partner / skeptic surface — rails proof, not on the practitioner primary path. */
export default function ProofPage() {
  const chainLabel =
    SETTLE_CHAIN_ID === 42161 ? "Arbitrum One" : "Arbitrum Sepolia (testnet)";

  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <RevealSection delay={0}>
        <p className="tag mb-4">how commitment is secured</p>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
          Inspectable rails, not the product.
        </h1>
        <p className="text-lg text-[color:var(--muted)] max-w-prose mb-6 leading-relaxed">
          Practitioners grant amount and bounds; Mira runs settlement, escrow,
          and evidence recording ambiently. This page is for operators, partners,
          and skeptics — not the journey spine.
        </p>
        <p className="why max-w-prose mb-12">
          <Link href="/" className="underline underline-offset-4">
            ← back to your intention
          </Link>
        </p>
      </RevealSection>

      <RevealSection delay={80}>
        <h2 className="font-serif text-2xl tracking-tight mb-3">Grant model</h2>
        <p className="text-[color:var(--muted)] leading-relaxed max-w-prose mb-10">
          Commitment is a scoped grant: confirm deposit, hold-until-arrival,
          release on check-in. No multi-phase checkout; no wallet choreography
          on the primary path. See{" "}
          <code className="text-sm">docs/decisions/0008-agentic-commitment.md</code>.
        </p>
      </RevealSection>

      <RevealSection delay={120}>
        <h2 className="font-serif text-2xl tracking-tight mb-3">Settlement</h2>
        <ul className="space-y-2 text-sm text-[color:var(--muted)] max-w-prose mb-10">
          <li>
            <span className="tag">chain</span> {chainLabel} ({SETTLE_CHAIN_ID})
          </li>
          <li>
            <span className="tag">token</span> USDC · {USDC_ADDRESS}
          </li>
          <li>
            <span className="tag">identity</span> Magic social login → EOA;
            optional Particle Universal Account (EIP-7702) for delegation
          </li>
        </ul>
      </RevealSection>

      <RevealSection delay={160}>
        <h2 className="font-serif text-2xl tracking-tight mb-3">Escrow</h2>
        <p className="text-[color:var(--muted)] leading-relaxed max-w-prose mb-4">
          Deposits route to an on-chain escrow contract. Funds stay held until
          check-in window; operator payout is bounded by the grant, not an
          open-ended charge.
        </p>
        <p className="tag break-all leading-relaxed mb-10">
          {ESCROW_CONTRACT_ADDRESS
            ? `contract ${ESCROW_CONTRACT_ADDRESS}`
            : "contract not deployed in this environment (NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS)"}
        </p>
      </RevealSection>

      <RevealSection delay={200}>
        <h2 className="font-serif text-2xl tracking-tight mb-3">
          Reservation record
        </h2>
        <p className="text-[color:var(--muted)] leading-relaxed max-w-prose mb-4">
          After settlement, Ardum writes a canonical booking attestation (signed
          by the practitioner wallet) and stores evidence on 0G Storage. Episode
          state holds normalized references — transaction id, booking root hash —
          surfaced in &ldquo;How this is secured&rdquo; after commit.
        </p>
        <p className="why max-w-prose mb-10">
          Retreat matching pool attestations are written separately via{" "}
          <Link href="/attest" className="underline underline-offset-4">
            /attest
          </Link>
          .
        </p>
      </RevealSection>

      <RevealSection delay={240}>
        <h2 className="font-serif text-2xl tracking-tight mb-3">
          What stays off the primary path
        </h2>
        <ul className="space-y-3 text-sm text-[color:var(--muted)] max-w-prose">
          <li>Drop-in class trials — deferred until a product bet (no orphan UI)</li>
          <li>Stack vocabulary, chain ids, and contract addresses in journey copy</li>
          <li>Marketplace browse or ranked-results checkout</li>
        </ul>
      </RevealSection>
    </section>
  );
}
