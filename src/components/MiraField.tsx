"use client";

// Mira's field — the app shell's persistent atmosphere. One full-bleed hero
// orb lives behind every journey surface (arrival, episode) and survives
// route changes, so Mira never remounts, shrinks, or pops in during
// navigation. Pages feed it posture/palette through useMiraField; the field
// itself is pathname-gated so secondary tooling surfaces (memory, attest)
// keep their document look.
//
// Press-and-hold on the orb summons a nudge — one insight from Mira drawn
// from the current episode state. The gesture layer is a transparent
// hit-area over the orb's center; the rest of the field stays
// pointer-events-none so page content works normally.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import MiraOrb from "./MiraOrb";
import MiraNudge from "./MiraNudge";
import MiraBeckon from "./MiraBeckon";
import { MiraImpulseProvider, useMiraImpulse } from "./MiraImpulse";
import { FluidPourProvider } from "./FluidParticlePour";
import {
  STEADY_PRESENCE,
  type MiraActivity,
  type MiraPresence,
} from "@/agent/mira-presence";
import { hasNudge, nudgeForEpisode, type Nudge } from "@/agent/mira-voice";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import type { AestheticVector } from "@/aesthetics/image-pool";
import type { Episode } from "@/episodes/model";

type FieldConfig = {
  /** Journey posture projected from operational state. */
  presence?: MiraPresence | null;
  /** Transient overlay while busy / narrating. */
  activity?: MiraActivity;
  aestheticVector?: AestheticVector | null;
  /**
   * 0–1 extra darkening over the field so dense content (the episode
   * workbench) stays legible; 0 lets the orb carry the whole screen.
   */
  veil?: number;
  /** The current episode, so the nudge projection can read its state. */
  episode?: Episode | null;
};

// The dusk field the orb glows within — warm terracotta settling into
// a deep dusk, not collapsing to black. Lifting the base luminance ~15%
// so the orb reads as a warm presence in warm space, not a light in a void.
const DUSK =
  "radial-gradient(ellipse 92% 82% at 50% 42%, #3a2418 0%, #221610 55%, #0f0a07 100%)";

// Legibility scrims layered over the orb: darken the top and bottom bands
// where copy sits, plus a soft vignette so the presence reads as light from
// depth. Softened from the original so the field breathes at the edges
// instead of feeling boxed in — companionable, not walled.
const SCRIM = [
  "linear-gradient(to bottom, rgba(15,10,7,0.62) 0%, rgba(15,10,7,0) 22%)",
  "linear-gradient(to top, rgba(15,10,7,0.68) 0%, rgba(15,10,7,0) 32%)",
  "radial-gradient(ellipse 78% 78% at 50% 48%, rgba(15,10,7,0) 52%, rgba(15,10,7,0.36) 100%)",
].join(", ");

/** Routes where the field is the atmosphere. */
function fieldActive(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/episode/") ||
    pathname.startsWith("/invite/")
  );
}

const MiraFieldContext = createContext<
  Dispatch<SetStateAction<FieldConfig | null>>
>(() => {});

// ── Gesture layer ────────────────────────────────────────────────────
// A transparent hit-area over the orb's center. Press-and-hold (or
// long-press on touch) fires a nudge impulse and shows the nudge card.
// Release dismisses the card. The hit-area is a circle roughly 40% of
// the viewport's smaller dimension, centered on the orb — generous enough
// to find without aiming, small enough not to block page interaction.

const HOLD_DELAY_MS = 180; // short — this is a reach, not a commitment
const GESTURE_AREA_RATIO = 0.36; // % of min(vw, vh)

function GestureLayer({
  episode,
  nudgeVisible,
  onNudgeShow,
  onNudgeHide,
  onPressingChange,
}: {
  episode: Episode | null | undefined;
  nudgeVisible: boolean;
  onNudgeShow: () => void;
  onNudgeHide: () => void;
  onPressingChange: (pressing: boolean) => void;
}) {
  const { fire } = useMiraImpulse();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressing = useRef(false);
  const [currentNudge, setCurrentNudge] = useState<Nudge | null>(null);

  // Compute the nudge fresh on each press — episode state may have changed.
  const beginHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (pressing.current) {
        const nudge = episode ? nudgeForEpisode(episode) : null;
        setCurrentNudge(nudge);
        fire("nudge");
        onNudgeShow();
      }
    }, HOLD_DELAY_MS);
  }, [episode, fire, onNudgeShow]);

  const endHold = useCallback(() => {
    pressing.current = false;
    onPressingChange(false);
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (nudgeVisible) {
      onNudgeHide();
    }
  }, [nudgeVisible, onNudgeHide, onPressingChange]);

  // Keyboard: space or enter triggers the nudge (press-and-release model).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        (e.key === " " || e.key === "Enter") &&
        !nudgeVisible
      ) {
        e.preventDefault();
        onPressingChange(true);
        const nudge = episode ? nudgeForEpisode(episode) : null;
        setCurrentNudge(nudge);
        fire("nudge");
        onNudgeShow();
      } else if (e.key === "Escape" && nudgeVisible) {
        e.preventDefault();
        onNudgeHide();
      }
    },
    [episode, fire, nudgeVisible, onNudgeShow, onNudgeHide, onPressingChange],
  );

  const gestureStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: `min(${GESTURE_AREA_RATIO * 100}vw, ${GESTURE_AREA_RATIO * 100}vh)`,
    height: `min(${GESTURE_AREA_RATIO * 100}vw, ${GESTURE_AREA_RATIO * 100}vh)`,
    borderRadius: "50%",
    pointerEvents: "auto",
    cursor: "pointer",
    // Transparent but interactive — the orb is the visual, this is the
    // gesture target.
    background: "transparent",
    // Keep above the field layers but below page content.
    zIndex: 5,
  };

  return (
    <>
      <div
        style={gestureStyle}
        role="button"
        tabIndex={0}
        aria-label="Press and hold for a note from Mira"
        aria-expanded={nudgeVisible}
        onPointerDown={(e) => {
          pressing.current = true;
          onPressingChange(true);
          beginHold();
          // Capture so we get the up event even if pointer moves out.
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={() => endHold()}
        onPointerLeave={() => {
          if (pressing.current) endHold();
        }}
        onPointerCancel={() => endHold()}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            if (nudgeVisible) onNudgeHide();
          }
        }}
      />
      <MiraNudge nudge={currentNudge} visible={nudgeVisible} />
    </>
  );
}

export function MiraFieldProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<FieldConfig | null>(null);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [pressing, setPressing] = useState(false);
  const active = fieldActive(pathname);
  const scrollProgress = useScrollProgress();

  // Compute nudge availability and merge it into the presence so the orb
  // leans in (poke) when Mira has something to say. projectMiraPresence is
  // the source of posture; nudgeAvailable is layered on here to keep the
  // presence module decoupled from voice. The nudgeKind rides along so the
  // poke can vary its haptic by urgency.
  const basePresence = config?.presence ?? STEADY_PRESENCE;
  const episode = config?.episode;
  const nudgeAvailable = episode ? hasNudge(episode) : false;
  const nudgeKind = nudgeAvailable
    ? nudgeForEpisode(episode!)?.kind ?? undefined
    : undefined;
  const presence: MiraPresence = nudgeAvailable
    ? { ...basePresence, nudgeAvailable: true, nudgeKind }
    : basePresence;

  // Phase 3: the poke — a subtle 6px lean toward the whisper position when
  // Mira has a nudge ready. Phase 4: scroll-responsive sizing — the orb
  // grows up to 1.05x as the practitioner scrolls past the fold. Both
  // transforms ride an eased CSS transition so they glide, never snap.
  const orbTransform = `translateX(${nudgeAvailable ? 6 : 0}px) scale(${1 + scrollProgress * 0.05})`;

  return (
    <MiraImpulseProvider>
      <FluidPourProvider>
        <MiraFieldContext.Provider value={setConfig}>
          {active && (
            <div
              className="fixed inset-0 z-0 pointer-events-none"
              aria-hidden
              style={{ backgroundColor: "#0f0a07" }}
            >
              <div className="absolute inset-0" style={{ background: DUSK }} />
              <div
                className="absolute inset-0"
                style={{
                  transform: orbTransform,
                  transition:
                    "transform 900ms cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                <MiraOrb
                  fill
                  size={480}
                  presence={presence}
                  activity={config?.activity}
                  aestheticVector={config?.aestheticVector}
                />
              </div>
              <div className="absolute inset-0" style={{ background: SCRIM }} />
              <div
                className="absolute inset-0 transition-opacity duration-700"
                style={{
                  background: "#0f0a07",
                  opacity: config?.veil ?? 0,
                }}
              />
              <GestureLayer
                episode={episode}
                nudgeVisible={nudgeVisible}
                onNudgeShow={() => setNudgeVisible(true)}
                onNudgeHide={() => setNudgeVisible(false)}
                onPressingChange={setPressing}
              />
              <MiraBeckon pressing={pressing} nudgeVisible={nudgeVisible} />
            </div>
          )}
          {children}
        </MiraFieldContext.Provider>
      </FluidPourProvider>
    </MiraImpulseProvider>
  );
}

/**
 * Feed the shell field from a journey surface. The latest mounted caller
 * wins; unmounting hands the field back to its steady default so the orb
 * glides — never snaps — between pages.
 */
export function useMiraField({
  presence,
  activity,
  aestheticVector,
  veil,
  episode,
}: FieldConfig) {
  const setConfig = useContext(MiraFieldContext);

  useEffect(() => {
    setConfig({ presence, activity, aestheticVector, veil, episode });
  }, [setConfig, presence, activity, aestheticVector, veil, episode]);

  useEffect(() => () => setConfig(null), [setConfig]);
}
