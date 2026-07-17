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
        title: "Sidebar layout",
        body:
          "The sidebar groups your work: Portal for configuration, Oversight for team health, Tools for reporting and partners. Notifications appear at the top when you have unread alerts.",
        steps: [
          "Portal → Super admin portal (and Audit when not previewing).",
          "Oversight → Team operations, Compliance, Analytics.",
          "Tools → Reporting (Joshua Tree Reports), Community Partners.",
          "Help → this guide.",
        ],
      },
      {
        title: "Super admin portal",
        body:
          "The portal is your control center for organization setup, team member roles, integrations, and system health.",
        steps: [
          "Portal → Organization for offices, services, and branding.",
          "Portal → Team for roles, assignments, and invitations.",
          "Portal → Settings → Error log for WF reference codes and stack traces.",
          "Portal → Settings → Payroll for pay-period configuration used by accountant exports.",
          "Portal → Reports → Activity logs for org-wide audit CSV exports (not the same as sidebar Data exports).",
        ],
      },
      {
        title: "Reporting vs exports vs analytics",
        body: "Three different tools — use the one that matches the task.",
        steps: [
          "Reporting (sidebar): Joshua Tree Reports — official PDF submissions to Google Drive.",
          "Analytics (sidebar): live charts including outcome benchmarking for leadership.",
          "Portal activity logs: administrative audit trails, not client monthly reports.",
        ],
      },
    ];
  }

  if (isAdminTierRole(role)) {
    return [
      {
        title: "Sidebar layout",
        body:
          "Daily configuration lives in the Admin portal. Oversight pages show team capacity, compliance gaps, and analytics. Notifications alert you to message SLA issues and employment milestones.",
        steps: [
          "Portal → Admin portal for offices, services, and team members.",
          "Oversight → Team operations, Compliance, Analytics.",
          "Tools → Reporting, Community Partners.",
        ],
      },
      {
        title: "Team operations and compliance",
        body: "Use these when supervising program delivery — you see organization-wide slices as an admin.",
        steps: [
          "Team operations: ES caseload capacity and billable-hour trends.",
          "Compliance: SE Monthly report gaps and timesheets awaiting approval.",
          "Analytics: organization-wide progress and outcome benchmarking.",
        ],
      },
    ];
  }

  if (isSupervisorRole(role)) {
    return [
      {
        title: "Sidebar layout",
        body:
          "Daily work is at the top (portal, messages, timesheet). Oversight covers your team’s coaching queue and compliance. Check Notifications for SLA alerts and client milestones.",
        steps: [
          "Daily work → Supervisor portal, Messages, Timesheet.",
          "Oversight → Team operations, Compliance, Reporting, Analytics.",
          "Tools → Data exports, Community Partners.",
        ],
      },
      {
        title: "Supervisor portal and coaching",
        body: "Your portal shows team overview. Team operations adds a coaching queue for overdue message replies and thin contact logs.",
        steps: [
          "Supervisor portal: see your Employment Specialists and high-level caseload signals.",
          "Team operations: capacity view plus coaching queue (SLA overdue and fewer than four contacts per month).",
          "Messages: read-only view of client threads.",
          "Compliance: your team’s SE Monthly gaps and pending timesheet approvals.",
          "Reporting: open Joshua Tree Reports to submit or review official monthly reports.",
        ],
      },
    ];
  }

  if (isEsRole(role)) {
    return [
      {
        title: "Sidebar layout",
        body:
          "Clients is your home base. The sidebar groups daily work (clients, messages, timesheet, reporting) and resources (partners, analytics, exports). Notifications surface message SLA and employment celebrations.",
        steps: [
          "Daily work → Clients, Messages, Timesheet, Reporting.",
          "Resources → Community Partners, Analytics, Data exports.",
        ],
      },
      {
        title: "Working with your clients",
        body:
          "The Clients page sorts people who need follow-up to the top and shows attention badges. The application pipeline lets you click a card to change its status (including Offer).",
        steps: [
          "Log every contact and job application on the client profile — counselors see your contact notes.",
          "Use suggested chips when logging contacts to speed up common entries.",
          "Use Messages to reply to clients. Aim to respond within 48 business hours.",
          "Set job start date on the profile when a client is hired — this triggers milestone notifications for the team and counselors.",
          "Reporting in the sidebar opens Joshua Tree Reports with the client name filled in.",
        ],
      },
    ];
  }

  if (role === "accountant") {
    return [
      {
        title: "Sidebar layout",
        body:
          "Weekly Timesheet tools are grouped at the top; Community Partners is reference data shared across the team.",
        steps: [
          "Weekly Timesheet → review weeks and Data exports.",
          "Reference → Community Partners.",
        ],
      },
      {
        title: "Weekly Timesheet and exports",
        body: "Your account focuses on approved time and payroll exports — you do not manage client caseloads here.",
        steps: [
          "Weekly Timesheet: review approved weeks as configured by super admin pay-period settings.",
          "Data exports: download payroll CSV when you need numbers outside the app.",
          "Community Partners lists employer contacts shared across the team.",
        ],
      },
    ];
  }

  if (isCounselorRole(role)) {
    return [
      {
        title: "My clients and notifications",
        body:
          "You can see activity for clients assigned to you. You cannot edit their records or send messages through Wayfinder Pro.",
        steps: [
          "Open My clients to see recent updates — contacts, applications, and milestones.",
          "Notifications (top of the sidebar): weekly activity summaries and employment celebrations (hire, 30/60/90 days). Tap an alert to open that client’s timeline.",
          "On mobile, open Menu to reach Notifications and My clients.",
          "If something looks wrong, contact the client’s Employment Specialist or your program supervisor.",
        ],
      },
      {
        title: "Quick start guide",
        body:
          "A one-page summary on the counselor portal. Sign in with your agency work email and the magic link on the login page.",
        steps: [
          "My clients → Quick start guide (top of the page).",
          "Or bookmark: wayfinder-pro.thejoshuatree.org/dashboard/counselor/quick-start (sign in required).",
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

      {!isCounselorRole(role) ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-brand-black">Training manuals & conference</h2>
          <p className="mt-2 text-sm text-brand-black/80">
            Full PDF manuals and GA training workbooks live in the team Google Drive folder (ask your
            supervisor or Bryan Evans). In-repo copies for IT:{" "}
            <code className="text-xs">docs/training/</code> in the Wayfinder suite repository.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-brand-black/85">
            {isEsRole(role) ? (
              <li>
                Share the client quick start:{" "}
                <a
                  href="https://wayfinder.thejoshuatree.org/quick-start"
                  className="text-brand-green hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  wayfinder.thejoshuatree.org/quick-start
                </a>
              </li>
            ) : null}
            {isEsRole(role) || isSupervisorRole(role) ? (
              <li>Employer outreach script — Community Partners folder in training materials</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
