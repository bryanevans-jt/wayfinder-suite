import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

type Props = {
  children: React.ReactNode;
  /** Compact top bar for authenticated staff pages. */
  showStaffNav?: boolean;
  signOutSlot?: React.ReactNode;
};

export function AppShell({ children, showStaffNav = false, signOutSlot }: Props) {
  return (
    <div className="rv-atmosphere flex min-h-screen flex-col">
      {showStaffNav ? (
        <header className="relative z-10 border-b border-[color:var(--rv-line)] bg-white/40 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="rv-brand text-2xl sm:text-3xl">
              Rendezvous
            </Link>
            <nav className="flex items-center gap-4 sm:gap-5">
              <Link href="/calendar" className="rv-nav-link">
                Team Calendar
              </Link>
              <Link href="/admin" className="rv-nav-link">
                Admin Setup
              </Link>
              {signOutSlot}
            </nav>
          </div>
        </header>
      ) : null}
      <div className="relative z-10 flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
