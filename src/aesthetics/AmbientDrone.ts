// Web Audio API ambient drone synthesizer.
//
// Generates evolving ambient soundscapes in-browser — no files, no API
// calls, fully deterministic. The drone shifts based on the user's
// aesthetic preference vector: warm preferences → lower frequencies,
// cool preferences → higher, calming → slower modulation, energizing
// → faster.
//
// This is Tier 1 sound: zero cost, instant, reliable. We layer in
// curated real sounds (ocean, forest) at Tier 2 on the match detail
// page.

import type { AestheticVector } from "./image-pool";

type DroneParams = {
  baseFreq: number; // Root frequency (Hz)
  harmonic: number; // Harmonic ratio (1 = unison, 1.5 = fifth, 2 = octave)
  lfoFreq: number; // Modulation speed (Hz)
  filterFreq: number; // Lowpass cutoff (Hz)
  reverb: number; // Reverb amount (0-1)
};

// Map an aesthetic vector to drone parameters.
// Warm → lower freq, cool → higher
// Calming → slow LFO, energizing → faster
// Dark → lower filter, light → higher
// Expansive → more reverb, intimate → less
export function vectorToDroneParams(v: AestheticVector): DroneParams {
  const warmth = v.warm - v.cool; // -1 (cool) to 1 (warm)
  const energy = v.energizing - v.calming; // -1 (calm) to 1 (energizing)
  const brightness = v.light - v.dark; // -1 (dark) to 1 (light)
  const space = v.expansive - v.intimate; // -1 (intimate) to 1 (expansive)

  return {
    baseFreq: 110 + warmth * -30, // 80Hz (warm) to 140Hz (cool)
    harmonic: 1.5, // Perfect fifth — universally consonant
    lfoFreq: 0.1 + energy * 0.15, // 0.05Hz (calm) to 0.25Hz (energizing)
    filterFreq: 400 + brightness * 600, // 200Hz (dark) to 1000Hz (light)
    reverb: 0.3 + space * 0.3, // 0.0 (intimate) to 0.6 (expansive)
  };
}

export class AmbientDrone {
  private ctx: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private params: DroneParams | null = null;

  async start(params: DroneParams) {
    if (this.ctx) return; // Already running
    this.params = params;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // Master gain — fade in over 2 seconds
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.15, now + 2);
    this.masterGain.connect(this.ctx.destination);

    // Lowpass filter — shaped by brightness
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.setValueAtTime(params.filterFreq, now);
    this.filter.Q.setValueAtTime(1, now);
    this.filter.connect(this.masterGain);

    // Two oscillators — root and harmonic, slightly detuned
    const freqs = [params.baseFreq, params.baseFreq * params.harmonic];
    const detunes = [0, 3]; // Slight detune for warmth

    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freqs[i], now);
      osc.detune.setValueAtTime(detunes[i], now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(i === 0 ? 0.6 : 0.3, now);

      osc.connect(gain);
      gain.connect(this.filter);
      osc.start(now);

      this.oscillators.push(osc);
      this.gainNodes.push(gain);
    }

    // LFO — slow modulation of filter frequency for movement
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.setValueAtTime(params.lfoFreq, now);

    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(params.filterFreq * 0.3, now);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start(now);
  }

  // Smoothly transition to new params (for when preferences update)
  transition(params: DroneParams) {
    if (!this.ctx || !this.filter || !this.lfo || !this.lfoGain) return;
    this.params = params;

    const now = this.ctx.currentTime;
    const duration = 3; // 3-second smooth transition

    this.filter.frequency.linearRampToValueAtTime(params.filterFreq, now + duration);
    this.lfo.frequency.linearRampToValueAtTime(params.lfoFreq, now + duration);
    this.lfoGain.gain.linearRampToValueAtTime(params.filterFreq * 0.3, now + duration);

    // Oscillator frequencies
    const freqs = [params.baseFreq, params.baseFreq * params.harmonic];
    for (let i = 0; i < this.oscillators.length && i < freqs.length; i++) {
      this.oscillators[i].frequency.linearRampToValueAtTime(freqs[i], now + duration);
    }
  }

  stop() {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const fadeDuration = 1.5;

    // Fade out
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
    }

    // Stop oscillators after fade
    setTimeout(() => {
      this.oscillators.forEach((osc) => {
        try { osc.stop(); } catch { /* already stopped */ }
      });
      try { this.lfo?.stop(); } catch { /* already stopped */ }
      this.ctx?.close();
      this.ctx = null;
      this.oscillators = [];
      this.gainNodes = [];
      this.lfo = null;
      this.lfoGain = null;
      this.filter = null;
      this.masterGain = null;
    }, fadeDuration * 1000 + 100);
  }
}
