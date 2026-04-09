import type { Metadata } from "next";
import "./globals.css";
import CookieConsentBanner from "@/components/CookieConsentBanner";

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
      </head>
      <body>
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}