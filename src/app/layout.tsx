import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
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
  title: "Ardum — the shape of your practice",
  description:
    "Agentic yoga retreat matching built on verified attestations. In-browser " +
    "pose calibration. Reasoning visible at every step.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="px-6 sm:px-10 pt-6 pb-2 flex items-baseline justify-between">
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
        <main className="flex-1">{children}</main>
        <footer className="px-6 sm:px-10 py-6 rule border-t mt-12">
          <p className="text-sm text-[color:var(--muted)]">
            Built on 0G Storage + 0G Compute · MediaPipe runs in your
            browser · wallet only for attestation writes
          </p>
        </footer>
      </body>
    </html>
  );
}
