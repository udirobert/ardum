"use client";

import RetreatExplorationView from "@/components/RetreatExplorationView";
import { SEED_WIDER_APERTURE_STORES } from "@/evidence/seed-wider-aperture";

/**
 * Inventory-led demo sandbox.
 *
 * Uses the same hook and view as the live `/episode/[id]` flow — no
 * duplicate keyword logic, no direct-mode props. Seed wider-aperture
 * stores exercise tier B/C disclosure rows when gates pass.
 */
export default function InventoryLedDemo() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 pointer-events-none">
        <p className="text-xs font-mono uppercase tracking-widest opacity-60">
          Ardum · Inventory-led demo
        </p>
      </div>
      <RetreatExplorationView
        initialConstraints={{ energy: "low", social: "solo" }}
        widerApertureStores={SEED_WIDER_APERTURE_STORES}
        uncertainties={["Final group size for October dates"]}
      />
    </main>
  );
}
