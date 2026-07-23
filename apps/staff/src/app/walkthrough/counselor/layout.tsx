import Link from "next/link";
import { DemoBanner } from "../components/demo-banner";

const NAV = [
  { href: "/walkthrough/counselor", label: "My clients" },
  { href: "/walkthrough/counselor/quick-start", label: "Quick Start" },
] as const;

export default function CounselorWalkthroughLayout({ children }: { children: React.ReactNode }) {
  const clientDemoUrl =
    (process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "http://localhost:3001").replace(/\/$/, "") +
    "/walkthrough";

  return (
    <div className="min-h-screen bg-brand-white">
      <DemoBanner />
      <div className="border-b border-neutral-200 bg-neutral-50/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3 text-sm">
          <span className="font-semibold text-brand-green">Counselor portal · sample</span>
          <nav className="flex flex-wrap gap-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-medium text-brand-black/80 hover:text-brand-green"
              >
                {item.label}
              </Link>
            ))}
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
