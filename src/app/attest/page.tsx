import UploadForm from "@/attestation/UploadForm";

export default function AttestPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-12 pb-24">
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
        This is the only part of Ardum that requires a wallet. Browse and
        match without one — wallet is only for writing.
      </p>

      <UploadForm />
    </section>
  );
}
