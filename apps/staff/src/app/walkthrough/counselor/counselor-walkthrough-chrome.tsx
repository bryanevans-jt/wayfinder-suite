"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBanner } from "../components/demo-banner";

const NAV = [
  { href: "/walkthrough/counselor", label: "My clients" },
  { href: "/walkthrough/counselor/quick-start", label: "Quick Start" },
] as const;

export function CounselorWalkthroughChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isLogin = pathname.endsWith("/login") || pathname.includes("/login/");

  if (isLogin) {
    return (
      <div className="min-h-screen bg-brand-white">
        <DemoBanner />
        {children}
      </div>
    );
  }

  const clientDemoUrl =
    (process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "http://localhost:3001").replace(/\/$/, "") +
    "/walkthrough";

  return (
    <div className="min-h-screen bg-brand-white">
      <DemoBanner />
      <div className="border-b border-neutral-200 bg-neutral-50/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3 text-sm">
          <span className="font-semibold text-brand-green">Counselor portal · sample</span>
          <nav aria-label="Counselor demo" className="flex flex-wrap gap-3">
            {NAV.map((item) => {
              const active =
                item.href === "/walkthrough/counselor"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="font-medium text-brand-black/80 hover:text-brand-green"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <a
            href={clientDemoUrl}
            className="ml-auto font-medium text-brand-green hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View client demo →
          </a>
        </div>
      </div>
      {children}
    </div>
  );
}
