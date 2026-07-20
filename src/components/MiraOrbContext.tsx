/**
 * MiraOrbContext - Shares orb position for coexistence effects
 * 
 * Allows cards and other components to react to the orb's proximity.
 * Used for lens distortion, reactive lighting, and border brightening.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface OrbPosition {
  x: number;
  y: number;
}

interface MiraOrbContextType {
  orbPosition: OrbPosition | null;
}

const MiraOrbContext = createContext<MiraOrbContextType>({ orbPosition: null });

export function useMiraOrbPosition() {
  return useContext(MiraOrbContext);
}

export function MiraOrbProvider({ children }: { children: ReactNode }) {
  const [orbPosition, setOrbPosition] = useState<OrbPosition | null>(null);

  useEffect(() => {
    const orb = document.querySelector('[data-mira-orb]');
    if (!orb) return;

    const updatePosition = () => {
      const rect = orb.getBoundingClientRect();
      setOrbPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    };

    // Use MutationObserver to track orb position changes
    const observer = new MutationObserver(updatePosition);
    observer.observe(orb, { attributes: true, attributeFilter: ['style'] });
    
    // Initial position
    updatePosition();

    // Also update on scroll/resize for smooth tracking
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, []);

  return (
    <MiraOrbContext.Provider value={{ orbPosition }}>
      {children}
    </MiraOrbContext.Provider>
  );
}
