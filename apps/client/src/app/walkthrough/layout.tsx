import type { Metadata } from "next";
import { DemoBanner } from "./components/demo-banner";

export const metadata: Metadata = {
  title: "Walkthrough",
  robots: { index: false, follow: false },
};

export default function WalkthroughLayout({ children }: { children: React.ReactNode }) {
  const staffDemoUrl =
    (process.env.NEXT_PUBLIC_STAFF_APP_URL ?? "http://localhost:3000").replace(/\/$/, "") +
    "/walkthrough/counselor/login";

  return (
    <div className="min-h-screen bg-brand-white">
      <DemoBanner />
      <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-2 text-center text-sm">
        <a
          href={staffDemoUrl}
          className="font-medium text-brand-green hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View counselor demo (sign-in screen) →
        </a>
      </div>
      {children}
    </div>
  );
}
