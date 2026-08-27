import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "opengorky",
  description: "A free, local-first interactive canvas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
