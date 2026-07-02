import UploadForm from "@/attestation/UploadForm";
import RevealSection from "@/components/RevealSection";
import OperatorProviders from "@/booking/OperatorProviders";

export default function AttestPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <RevealSection delay={0}>
        <p className="tag mb-4">write an attestation</p>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
          Attest to a retreat you know.
        </h1>
        <p className="text-lg text-[color:var(--muted)] max-w-prose mb-10 leading-relaxed">
          Attestations are signed by your wallet and stored on 0G Storage.
          They become part of the matching pool — your claim about a retreat
          is what other practitioners&apos; agents reason over.
        </p>

        <p className="why mb-12 max-w-prose">
          Sign in with Google for gasless attestation writes (Particle Auth +
          ZeroDev). No MetaMask, no ETH needed. Or use the classic wallet
          flow below.
        </p>
      </RevealSection>

      <OperatorProviders>
        <RevealSection delay={150}>
          <UploadForm />
        </RevealSection>
      </OperatorProviders>
    </section>
  );
}
