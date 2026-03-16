import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}