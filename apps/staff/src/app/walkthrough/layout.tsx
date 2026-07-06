import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Walkthrough",
  robots: { index: false, follow: false },
};

export default function WalkthroughLayout({ children }: { children: React.ReactNode }) {
  return children;
}
