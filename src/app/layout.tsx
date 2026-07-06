import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import PageTransition from "@/components/PageTransition";
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
    "Agentic yoga retreat matching built on verified attestations. In-browser " +
    "pose calibration. Reasoning visible at every step.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧘</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
  openGraph: {
    title: "Ardum — the shape of your practice",
    description:
      "Agentic yoga retreat matching built on verified attestations. " +
      "In-browser pose calibration. Reasoning visible at every step.",
    siteName: "Ardum",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ardum — the shape of your practice",
    description:
      "Agentic yoga retreat matching built on verified attestations. " +
      "In-browser pose calibration. Reasoning visible at every step.",
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
        <main className="flex-1">
          <SmoothScroll>
            <PageTransition>{children}</PageTransition>
          </SmoothScroll>
        </main>
        <footer className="px-6 sm:px-10 py-6 rule border-t mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-serif text-lg tracking-tight">
                Ardum is <span className="italic">mudra</span> reversed.
              </p>
              <p className="text-sm text-[color:var(--muted)] mt-1 max-w-md leading-relaxed">
                A mudra seals your practice. Ardum finds it — an agent that
                reads where you are and matches you to the retreat that meets
                you there.
              </p>
            </div>
            <nav className="flex gap-5 text-sm">
              <Link
                href="/retreats"
                className="text-[color:var(--muted)] hover:text-foreground transition-colors"
              >
                the pool
              </Link>
              <Link
                href="/attest"
                className="text-[color:var(--muted)] hover:text-foreground transition-colors"
              >
                attest
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
