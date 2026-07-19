import { Suspense } from "react";
import UploadForm from "@/attestation/UploadForm";
import RevealSection from "@/components/RevealSection";
import OperatorProviders from "@/booking/OperatorProviders";

export default function AttestPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
      <RevealSection delay={0}>
        <p className="tag mb-4">list a retreat</p>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
          Tell us about a retreat you run.
        </h1>
        <p className="text-lg text-[color:var(--muted)] max-w-prose mb-6 leading-relaxed">
          Your retreat enters the matching pool — when a practitioner
          describes what they need, Mira matches them to retreats that fit.
          The more honestly you describe who it suits, the better the matches.
        </p>

        <p className="why mb-12 max-w-prose">
          Sign in with Google. No crypto wallet, no ETH, no technical setup.
          Your Google account signs the retreat listing so practitioners
          know it came from a real person.
        </p>
      </RevealSection>

      <OperatorProviders>
        <RevealSection delay={150}>
          <Suspense fallback={null}>
            <UploadForm />
          </Suspense>
        </RevealSection>
      </OperatorProviders>
    </section>
  );
}
