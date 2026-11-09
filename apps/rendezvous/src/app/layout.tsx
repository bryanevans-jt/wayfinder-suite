import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";
import { WAYFINDER_FAVICON_PATH } from "@wayfinder/branding";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-rv-sans",
});

const display = Syne({
  subsets: ["latin"],
  variable: "--font-rv-display",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Rendezvous",
  description: "Schedule Meetings With Joshua Tree Service Group Specialists",
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
