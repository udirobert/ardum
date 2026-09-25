"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isEditorialRoute, isFieldRoute } from "@/lib/field-routes";
import type { ReactNode } from "react";

export function SiteHeader() {
  const pathname = usePathname();
  const editorial = isEditorialRoute(pathname);
  const overField = isFieldRoute(pathname);
  return (
    <header
      className={
        editorial
          ? "relative z-10 px-6 sm:px-10 lg:px-12 pt-6 pb-2 flex items-baseline justify-between bg-[color:var(--paper)] border-b border-[color:var(--rule)]"
          : overField
            ? "relative z-10 px-6 sm:px-10 pt-6 pb-2 flex items-baseline justify-between bg-transparent"
            : "relative z-10 px-6 sm:px-10 pt-6 pb-2 flex items-baseline justify-between bg-[color:var(--background)]"
      }
      style={{ viewTransitionName: "site-header" } as React.CSSProperties}
    >
      <Link
        href="/"
        className="font-serif text-2xl tracking-tight"
        style={
          editorial
            ? { color: "#1a1714" }
            : overField
              ? { color: "#f6efe3", textShadow: "0 1px 12px rgba(9,5,3,0.55)" }
              : { color: "var(--foreground)" }
        }
      >
        Ardum
      </Link>
      <span
        className={editorial ? "hidden sm:inline text-sm" : overField ? "hidden sm:inline text-sm" : "tag hidden sm:inline"}
        style={
          editorial
            ? { color: "rgba(26,23,20,0.42)", fontFamily: "var(--font-geist-sans)", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase" }
            : overField
              ? { color: "rgba(246,239,227,0.62)" }
              : undefined
        }
      >
        the shape of your practice
      </span>
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  const editorial = isEditorialRoute(pathname);
  const overField = isFieldRoute(pathname);
  return (
    <footer
      className={
        editorial
          ? "relative z-10 px-6 sm:px-10 lg:px-12 py-6 flex flex-wrap items-baseline justify-between gap-4 border-t border-[color:var(--rule)] bg-[color:var(--paper)] mt-12"
          : overField
            ? "relative z-10 px-6 sm:px-10 py-6 flex flex-wrap items-baseline justify-between gap-4 border-t border-[rgba(246,239,227,0.14)] bg-transparent mt-12"
            : "relative z-10 px-6 sm:px-10 py-6 rule border-t mt-12 bg-[color:var(--background)] flex flex-wrap items-baseline justify-between gap-4"
      }
    >
      <p
        className="font-serif text-lg tracking-tight"
        style={editorial ? { color: "#1a1714" } : overField ? { color: "#f6efe3" } : undefined}
      >
        Ardum
      </p>
      <nav className="flex gap-5 text-sm">
        <Link
          href="/memory"
          className={
            editorial || overField
              ? "transition-colors hover:opacity-100"
              : "text-[color:var(--muted)] hover:text-foreground transition-colors"
          }
          style={editorial ? { color: "rgba(26,23,20,0.58)" } : overField ? { color: "rgba(246,239,227,0.62)" } : undefined}
        >
          your intention &amp; privacy
        </Link>
        <Link
          href="/proof"
          className={
            editorial || overField
              ? "transition-colors hover:opacity-100"
              : "text-[color:var(--muted)] hover:text-foreground transition-colors"
          }
          style={editorial ? { color: "rgba(26,23,20,0.58)" } : overField ? { color: "rgba(246,239,227,0.62)" } : undefined}
        >
          how this is secured
        </Link>
        <Link
          href="/operator"
          className={
            editorial || overField
              ? "transition-colors hover:opacity-100"
              : "text-[color:var(--muted)] hover:text-foreground transition-colors"
          }
          style={editorial ? { color: "rgba(26,23,20,0.58)" } : overField ? { color: "rgba(246,239,227,0.62)" } : undefined}
        >
          operators
        </Link>
      </nav>
    </footer>
  );
}

export function ShellMain({ children }: { children: ReactNode }) {
  // Main stays relative z-10 so it floats above the fixed field.
  return <main className="relative z-10 flex-1">{children}</main>;
}
