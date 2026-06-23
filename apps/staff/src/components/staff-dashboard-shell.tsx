"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StaffSidebarPanel } from "./staff-sidebar";
import { PushNotificationPrompt } from "@wayfinder/auth-ui";
import { ReportAlertsBanner } from "./report-alerts-banner";

type Props = {
  staffRole: string | null;
  showAuditLink?: boolean;
  children: React.ReactNode;
};

export function StaffDashboardShell({ staffRole, showAuditLink = false, children }: Props) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <StaffSidebarPanel staffRole={staffRole} showAuditLink={showAuditLink} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-neutral-200 bg-white px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-black hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            aria-expanded={menuOpen}
            aria-controls="staff-mobile-nav"
          >
            <MenuIcon />
            Menu
          </button>
        </div>
        <div className="min-w-0 flex-1 bg-white">
          <PushNotificationPrompt className="mx-4 mt-3 lg:mx-6" />
          <ReportAlertsBanner staffRole={staffRole} />
          {children}
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="staff-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-neutral-200 bg-white shadow-xl"
            aria-label="Staff navigation"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <span className="text-sm font-semibold text-brand-black">Navigation</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-1.5 text-brand-black/70 hover:bg-neutral-100 hover:text-brand-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>
            <StaffSidebarPanel
              staffRole={staffRole}
              showAuditLink={showAuditLink}
              onNavigate={() => setMenuOpen(false)}
              className="flex-1 overflow-y-auto"
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="text-brand-green"
    >
      <path
        d="M3 5h14M3 10h14M3 15h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
