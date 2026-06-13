import {
  CLIENT_APP_PRODUCT_NAME,
  WAYFINDER_FAVICON_PATH,
  WayfinderFooter,
  WayfinderTopNav,
} from "@wayfinder/branding";
import { PreviewBanner } from "@/components/preview-banner";
import { getAppSession, staffAppOrigin } from "@wayfinder/supabase/preview-server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: CLIENT_APP_PRODUCT_NAME,
  description: "Joshua Tree Wayfinder — your employment success path",
  icons: {
    icon: [{ url: WAYFINDER_FAVICON_PATH, type: "image/png" }],
    apple: [{ url: WAYFINDER_FAVICON_PATH, type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAppSession();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-brand-white font-sans text-brand-black`}
      >
        {session?.isPreviewing && session.preview ? (
          <PreviewBanner
            targetName={session.preview.targetName}
            targetRole={session.preview.effectiveRole}
            staffAppUrl={staffAppOrigin()}
          />
        ) : null}
        <WayfinderTopNav
          badgeLabel="Client"
          homeHref="/dashboard"
          homeAriaLabel={`${CLIENT_APP_PRODUCT_NAME} home`}
        />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <WayfinderFooter productName={CLIENT_APP_PRODUCT_NAME} />
      </body>
    </html>
  );
}
