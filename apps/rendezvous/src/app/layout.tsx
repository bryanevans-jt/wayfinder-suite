import type { Metadata } from "next";
import { Source_Sans_3, Fraunces } from "next/font/google";
import "./globals.css";
import { WAYFINDER_FAVICON_PATH } from "@wayfinder/branding";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-rv-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-rv-display",
});

export const metadata: Metadata = {
  title: "Rendezvous",
  description: "Schedule meetings with Joshua Tree Service Group specialists",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: WAYFINDER_FAVICON_PATH, type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-[family-name:var(--font-rv-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
