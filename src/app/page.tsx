import Intake from "@/calibration/Intake";

export default function Home() {
  return (
    <>
      <section className="mx-auto w-full max-w-2xl px-6 sm:px-10 pt-8 sm:pt-12 pb-6">
        <p className="tag mb-4">a short calibration</p>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
          The shape of your practice.
        </h1>
        <p className="text-lg text-[color:var(--muted)] max-w-prose leading-relaxed">
          Ardum matches you to a yoga retreat using verified attestations —
          not marketing copy. A few honest questions, an optional
          five-second posture sample, then an agent that explains every
          step of its reasoning before it recommends anything.
        </p>
      </section>
      <Intake />
    </>
  );
}
