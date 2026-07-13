"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const DURATION = 380;

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  if (reduced) return <>{children}</>;

  return (
    <div
      key={pathname}
      className="page-enter"
      style={{ animationDuration: `${DURATION}ms` }}
    >
      {children}
    </div>
  );
}
