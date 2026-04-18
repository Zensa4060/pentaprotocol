import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "PentaProtocol",
  description: "5x5 Ranked Strategy Game",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/Pentaprotocol_Logo_Transparent.png" },
      { url: "/Pentaprotocol_Logo_Transparent.png", sizes: "192x192", type: "image/png" },
      { url: "/Pentaprotocol_Logo_Transparent.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/Pentaprotocol_Logo_Transparent.png",
    apple: "/Pentaprotocol_Logo_Transparent.png",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Japanese-style sumi-e / ink-brush fonts for the match-found "VS" and
            similar display moments. `Yuji Boku` is a bold calligraphy brush
            face; `Yuji Mai` and `Shippori Mincho B1` are stylish serif/brush
            fallbacks. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Yuji+Boku&family=Yuji+Mai&family=Shippori+Mincho+B1:wght@800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
        <CookieConsentBanner />
      </body>
    </html>
  );
}