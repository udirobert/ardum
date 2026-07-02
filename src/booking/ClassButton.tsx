"use client";

// "Drop-in class" button — renders on the match detail page.
// When clicked, opens the x402 class payment flow.

import { useState } from "react";
import ClassPayment from "./ClassPayment";

type ClassButtonProps = {
  retreatRootHash: string;
  retreatTitle: string;
  classPriceUsd: number;
};

export default function ClassButton({
  retreatRootHash,
  retreatTitle,
  classPriceUsd,
}: ClassButtonProps) {
  const [paying, setPaying] = useState(false);

  if (paying) {
    return (
      <ClassPayment
        retreatRootHash={retreatRootHash}
        retreatTitle={retreatTitle}
        classPriceUsd={classPriceUsd}
        onClose={() => setPaying(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPaying(true)}
      className="px-5 py-3 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] text-[color:var(--muted)] hover:text-foreground transition-colors"
    >
      Drop-in class (${classPriceUsd}) →
    </button>
  );
}
