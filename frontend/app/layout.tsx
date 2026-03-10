import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PentaProtocol",
  description: "5x5 Ranked Strategy Game",
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