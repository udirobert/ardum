"use client";

import { useState } from "react";
import RetreatExplorationView from "@/components/RetreatExplorationView";
import { MOCK_RETREATS, findRetreatById } from "@/inventory/mock-catalog";
import type { Retreat } from "@/inventory/retreat";

export default function InventoryLedDemo() {
  const [retreats, setRetreats] = useState<Retreat[]>(MOCK_RETREATS.slice(0, 3));
  const [miraNote, setMiraNote] = useState<string>(
    "Here are a few places that match the shape of what you described. Scroll through them, and tell me what feels closer.",
  );
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);

  const handleUserMessage = async (text: string) => {
    setBusy(true);

    try {
      // Demo-only extraction: simulate a quick re-ranking based on keywords.
      const lower = text.toLowerCase();
      let next = [...retreats];
      let note = miraNote;

      await new Promise((resolve) => setTimeout(resolve, 600));

      if (lower.includes("cheap") || lower.includes("less") || lower.includes("expensive")) {
      next = [...MOCK_RETREATS]
        .sort((a, b) => a.price.amount - b.price.amount)
        .slice(0, 3);
      note = "I re-ranked by price. These are the gentlest options first.";
    } else if (lower.includes("solo") || lower.includes("alone")) {
      next = MOCK_RETREATS.filter((r) => r.fit?.social === "solo").slice(0, 3);
      note = "These lean toward solitude.";
      if (next.length === 0) {
        next = MOCK_RETREATS.slice(0, 3);
        note = "None are strictly solo, but these are the quietest.";
      }
    } else if (lower.includes("short") || lower.includes("fewer days")) {
      next = MOCK_RETREATS.filter((r) => r.dates.duration <= 5).slice(0, 3);
      note = "These are shorter stays.";
    } else if (lower.includes("bali")) {
      next = MOCK_RETREATS.filter((r) => r.location.includes("Bali")).slice(0, 3);
      note = "Bali options first.";
    } else {
      // Shuffle slightly to suggest motion/exploration in the demo.
      next = [...MOCK_RETREATS]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      note = "I hear you. Here is another angle.";
    }

      setRetreats(next);
      setMiraNote(note);
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = (retreatId: string) => {
    const retreat = findRetreatById(retreatId);
    if (!retreat) return;
    setCommitted(retreat.title);
    setMiraNote(`I can place a non-binding hold on ${retreat.title} for 48 hours. This is just a demo — no real hold is made.`);
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4">
        <p className="text-xs font-mono uppercase tracking-widest opacity-60">
          Ardum · Inventory-led demo
        </p>
        {committed && (
          <p className="text-xs font-mono uppercase tracking-widest text-[color:var(--accent-soft)]">
            Demo hold placed on {committed}
          </p>
        )}
      </div>
      <RetreatExplorationView
        retreats={retreats}
        miraNote={miraNote}
        onUserMessage={handleUserMessage}
        onCommit={handleCommit}
        busy={busy}
      />
    </main>
  );
}
