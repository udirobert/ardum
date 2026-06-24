import Intake from "@/calibration/Intake";
import MaskReveal from "@/components/MaskReveal";
import HeroBackground from "@/components/HeroBackground";

export default function Home() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[78vh] overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 mx-auto w-full max-w-4xl px-6 sm:px-10 pt-20 sm:pt-28 pb-16 min-h-[70vh] flex flex-col justify-center">
        <div className="t-stagger is-shown">
          <span className="t-stagger-line tag mb-4 text-shadow-soft">agentic retreat matching</span>
          <strong className="t-stagger-line t-stagger-line--2 font-serif text-5xl sm:text-7xl leading-[1.02] tracking-tight mb-8 max-w-3xl block">
            A retreat matched to{" "}
            <span className="italic text-[color:var(--accent)]">your practice</span>,
            not a filter.
          </strong>
        </div>
        <p className="text-lg text-[color:var(--muted)] max-w-xl leading-relaxed text-shadow-soft">
          Three honest questions. An optional five-second posture sample.
          An agent that explains every step of its reasoning — out loud,
          in real time — before it recommends anything.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="#intake"
            className="px-6 py-3 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors text-center"
          >
            Start matching →
          </a>
          <a
            href="/retreats"
            className="px-6 py-3 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] text-[color:var(--muted)] hover:text-foreground transition-colors text-center"
          >
            Browse the pool
          </a>
        </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 sm:px-10 py-24">
        <MaskReveal>
          <p className="tag mb-4">how it works</p>
          <h2 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-16">
            Calibrate. Reason. Match.
          </h2>
        </MaskReveal>

        <div className="grid gap-24">
          {/* Step 1 */}
          <MaskReveal>
            <div className="grid sm:grid-cols-2 gap-8 sm:gap-16 items-center">
              <div>
                <span className="font-serif text-6xl text-[color:var(--accent-soft)] leading-none">01</span>
                <h3 className="font-serif text-3xl tracking-tight mt-2 mb-4">Calibrate</h3>
                <p className="text-[color:var(--muted)] leading-relaxed">
                  Three questions about your energy, budget, and social comfort —
                  not categories, honest signals. Optionally, a five-second posture
                  sample processed entirely in your browser. Nothing leaves your machine
                  until you choose to match.
                </p>
              </div>
              <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
                <p className="tag mb-3">step 1 of 3</p>
                <p className="font-serif text-xl mb-4">How is your energy arriving?</p>
                <div className="space-y-2">
                  {["Settled", "In movement", "Low", "Sharp"].map((opt) => (
                    <div
                      key={opt}
                      className="px-4 py-3 rounded-sm border border-[color:var(--hairline)] text-sm text-[color:var(--muted)]"
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </MaskReveal>

          {/* Step 2 */}
          <MaskReveal>
            <div className="grid sm:grid-cols-2 gap-8 sm:gap-16 items-center">
              <div className="order-last sm:order-first">
                <span className="font-serif text-6xl text-[color:var(--accent-soft)] leading-none">02</span>
                <h3 className="font-serif text-3xl tracking-tight mt-2 mb-4">Reason</h3>
                <p className="text-[color:var(--muted)] leading-relaxed">
                  An agent searches the attestation pool — verified retreat reviews
                  stored on 0G Storage — and thinks out loud in Gherkin steps.
                  You watch every signal it considers, every weight it assigns,
                  before it makes a recommendation.
                </p>
              </div>
              <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
                <p className="tag mb-3">reasoning</p>
                <div className="space-y-4">
                  <div className="text-sm">
                    <p className="tag mb-1">Given</p>
                    <p className="italic text-sm leading-relaxed">Practitioner energy is &ldquo;low&rdquo;</p>
                  </div>
                  <div className="text-sm">
                    <p className="tag mb-1">When</p>
                    <p className="italic text-sm leading-relaxed">Matching against restorative retreats</p>
                  </div>
                  <div className="text-sm">
                    <p className="tag mb-1">Then</p>
                    <p className="italic text-sm leading-relaxed font-serif text-[color:var(--accent-ink)]">
                      Prioritize retreats with gentle practice styles
                    </p>
                  </div>
                </div>
                <p className="why pulse-soft mt-4 text-xs">agent reasoning&hellip;</p>
              </div>
            </div>
          </MaskReveal>

          {/* Step 3 */}
          <MaskReveal>
            <div className="grid sm:grid-cols-2 gap-8 sm:gap-16 items-center">
              <div>
                <span className="font-serif text-6xl text-[color:var(--accent-soft)] leading-none">03</span>
                <h3 className="font-serif text-3xl tracking-tight mt-2 mb-4">Match</h3>
                <p className="text-[color:var(--muted)] leading-relaxed">
                  A ranked recommendation with full reasoning attached. Every
                  signal the agent considered is visible. You can disagree with
                  any of them — the reasoning is yours to audit, not a black box.
                </p>
              </div>
              <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
                <p className="tag mb-2">match #1</p>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-xl tracking-tight truncate">
                      Bali — Stillness in Ubud
                    </p>
                    <p className="text-xs text-[color:var(--muted)] mt-0.5">
                      Ubud, Bali · 7 days · $1,800
                    </p>
                  </div>
                  <p className="font-serif text-2xl tabular-nums">87</p>
                </div>
                <p className="text-sm italic text-[color:var(--accent-ink)] mt-3 leading-snug">
                  Gentle movement in a setting designed for quiet. The pace and
                  energy align directly with where the practitioner is arriving from.
                </p>
                <div className="h-px bg-[color:var(--hairline)] my-4" />
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)]" />
                  <span className="tag">matched</span>
                </div>
              </div>
            </div>
          </MaskReveal>
        </div>
      </section>

      {/* Divider */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 sm:px-10">
        <div className="h-px bg-[color:var(--hairline)]" />
      </div>

      {/* Intake */}
      <div id="intake">
        <Intake />
      </div>
    </div>
  );
}
