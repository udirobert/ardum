"use client";

// Provider wrapper for the operator flow — wraps OperatorAuthProvider.

import type { ReactNode } from "react";
import { OperatorAuthProvider } from "./OperatorAuth";

export default function OperatorProviders({ children }: { children: ReactNode }) {
  return <OperatorAuthProvider>{children}</OperatorAuthProvider>;
}
