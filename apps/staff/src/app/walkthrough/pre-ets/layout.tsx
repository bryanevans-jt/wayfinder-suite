import { DemoBanner } from "../components/demo-banner";
import Link from "next/link";

export default function PreEtsWalkthroughLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-white">
      <DemoBanner />
      <div className="border-b border-neutral-200 bg-neutral-50/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3 text-sm">
          <span className="font-semibold text-brand-green">Pre-ETS · field delivery sample</span>
          <nav aria-label="Pre-ETS training demo" className="flex flex-wrap gap-3">
            <Link
              href="/walkthrough/pre-ets/field-delivery"
              className="font-medium text-brand-black/80 hover:text-brand-green"
            >
              TS / TI roster &amp; CAR walkthrough
            </Link>
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
