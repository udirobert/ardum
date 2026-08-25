// Frame-rate-independent easing helpers for the Mira morphs.
//
// The morphing loop (three bodies: hero capsule shell, the ray-marched SDF
// core, and the 2D field) previously eased with a constant *per-frame* lerp
// factor. That makes the transition hit-rate dependent — at 120 Hz it converges
// roughly 2x faster than at 60 Hz, so the "same" feel changes with the display,
// and a dropped frame visibly steps the form. These helpers express the same
// easing as a *per-second* rate so it is stable regardless of refresh rate, and
// they clamp the frame delta so a stalled frame can never teleport the orb.

/**
 * Frame-rate-independent smoothing factor for one step of a length `dt` at a
 * per-second `rate`. Mirrors `current + (target - current) * (1 - exp(-rate*dt))`.
 * Derive `rate` from an old per-frame factor `f` at a known frame time `dtf`
 * with `rate = -Math.log(1 - f) / dtf`.
 */
export function smoothFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** Advance an eased scalar toward `target` at a per-second `rate` over `dt`. */
export function smoothApproach(
  current: number,
  target: number,
  rate: number,
  dt: number,
): number {
  return current + (target - current) * smoothFactor(rate, dt);
}

/**
 * Clamp an elapsed frame delta (seconds) so a crashed/hitched frame can't
 * cause a visible teleport. `maxDt` defaults to 1/20 s (~20 fps) — lost frames
 * are dropped, never folded into a big step.
 */
export function frameDelta(prev: number, now: number, maxDt = 0.05): number {
  const dt = now - prev;
  return dt > 0 ? Math.min(dt, maxDt) : 0;
}

/**
 * Whether two numeric param tuples differ by more than `eps` on any key.
 * Used to detect a *posture change* so the morph can fire a response burst
 * (instead of comparing identity on a prop object that may remap each render).
 */
export function paramsChanged(
  a: Record<string, number>,
  b: Record<string, number>,
  eps = 0.01,
): boolean {
  for (const key in a) {
    const va = a[key];
    const vb = b[key];
    if (va !== undefined && vb !== undefined && Math.abs(va - vb) > eps) {
      return true;
    }
  }
  return false;
}