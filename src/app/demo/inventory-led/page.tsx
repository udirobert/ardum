"use client";

import RetreatExplorationView from "@/components/RetreatExplorationView";

/**
 * Inventory-led demo sandbox.
 *
 * Uses the same hook and view as the live `/episode/[id]` flow — no
 * duplicate keyword logic, no direct-mode props. The demo exists for
 * faster UI iteration without waiting on the agent pipeline; it offers
 * nothing the live flow doesn't.
 */
export default function InventoryLedDemo() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 pointer-events-none">
        <p className="text-xs font-mono uppercase tracking-widest opacity-60">
          Ardum · Inventory-led demo
        </p>
      </div>
      <RetreatExplorationView />
    </main>
  );
}
