import {
  STAFF_APP_PRODUCT_NAME,
  WAYFINDER_FAVICON_PATH,
  WayfinderFooter,
  WayfinderTopNav,
} from "@wayfinder/branding";
import { createServerClient } from "@wayfinder/supabase";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { staffHomeHref, staffNavBadge } from "@/lib/staff-nav";
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
  title: STAFF_APP_PRODUCT_NAME,
  description: "Joshua Tree Wayfinder Pro — staff workspace for employment specialists and administrators",
  robots: { index: false, follow: false },
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
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let staffRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    staffRole = profile?.role ?? null;
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-brand-white font-sans text-brand-black`}
      >
        <WayfinderTopNav
          badgeLabel={staffNavBadge(staffRole)}
          homeHref={staffHomeHref(staffRole)}
          homeAriaLabel={`${STAFF_APP_PRODUCT_NAME} home`}
        />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <WayfinderFooter productName={STAFF_APP_PRODUCT_NAME} />
      </body>
    </html>
  );
}
