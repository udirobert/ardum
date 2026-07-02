"use client";

// Wraps the booking layer providers so the match detail page can use
// BookButton without wrapping the entire app. MagicAuthProvider must be
// outside UniversalAccountProvider since UA depends on the Magic EOA.

import type { ReactNode } from "react";
import { MagicAuthProvider } from "./MagicAuth";
import { UniversalAccountProvider } from "./UniversalAccount";

export default function BookingProviders({ children }: { children: ReactNode }) {
  return (
    <MagicAuthProvider>
      <UniversalAccountProvider>{children}</UniversalAccountProvider>
    </MagicAuthProvider>
  );
}
