import type { Metadata } from "next";
import Link from "next/link";
// Loads @types/react canary declarations (ViewTransition) project-wide.
import type {} from "react/canary";
import { ViewTransition } from "react";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Instrument Serif — a single, expressive serif used for headings. It carries
// the contemplative register the rest of the type sits under.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ardum.vercel.app"),
  title: "Ardum — the shape of your practice",
  description:
    "A persistent guide that carries an intention from uncertainty to " +
    "a confident next step.",
  openGraph: {
    title: "Ardum — the shape of your practice",
    description:
      "A persistent guide that carries an intention from uncertainty to a confident next step.",
    siteName: "Ardum",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ardum — the shape of your practice",
    description:
      "A persistent guide that carries an intention from uncertainty to a confident next step.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header
          className="px-6 sm:px-10 pt-6 pb-2 flex items-baseline justify-between"
          style={{ viewTransitionName: "site-header" }}
        >
          <Link
            href="/"
            className="font-serif text-2xl tracking-tight text-foreground"
          >
            Ardum
          </Link>
          <span className="tag hidden sm:inline">
            the shape of your practice
          </span>
        </header>
        <main className="flex-1">
          <SmoothScroll>
            <ViewTransition enter="page-in" exit="page-out">
              {children}
            </ViewTransition>
          </SmoothScroll>
        </main>
        <footer className="px-6 sm:px-10 py-6 rule border-t mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-serif text-lg tracking-tight">
                Ardum is <span className="italic">mudra</span> reversed.
              </p>
              <p className="text-sm text-[color:var(--muted)] mt-1 max-w-md leading-relaxed">
                A mudra seals your practice. Ardum helps give an intention
                shape, then carries it quietly toward action.
              </p>
            </div>
            <nav className="flex gap-5 text-sm">
              <Link
                href="/memory"
                className="text-[color:var(--muted)] hover:text-foreground transition-colors"
              >
                your intention &amp; privacy
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
