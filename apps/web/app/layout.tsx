import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tibson analytics",
  description: "Tibbir analytics on Base",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
