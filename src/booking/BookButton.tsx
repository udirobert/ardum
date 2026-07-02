"use client";

// "Book this retreat" button — renders on the match detail page.
// When clicked, opens the booking flow modal inline.

import { useState } from "react";
import BookingFlow from "./BookingFlow";

type BookButtonProps = {
  retreatRootHash: string;
  retreatTitle: string;
  depositUsd: number;
  operatorAddress: string;
};

export default function BookButton({
  retreatRootHash,
  retreatTitle,
  depositUsd,
  operatorAddress,
}: BookButtonProps) {
  const [booking, setBooking] = useState(false);

  if (booking) {
    return (
      <BookingFlow
        retreatRootHash={retreatRootHash}
        retreatTitle={retreatTitle}
        depositUsd={depositUsd}
        operatorAddress={operatorAddress}
        onClose={() => setBooking(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setBooking(true)}
      className="px-6 py-3 rounded-sm bg-[color:var(--accent)] text-background hover:bg-[color:var(--accent-ink)] transition-colors"
    >
      Book this retreat →
    </button>
  );
}
