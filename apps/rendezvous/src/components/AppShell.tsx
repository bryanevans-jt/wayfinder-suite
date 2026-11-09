import Image from "next/image";
import Link from "next/link";
import { WAYFINDER_LOGO_ALT, WAYFINDER_LOGO_PATH } from "@wayfinder/branding";

type Props = {
  children: React.ReactNode;
  /** Compact top bar for authenticated staff pages. */
  showStaffNav?: boolean;
  signOutSlot?: React.ReactNode;
};

export function AppShell({ children, showStaffNav = false, signOutSlot }: Props) {
  return (
    <div className="rv-atmosphere">
      {showStaffNav ? (
        <header className="relative z-10 border-b border-[color:var(--rv-line)] bg-white/40 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={WAYFINDER_LOGO_PATH}
                alt={WAYFINDER_LOGO_ALT}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
              <span className="rv-brand text-2xl sm:text-3xl">Rendezvous</span>
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
      {children}
    </div>
  );
}
