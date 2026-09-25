import type { Metadata } from "next";
// Loads @types/react canary declarations (ViewTransition) project-wide.
import type {} from "react/canary";
import { ViewTransition } from "react";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import { MiraFieldProvider } from "@/components/MiraField";
import { SiteHeader, SiteFooter, ShellMain } from "@/components/SiteChrome";
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
  metadataBase: new URL("https://ardum.famile.xyz"),
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
        <MiraFieldProvider>
          <SiteHeader />
          <ShellMain>
            <SmoothScroll>
              <ViewTransition enter="page-in" exit="page-out">
                {children}
              </ViewTransition>
            </SmoothScroll>
          </ShellMain>
          <SiteFooter />
        </MiraFieldProvider>
      </body>
    </html>
  );
}
