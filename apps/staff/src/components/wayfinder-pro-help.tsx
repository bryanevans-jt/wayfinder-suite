"use client";

import {
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";

type Section = {
  title: string;
  body: string;
  steps?: string[];
};

function sectionsForRole(role: string | null): Section[] {
  if (isSuperAdminRole(role)) {
    return [
      {
        title: "Super admin portal",
        body:
          "The portal is your control center for organization setup, staff roles, integrations, and system health. Sidebar links are for day-to-day work; portal tabs hold configuration.",
        steps: [
          "Portal → Organization for offices, services, and branding.",
          "Portal → Staff for roles, assignments, and invitations.",
          "Portal → Settings → Error log for WF reference codes and stack traces.",
          "Sidebar Reporting opens Joshua Tree Reports; Data exports downloads CSV files from Wayfinder Pro.",
          "Portal → Reports → Activity logs for org-wide audit CSV exports (not the same as sidebar Data exports).",
        ],
      },
      {
        title: "Reporting vs exports vs analytics",
        body: "Three different tools — use the one that matches the task.",
        steps: [
          "Reporting (sidebar): Joshua Tree Reports — official PDF submissions to Google Drive.",
          "Data exports (sidebar): CSV downloads from Wayfinder Pro for spreadsheets.",
          "Analytics (sidebar): live charts for leadership and grant metrics.",
          "Portal activity logs: administrative audit trails, not client monthly reports.",
        ],
      },
    ];
  }

  if (isAdminTierRole(role)) {
    return [
      {
        title: "Your admin portal",
        body: "Use the Admin portal tab for organization settings and staff management. Use the sidebar for everyday work with clients and reports.",
        steps: [
          "Open Admin portal from the sidebar when you need to add offices, services, or staff.",
          "Use Clients (Employment Specialists only) for caseload work — admins typically oversee through Analytics and exports.",
          "Reporting in the sidebar opens Joshua Tree Reports for official monthly paperwork.",
          "Data exports downloads spreadsheet files when you need numbers outside the app.",
          "Analytics shows organization-wide progress at a glance.",
        ],
      },
    ];
  }

  if (isSupervisorRole(role)) {
    return [
      {
        title: "Supervisor portal and daily work",
        body: "Your portal shows team overview. The sidebar is where you review messages, timesheets, and exports.",
        steps: [
          "Supervisor portal: see your Employment Specialists and high-level caseload signals.",
          "Messages: read-only view of client threads. You will get an alert if a specialist has not replied within 48 business hours.",
          "Timesheet: review and approve time entries from your team.",
          "Reporting: open Joshua Tree Reports to submit or review official monthly reports.",
          "Data exports: download CSV files when you need spreadsheets for supervision meetings.",
        ],
      },
    ];
  }

  if (isEsRole(role)) {
    return [
      {
        title: "Working with your clients",
        body: "Clients in the sidebar is your home base. Open a client to log contacts, applications, meetings, and time.",
        steps: [
          "Log every contact and job application on the client profile — counselors see your contact notes.",
          "Use Messages to reply to clients. Aim to respond within 48 business hours.",
          "Timesheet: review billable time captured from contacts, applications, and manual entries.",
          "On each client profile, Monthly activity report builds text you can copy into official reports.",
          "Reporting in the sidebar opens Joshua Tree Reports with the client name filled in — you can change any field before signing.",
        ],
      },
    ];
  }

  if (role === "accountant") {
    return [
      {
        title: "Timesheet and exports",
        body: "Your account focuses on time tracking and downloading data — you do not manage client caseloads here.",
        steps: [
          "Timesheet is your home page — review and work with time entries as assigned.",
          "Data exports downloads spreadsheet files when you need them for payroll or records.",
          "Community Partners lists employer contacts shared across the team.",
        ],
      },
    ];
  }

  if (isCounselorRole(role)) {
    return [
      {
        title: "My clients",
        body: "You can see activity for clients assigned to you. You cannot edit their records or send messages through Wayfinder Pro.",
        steps: [
          "Open My clients to see recent updates — contacts, applications, and milestones.",
          "You will receive a weekly summary notification when there is new activity.",
          "If something looks wrong, contact the client’s Employment Specialist or your program supervisor.",
        ],
      },
    ];
  }

  return [
    {
      title: "Wayfinder Pro",
      body: "Use the sidebar menu to move between your assigned areas. If you are unsure where to go, ask your supervisor.",
    },
  ];
}

type Props = {
  role: string | null;
};

export function WayfinderProHelp({ role }: Props) {
  const sections = sectionsForRole(role);

  return (
    <div className="mt-8 max-w-3xl space-y-6">
      <p className="text-sm text-brand-black/80">
        This guide is written for your role. Product names like <strong>Wayfinder Pro</strong> and{" "}
        <strong>Joshua Tree Reports</strong> are capitalized on purpose so you can match them to menu
        labels.
      </p>

      {sections.map((section) => (
        <section
          key={section.title}
          className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-brand-black">{section.title}</h2>
          <p className="mt-2 text-sm text-brand-black/80">{section.body}</p>
          {section.steps?.length ? (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-brand-black/85">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </section>
      ))}

      {!isSuperAdminRole(role) ? (
        <section className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-5">
          <h2 className="text-base font-semibold text-brand-black">When something goes wrong</h2>
          <p className="mt-2 text-sm text-brand-black/80">
            If you see an error, note the <strong>WF-</strong> reference code on the screen and email{" "}
            <strong>Bryan Evans</strong> at{" "}
            <a href="mailto:bryan.evans@thejoshuatree.org" className="text-brand-green hover:underline">
              bryan.evans@thejoshuatree.org
            </a>
            . Include what you were doing when it happened.
          </p>
        </section>
      ) : null}
    </div>
  );
}
