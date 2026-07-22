"use client";

import { useMemo, useState } from "react";
import RetreatExplorationView from "@/components/RetreatExplorationView";
import { buildRecommendation } from "@/agent/retreat-response";
import { extractConstraints } from "@/agent/conversation-extractor";
import { mergeConstraints } from "@/agent/constraint-updater";
import { SEED_WIDER_APERTURE_STORES } from "@/evidence/seed-wider-aperture";

/**
 * Inventory-led demo sandbox.
 *
 * Uses the presentation-only RetreatExplorationView with locally built
 * recommendation data — domain transitions stay explicit in the demo layer.
 */
export default function InventoryLedDemo() {
  const [recommendation, setRecommendation] = useState(() =>
    buildRecommendation({ energy: "low", social: "solo" }),
  );
  const constraints = useMemo(
    () => ({ energy: "low" as const, social: "solo" as const }),
    [],
  );

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 pointer-events-none">
        <p className="text-xs font-mono uppercase tracking-widest opacity-60">
          Ardum · Inventory-led demo
        </p>
      </div>
      <RetreatExplorationView
        recommendation={recommendation}
        constraints={constraints}
        widerApertureStores={SEED_WIDER_APERTURE_STORES}
        uncertainties={["Final group size for October dates"]}
        onHold={() => {
          window.alert("Demo: hold would call create-hold on the episode.");
        }}
        onVoiceMessage={async (text) => {
          const extracted = extractConstraints(text);
          const merged = mergeConstraints(constraints, extracted);
          const next = buildRecommendation(merged, extracted);
          setRecommendation(next);
        }}
        onElevate={(retreatId) => {
          const alt = recommendation?.alternatives.find(
            (item) => item.retreat.id === retreatId,
          );
          if (!alt || !recommendation) return;
          setRecommendation({
            retreat: alt.retreat,
            letter: alt.reason,
            alternatives: recommendation.alternatives.filter(
              (item) => item.retreat.id !== retreatId,
            ),
          });
        }}
        onReject={(retreatId) => {
          if (!recommendation) return;
          setRecommendation({
            ...recommendation,
            alternatives: recommendation.alternatives.filter(
              (item) => item.retreat.id !== retreatId,
            ),
          });
        }}
      />
    </main>
  );
}
