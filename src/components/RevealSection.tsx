"use client";

import type { ReactNode } from "react";
import Reveal from "./Reveal";

// Thin wrapper for server-component pages that need scroll-triggered
// reveals. Imported by server component pages and used as a pass-through.

export default function RevealSection({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return <Reveal delay={delay}>{children}</Reveal>;
}
