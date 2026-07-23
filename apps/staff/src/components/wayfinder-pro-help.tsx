"use client";

import {
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isHrRole,
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
        title: "Sidebar Layout",
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
        title: "Super Admin Portal",
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
        title: "Reporting vs Exports vs Analytics",
        body: "Three different tools — use the one that matches the task.",
        steps: [
          "Reporting (sidebar): Joshua Tree Reports — official PDF submissions to Google Drive.",
          "Analytics (sidebar): live charts including outcome benchmarking for leadership.",
          "Portal activity logs: administrative audit trails, not client monthly reports.",
          "Time Clock (Tools): staff hours worked for payroll/accountability — separate from billable timesheets. Admins can edit any clock entry; every edit is logged.",
        ],
      },
    ];
  }

  if (isAdminTierRole(role)) {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Daily configuration lives in the Admin portal. Oversight pages show team capacity, compliance gaps, and analytics. Notifications alert you to message SLA issues and employment milestones.",
        steps: [
          "Portal → Admin portal for offices, services, and team members.",
          "Oversight → Team operations, Compliance, Analytics.",
          "Tools → Time Clock, Reporting, Community Partners.",
        ],
      },
      {
        title: "Time Clock",
        body:
          "Joshua Tree team members use Time Clock for hours worked (Eastern time). Client billable hours stay on Weekly Timesheet. Admins can edit any entry for troubleshooting; edits are logged. Counselors and clients do not use Time Clock.",
        steps: [
          "Open Time Clock to view who’s clocked in org-wide and correct flagged auto-outs.",
          "5:30 PM still-working prompts and 6:00 PM auto-outs (stamped 5:30) are server-driven; midnight splits days at 11:59 PM / 12:00 AM.",
        ],
      },
      {
        title: "Team Operations and Compliance",
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
        title: "Sidebar Layout",
        body:
          "Daily work is at the top (portal, messages, time clock, timesheet). Oversight covers your team’s coaching queue and compliance. Check Notifications for SLA alerts and client milestones.",
        steps: [
          "Daily work → Supervisor portal, Messages, Time Clock, Timesheet.",
          "Oversight → Team operations, Compliance, Reporting, Analytics.",
          "Tools → Data exports, Community Partners.",
        ],
      },
      {
        title: "Time Clock (Hours Worked)",
        body:
          "Time Clock tracks when Joshua Tree team members are working for payroll and accountability. It is separate from Weekly Timesheet client billable hours. All clock times use America/New_York.",
        steps: [
          "Open Time Clock (or use the strip at the top of most pages) to clock yourself in/out.",
          "You can stay clocked in across lunch — work-at-your-own-pace is OK.",
          "You cannot clock in twice while already clocked in; you’ll see “You’re already clocked in.”",
          "At 5:30 PM Eastern, anyone still clocked in gets a Still Working? push and in-app prompt. Tap Still Working if you are continuing. If there is no response by 6:00 PM, the system clocks them out stamped at 5:30 PM, flags the entry for the person and their supervisor, and asks them to edit if needed.",
          "At midnight Eastern, open shifts end at 11:59 PM and a new shift starts at 12:00 AM so each calendar day has clean totals.",
          "Who’s Clocked In and Flagged Team Entries appear on Time Clock for your supervised Employment Specialists. You (and admins) can edit their entries; every edit is logged.",
          "Enable push notifications so you receive 5:30 PM and auto-out alerts.",
        ],
      },
      {
        title: "Supervisor Portal and Coaching",
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
        title: "Sidebar Layout",
        body:
          "Clients is your home base. The sidebar groups daily work (clients, messages, time clock, timesheet, reporting) and resources (partners, analytics, exports). Notifications surface message SLA and employment celebrations.",
        steps: [
          "Daily work → Clients, Messages, Time Clock, Timesheet, Reporting.",
          "Resources → Community Partners, Analytics, Data exports.",
        ],
      },
      {
        title: "Time Clock (Hours Worked)",
        body:
          "Use Time Clock to record when you are working. This is for payroll / accountability and is completely separate from client billable service time on Weekly Timesheet. Times are America/New_York.",
        steps: [
          "Clock In when you start work (any time of day). Clock Out when you stop. Multiple clock-ins in one day are allowed — the day total shows how long you worked.",
          "You may stay clocked in across lunch. If you try to Clock In while already in, you’ll see “You’re already clocked in.”",
          "Minimum shift length is 1 minute (every unpaid minute counts for records; team members are salaried).",
          "At 5:30 PM Eastern you’ll get a Still Working? notification if you are still clocked in. Tap Still Working if you are continuing, or Clock Out. No reply by 6:00 PM → auto clock-out stamped at 5:30 PM, flagged for you and your supervisor — open Time Clock → Needs Your Attention and edit if the stamp is wrong.",
          "If you are still working past midnight, the system ends the day at 11:59 PM and starts a new shift at 12:00 AM so each day has a clean total.",
          "If you were offline during an auto-out, you’ll see the flagged entry when you return online — edit it then.",
          "You can edit your own entries; supervisors and admins can help if you need a correction. Every edit is logged.",
          "Turn on push notifications (account / prompt) so evening prompts reach you.",
          "Demo client walkthroughs do not require Time Clock.",
        ],
      },
      {
        title: "Working with Your Clients",
        body:
          "The Clients page sorts people who need follow-up to the top and shows attention badges. The application pipeline lets you click a card to change its status (including Offer).",
        steps: [
          "Log every contact and job application on the client profile — counselors see your contact notes.",
          "When logging service time, enter duration plus a start time, end time, or both. If start and end disagree with duration, clock times win.",
          "You may log the same clock time on more than one client when the work applies to each (for example multi-client job canvass). Billable hours are summed per client; that is not the same as Time Clock hours worked.",
          "Use suggested chips when logging contacts to speed up common entries.",
          "Use Messages to reply to clients. Aim to respond within 48 business hours.",
          "Set job start date on the profile when a client is hired — this triggers milestone notifications for the team and counselors.",
          "Reporting in the sidebar opens Joshua Tree Reports with the client name filled in.",
        ],
      },
      {
        title: "Timesheet: Billable vs Time Clock",
        body:
          "Weekly Timesheet is for client billable service activities (state billing). Time Clock is for when you yourself were working. Do not confuse the two.",
        steps: [
          "Open Weekly Timesheet to review billable entries, download CSV, and submit for approval.",
          "Open Time Clock for your daily hours worked totals.",
          "Soft caseload guidance is about 20 active clients — supervisors/HR may allow more when needed.",
        ],
      },
    ];
  }

  if (role === "accountant") {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Accounts Specialist tools focus on timesheets and payment/billing exports. Community Partners is shared reference data.",
        steps: [
          "Weekly Timesheet → review weeks and Data exports.",
          "Reference → Community Partners.",
        ],
      },
      {
        title: "Payroll vs Billable Exports",
        body:
          "Hours worked (payroll) come from staff Time Clock shifts. Billable by client is for state billing and may differ from hours worked.",
        steps: [
          "Data exports → Payroll — hours worked from Time Clock for the pay period.",
          "Data exports → Billable hours by client for state billing files.",
          "Pay-period settings are configured by super admin under Portal → Settings → Payroll.",
        ],
      },
    ];
  }

  if (isHrRole(role)) {
    return [
      {
        title: "HR Workspace",
        body:
          "HR focuses on people and performance: timesheets, aggregated analytics, and exports for hours worked and billable oversight. Client-named analytics dumps are not available.",
        steps: [
          "HR Dashboard for people tools.",
          "Weekly Timesheet to view any ES week.",
          "Analytics for org-wide performance (hires, contacts/week, billable vs worked, time to hire by office/ES/supervisor/counselor).",
          "Data exports → hours worked (payroll from Time Clock) and billable-by-client CSVs.",
        ],
      },
      {
        title: "Caseload Guidance",
        body:
          "Policy guidance is about 20 active clients per ES. It is not a hard system limit — supervisors and HR manage overages organically.",
        steps: ["Operations capacity view highlights caseloads above soft guidance."],
      },
    ];
  }

  if (isCounselorRole(role)) {
    return [
      {
        title: "My Clients and Notifications",
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
        title: "Quick Start Guide",
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
          <h2 className="text-base font-semibold text-brand-black">When Something Goes Wrong</h2>
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
          <h2 className="text-base font-semibold text-brand-black">Training Manuals & Conference</h2>
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
