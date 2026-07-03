import Intake from "@/calibration/Intake";
import MaskReveal from "@/components/MaskReveal";
import MiraOrb from "@/components/MiraOrb";
import ParallaxHero from "@/components/ParallaxHero";
import ScrollReveal from "@/components/ScrollReveal";

export default function Home() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[78vh] overflow-hidden">
        <ParallaxHero />
        <div className="relative z-10 mx-auto w-full max-w-4xl px-6 sm:px-10 pt-20 sm:pt-28 pb-16 min-h-[70vh] flex flex-col justify-center">
        {/* Mira breathing in the hero — the agent is present from the first frame */}
        <div className="flex items-center gap-3 mb-6 t-stagger is-shown">
          <MiraOrb size={36} state="calm" />
          <span className="t-stagger-line tag text-shadow-soft">Mira is here</span>
        </div>
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
            Talk to Mira →
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
            Calibrate. Reason. Match. Book.
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
                <ScrollReveal from="right" scrub={0.4}>
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
                </ScrollReveal>
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
                <ScrollReveal from="left" scrub={0.4} stagger>
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
                </ScrollReveal>
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
                <ScrollReveal from="right" scrub={0.4}>
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
                <button
                  type="button"
                  className="mt-4 w-full px-5 py-2.5 rounded-sm bg-[color:var(--accent)] text-background text-sm text-center"
                >
                  Book this retreat →
                </button>
                </ScrollReveal>
              </div>
            </div>
          </MaskReveal>

          {/* Step 4 */}
          <MaskReveal>
            <div className="grid sm:grid-cols-2 gap-8 sm:gap-16 items-center">
              <div className="order-last sm:order-first">
                <span className="font-serif text-6xl text-[color:var(--accent-soft)] leading-none">04</span>
                <h3 className="font-serif text-3xl tracking-tight mt-2 mb-4">Book</h3>
                <p className="text-[color:var(--muted)] leading-relaxed">
                  Sign in with Google. No MetaMask, no seed phrase, no gas.
                  A Universal Account upgrades your wallet via EIP-7702,
                  routes your deposit cross-chain, and settles on Arbitrum —
                  all in one click. The booking is attested on 0G Storage.
                </p>
              </div>
              <div className="border border-[color:var(--hairline)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
                <ScrollReveal from="left" scrub={0.4} stagger>
                <div className="flex gap-2 mb-6">
                  {[
                    { n: 1, label: "Sign in", done: true },
                    { n: 2, label: "Upgrade", done: true },
                    { n: 3, label: "Deposit", done: false },
                    { n: 4, label: "Attest", done: false },
                  ].map((s, i) => (
                    <div key={s.n} className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                          s.done
                            ? "bg-[color:var(--accent)] text-background"
                            : "border border-[color:var(--accent)] text-[color:var(--accent)]"
                        }`}
                      >
                        {s.done ? "✓" : s.n}
                      </span>
                      <span
                        className={`text-xs ${
                          s.done ? "text-foreground" : "text-[color:var(--accent)]"
                        }`}
                      >
                        {s.label}
                      </span>
                      {i < 3 && (
                        <span className="text-[color:var(--hairline)] mx-1">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-[color:var(--muted)] mb-4">
                  Deposit $1,800 — UA routes from any chain, settles on Arbitrum.
                </p>
                <div className="flex items-center gap-3">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] pulse-soft" />
                  <span className="tag">Depositing on Arbitrum…</span>
                </div>
                <div className="h-px bg-[color:var(--hairline)] my-4" />
                <p className="tag opacity-70">
                  powered by Magic + Particle UA + Arbitrum escrow
                </p>
                </ScrollReveal>
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
