import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileCtaBar } from "@/components/mobile-cta-bar";

// Switzer (display + body) is loaded via globals.css @import (Fontshare).
// IBM Plex Mono powers the technical eyebrows / labels.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kairo Labs — Research peptides supplied for laboratory use.",
  description:
    "Kairo Labs supplies research-grade peptides to qualified researchers and laboratories — independently lab-tested to ≥99% purity, each with a certificate of analysis verifiable by lot number. Same-day US shipping in plain, tracked packaging. For research use only; not for human or animal consumption.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${mono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap"
        />
      </head>
      <body className="min-h-full">
        <CartProvider>
          <div className="page-wash">
            <AnnouncementBar />
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
          <MobileCtaBar />
        </CartProvider>
      </body>
    </html>
  );
}
