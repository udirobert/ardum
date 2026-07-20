"use client";

// Mira's field — the app shell's persistent atmosphere. One full-bleed hero
// orb lives behind every journey surface (arrival, episode) and survives
// route changes, so Mira never remounts, shrinks, or pops in during
// navigation. Pages feed it posture/palette through useMiraField; the field
// itself is pathname-gated so secondary tooling surfaces (memory, attest)
// keep their document look.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import MiraOrb from "./MiraOrb";
import MiraFreeRoamOrb from "./MiraFreeRoamOrb";
import { MiraImpulseProvider } from "./MiraImpulse";
import {
  STEADY_PRESENCE,
  type MiraActivity,
  type MiraPresence,
} from "@/agent/mira-presence";
import type { AestheticVector } from "@/aesthetics/image-pool";

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
  /**
   * `ambient` — 2D metaball field only (arrival voice lane).
   * `hero` — crossfade to 3D scene (episode climax). Default: hero.
   */
  fieldTier?: "ambient" | "hero";
  /**
   * Free-roaming mode: orb moves independently across viewport instead of
   * filling the screen. Content coexists via glass transparency.
   */
  freeRoam?: boolean;
  /** Free-roam motion state fed from the active page. */
  scrollProgress?: number;
  scrollVelocity?: number;
  activeTarget?: { x: number; y: number } | null;
};

// The dusk field the orb glows within — warm terracotta collapsing to near
// black.
const DUSK =
  "radial-gradient(ellipse 92% 82% at 50% 42%, #2a1a12 0%, #180f0a 55%, #0c0806 100%)";

// Legibility scrims layered over the orb: darken the top and bottom bands
// where copy sits, plus a soft vignette so the presence reads as light from
// depth. The orb's luminous middle stays clear.
const SCRIM = [
  "linear-gradient(to bottom, rgba(12,8,6,0.78) 0%, rgba(12,8,6,0) 26%)",
  "linear-gradient(to top, rgba(12,8,6,0.86) 0%, rgba(12,8,6,0) 36%)",
  "radial-gradient(ellipse 78% 78% at 50% 48%, rgba(12,8,6,0) 52%, rgba(12,8,6,0.5) 100%)",
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

export function MiraFieldProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<FieldConfig | null>(null);
  const active = fieldActive(pathname);

  // Free-roam mode: orb moves independently across viewport, rendered at shell level
  // so it persists across route changes without remounting.
  if (config?.freeRoam && active) {
    return (
      <MiraImpulseProvider>
        <MiraFieldContext.Provider value={setConfig}>
          <MiraFreeRoamOrb
            presence={config.presence ?? STEADY_PRESENCE}
            activity={config.activity}
            aestheticVector={config.aestheticVector}
            scrollProgress={config.scrollProgress ?? 0}
            scrollVelocity={config.scrollVelocity ?? 0}
            activeTarget={config.activeTarget}
          />
          {children}
        </MiraFieldContext.Provider>
      </MiraImpulseProvider>
    );
  }

  return (
    <MiraImpulseProvider>
      <MiraFieldContext.Provider value={setConfig}>
        {active && (
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            aria-hidden
            style={{ backgroundColor: "#0c0806" }}
          >
            <div className="absolute inset-0" style={{ background: DUSK }} />
            <div className="absolute inset-0">
              <MiraOrb
                fill
                size={480}
                fieldTier={config?.fieldTier ?? "hero"}
                presence={config?.presence ?? STEADY_PRESENCE}
                activity={config?.activity}
                aestheticVector={config?.aestheticVector}
              />
            </div>
            <div className="absolute inset-0" style={{ background: SCRIM }} />
            <div
              className="absolute inset-0 transition-opacity duration-700"
              style={{
                background: "#0c0806",
                opacity: config?.veil ?? 0,
              }}
            />
          </div>
        )}
        {children}
      </MiraFieldContext.Provider>
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
  fieldTier,
  freeRoam,
  scrollProgress,
  scrollVelocity,
  activeTarget,
}: FieldConfig) {
  const setConfig = useContext(MiraFieldContext);

  useEffect(() => {
    setConfig({ 
      presence, 
      activity, 
      aestheticVector, 
      veil, 
      fieldTier, 
      freeRoam,
      scrollProgress,
      scrollVelocity,
      activeTarget,
    });
  }, [setConfig, presence, activity, aestheticVector, veil, fieldTier, freeRoam, scrollProgress, scrollVelocity, activeTarget]);

  useEffect(() => () => setConfig(null), [setConfig]);
}
