"use client";

import {
  isAdminTierRole,
  isCounselorRole,
  isEsRole,
  isHrRole,
  isSuperAdminRole,
  isSupervisorRole,
  isWrtAdminRole,
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
          "The sidebar groups your work: Portal for configuration, Oversight for team health, and Tools for time, WRT preview, reports, and partners.",
        steps: [
          "Portal → Super Admin Portal (and Audit when you are not role-previewing).",
          "Oversight → Team Operations, Compliance, Explore Analytics.",
          "Tools → Time Clock, WRT Preview, Submit Reports, Community Partners.",
          "Help → this guide.",
        ],
      },
      {
        title: "Super Admin Portal",
        body:
          "Clients is the home tab. Team, Offices, Reports, and Settings cover organization control. Setup panels live under Settings — not as extras at the bottom of the page.",
        steps: [
          "Clients → search, add, import, and manage the roster (including View Archived).",
          "Team → Employment Specialists and Supervisors.",
          "Offices → Directory and Counselors; you can hide/show offices.",
          "Reports → Audit Activity (org audit CSV) and Message Audit.",
          "Settings → Administrators, Advanced Connections, PTO Settings, WRT Curriculum, Payroll Settings, Demo Training, Error Log.",
        ],
      },
      {
        title: "Submit Reports vs Download Exports vs Explore Analytics",
        body: "Three different tools — use the one that matches the task.",
        steps: [
          "Submit Reports: Joshua Tree Reports — official PDF submissions to Google Drive.",
          "Explore Analytics: live charts and outcome benchmarking for leadership.",
          "Reports → Audit Activity: administrative audit trails (not client monthly reports).",
          "Time Clock: staff hours worked for payroll/accountability — separate from billable timesheets. You can edit any clock entry; every edit is logged.",
        ],
      },
      {
        title: "WRT Preview",
        body:
          "Workplace Readiness Training curriculum and facilitation are admin-tier preview tools for now. The WRT Admin role can sign in, but WRT tools stay under Admin / Super Admin until rollout.",
        steps: [
          "Settings → WRT Curriculum to review modules and lessons.",
          "Tools → WRT Preview (or the link under WRT Curriculum) for facilitation and presentation mode.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "Joshua Tree team members request paid time off from Time Clock. Days charged default to business days (Mon–Fri); HR and admins can adjust charged days (for holidays) without changing dates. Counselors and clients do not use PTO in Wayfinder Pro.",
        steps: [
          "Open Time Clock → PTO Requests to submit your own leave and review the org queue.",
          "Approve or deny pending requests; include an explanation when denying.",
          "Amend dates or days charged with a required note; void approved leave when it should not count against the bank.",
          "Settings → PTO Settings for annual PTO days and period start (usually January 1). Leave annual days blank for unlimited.",
        ],
      },
      {
        title: "Closed, Dismissed, and Restore",
        body:
          "Closing or dismissing a client leaves the ES active caseload immediately and archives after 24 hours. You can restore from Audit Activity or when View Archived is on.",
        steps: [
          "Reports → Audit Activity → Restore Client on Closed/Dismissed stage events.",
          "Clients → View Archived to find archived people, then restore from the client stage or activity restore actions.",
        ],
      },
    ];
  }

  if (isAdminTierRole(role)) {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Daily configuration lives in the Admin Portal. Oversight pages show team capacity, compliance gaps, and analytics. Notifications alert you to message SLA issues and employment milestones.",
        steps: [
          "Portal → Admin Portal for clients, offices, services, and team members.",
          "Oversight → Team Operations, Compliance, Explore Analytics.",
          "Tools → Time Clock, WRT Preview, Submit Reports, Community Partners.",
        ],
      },
      {
        title: "Admin Portal Settings",
        body:
          "PTO and WRT curriculum live under Portal → Settings (not bolted under the Clients list).",
        steps: [
          "Settings → PTO Settings for period start and annual PTO days.",
          "Settings → WRT Curriculum (and Open WRT Facilitation Preview) for the admin-only WRT tools.",
          "Settings → Administrators and Advanced Connections for org access.",
          "Reports → Audit Activity for contact/stage audits; restore Closed/Dismissed clients from stage events when needed.",
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
        title: "PTO Requests",
        body:
          "Team members request PTO on Time Clock. You and HR approve or deny requests, adjust days charged for holidays, and set the org PTO bank.",
        steps: [
          "Time Clock → PTO Requests to submit, review, approve, deny, or amend leave.",
          "Please ask for 14 days’ notice when possible; sick and emergency may be sooner — you make the final call.",
          "Portal → Settings → PTO Settings for period start date and annual PTO days (blank = unlimited).",
        ],
      },
      {
        title: "Team Operations and Compliance",
        body: "Use these when supervising program delivery — you see organization-wide slices as an admin.",
        steps: [
          "Team Operations: ES caseload capacity and billable-hour trends.",
          "Compliance: SE Monthly report gaps and timesheets awaiting approval.",
          "Explore Analytics: organization-wide progress and outcome benchmarking.",
          "Submit Reports: open Joshua Tree Reports for official PDFs.",
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
          "Daily Work → Supervisor Portal, Messages, Time Clock, Weekly Timesheet.",
          "Oversight → Team Operations, Compliance, Submit Reports, Explore Analytics.",
          "Tools → Download Exports, Community Partners.",
        ],
      },
      {
        title: "This Week (Supervisor Portal)",
        body:
          "On Supervisor Portal → Clients, This Week shows open coaching and compliance counts so you can triage before browsing the roster.",
        steps: [
          "Message SLA overdue and thin contact logs open Team Operations.",
          "Report gaps open Compliance; timesheets to review open Weekly Timesheet.",
          "Use View Archived on Clients when you need Closed/Dismissed people; restore from Reports → Audit Activity when View Archived is on, or ask an admin.",
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
        title: "PTO Requests",
        body:
          "Request your own PTO on Time Clock. You can also see requests from Employment Specialists assigned to you (view only). HR and admins approve or deny leave.",
        steps: [
          "Time Clock → PTO Requests: pick dates, choose a reason, add details if needed, and submit.",
          "Please request at least 14 days in advance when possible; sick and emergency may be sooner.",
          "Watch status and any explanation from HR/admin on your requests. Cancel while still pending if plans change.",
          "Review your designated ES requests so you can plan coverage — you do not approve them.",
        ],
      },
      {
        title: "Supervisor Portal and Coaching",
        body:
          "Your portal shows team overview. Team Operations adds a coaching queue for overdue message replies and thin contact logs.",
        steps: [
          "Supervisor Portal: see your Employment Specialists and high-level caseload signals.",
          "Team Operations: capacity view plus coaching queue (SLA overdue and fewer than four contacts per month).",
          "Messages: intervene on client threads in your scope.",
          "Compliance: your team’s SE Monthly gaps and pending timesheet approvals.",
          "Submit Reports: open Joshua Tree Reports to submit or review official monthly reports.",
        ],
      },
    ];
  }

  if (isEsRole(role)) {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Clients is your home base. The sidebar groups daily work (clients, messages, time clock, timesheet, reports) and resources (partners, analytics, exports). Notifications surface message SLA and employment celebrations.",
        steps: [
          "Daily Work → Clients, Messages, Time Clock, My Time (Timesheet), Submit Reports.",
          "Resources → Community Partners, Explore Analytics, Download Exports.",
        ],
      },
      {
        title: "Clients: Today, Pipeline, and Caseload",
        body:
          "The Clients page opens with a Today strip for urgent work, then the application pipeline, then your caseload table (people who need follow-up sort to the top).",
        steps: [
          "Today: needs reply, upcoming meetings, stale applications, and no-contact flags — tap a chip to jump.",
          "Application pipeline: click a card to move status (including Offer).",
          "Open a client row for profile, contacts, applications, and stage.",
          "Closed or Dismissed: confirm first — they leave your active list immediately and archive after 24 hours. Use View Archived to find them; Restore brings them back to an active stage.",
          "Correct your own contact logs within 24 hours from the Activity Timeline (Correct). After that, ask a super admin.",
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
          "Log contacts and applications carefully — counselors see your contact notes. Billable time on a contact is not the same as Time Clock hours worked.",
        steps: [
          "Log every contact and job application on the client profile.",
          "When logging service time, enter duration plus a start time, end time, or both. If start and end disagree with duration, clock times win.",
          "You may log the same clock time on more than one client when the work applies to each (for example multi-client job canvass).",
          "Use suggested chips when logging contacts to speed up common entries.",
          "Use Messages to reply to clients. Aim to respond within 48 business hours.",
          "Set job start date on the profile when a client is hired — this triggers milestone notifications for the team and counselors.",
          "Submit Reports opens Joshua Tree Reports with the client name filled in when you start from a client workflow.",
        ],
      },
      {
        title: "Timesheet: Billable vs Time Clock",
        body:
          "My Time (Timesheet) is for client billable service activities (state billing). Time Clock is for when you yourself were working. Do not confuse the two.",
        steps: [
          "Open My Time (Timesheet) to review billable entries, download CSV, and submit for approval.",
          "Open Time Clock for your daily hours worked totals.",
          "Soft caseload guidance is about 20 active clients — supervisors/HR may allow more when needed.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "Request vacation, sick, maternity/paternity, emergency, or other leave from Time Clock. Remaining days show when HR/admin has set an annual bank.",
        steps: [
          "Time Clock → PTO Requests → choose start/end dates and a reason, then submit.",
          "Please request at least 14 days in advance when possible; sick and emergency may be sooner. HR/admin decide.",
          "Track approval or denial (and any explanation) on the same page. You can cancel a request while it is still pending.",
        ],
      },
    ];
  }

  if (role === "accountant") {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Accounts Specialist tools focus on timesheets, Time Clock, and payment/billing exports. Community Partners is shared reference data.",
        steps: [
          "Accounts → Weekly Timesheet, Time Clock, Download Exports.",
          "Reference → Community Partners.",
        ],
      },
      {
        title: "Payroll vs Billable Exports",
        body:
          "Hours worked (payroll) come from staff Time Clock shifts. Billable by client is for state billing and may differ from hours worked.",
        steps: [
          "Download Exports → Payroll — hours worked from Time Clock for the pay period.",
          "Download Exports → Billable hours by client for state billing files.",
          "Pay-period settings are configured by super admin under Portal → Settings → Payroll Settings.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "You can view all PTO requests for payroll awareness. You cannot approve or deny — that stays with HR and admins.",
        steps: [
          "Time Clock → PTO Requests to see the queue (filters: pending, approved, denied, past).",
          "Submit your own PTO from the same page when you need leave.",
        ],
      },
    ];
  }

  if (isHrRole(role)) {
    return [
      {
        title: "HR Workspace",
        body:
          "HR focuses on people and performance: timesheets, Time Clock / PTO approvals, aggregated analytics, and exports for hours worked and billable oversight. Client-named analytics dumps are not available.",
        steps: [
          "HR Dashboard for people tools.",
          "Weekly Timesheet to view any ES week.",
          "Time Clock for hours worked and the org PTO approval queue.",
          "Explore Analytics for org-wide performance (hires, contacts/week, billable vs worked, time to hire by office/ES/supervisor/counselor).",
          "Download Exports → hours worked (payroll from Time Clock) and billable-by-client CSVs.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "You approve and manage leave for the organization. Days charged default to business days; adjust charged days so holidays do not penalize staff.",
        steps: [
          "Time Clock → PTO Requests to review, approve, deny, amend, or void leave.",
          "Include an explanation when denying. Soft guideline: 14 days’ notice when possible.",
          "HR Dashboard → PTO Settings for period start and annual PTO days (blank = unlimited).",
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

  if (role === "hospitality_specialist") {
    return [
      {
        title: "Hospitality Workspace",
        body:
          "Your sidebar includes the Hospitality Dashboard, Community Partners, and Time Clock. Use Time Clock for hours worked and your own PTO.",
        steps: [
          "Hospitality Dashboard → client logs, community network, and connections for hospitality work.",
          "Community Partners → shared employer / partner reference.",
          "Time Clock → clock in/out (America/New_York) and PTO Requests for your own leave.",
          "Please request at least 14 days in advance when possible; sick and emergency may be sooner.",
        ],
      },
    ];
  }

  if (isWrtAdminRole(role)) {
    return [
      {
        title: "WRT Admin",
        body:
          "Your account is set up for Workplace Readiness Training administration. Curriculum and facilitation previews stay under Admin / Super Admin until WRT is rolled out more broadly.",
        steps: [
          "My Profile → keep your name and contact details current.",
          "Time Clock → hours worked and your own PTO.",
          "Community Partners → reference directory.",
          "Ask an Admin or Super Admin to open WRT Curriculum / WRT Preview when you need to review content.",
        ],
      },
    ];
  }

  if (isCounselorRole(role)) {
    return [
      {
        title: "My Clients and Notifications",
        body:
          "You can see activity for clients assigned to you. You cannot edit their records or send messages through Wayfinder Pro. Archived (Closed/Dismissed after 24 hours) clients stay hidden unless you turn on View Archived.",
        steps: [
          "Open My Clients to see recent updates — contacts, applications, and milestones.",
          "Use View Archived when you need Closed or Dismissed clients.",
          "Notifications (top of the sidebar): weekly activity summaries and employment celebrations (hire, 30/60/90 days). Tap an alert to open that client’s timeline.",
          "On mobile, open Menu to reach Notifications and My Clients.",
          "If something looks wrong, contact the client’s Employment Specialist or your program supervisor.",
        ],
      },
      {
        title: "Quick Start Guide",
        body:
          "A one-page summary on the counselor portal. Sign in with your agency work email and the magic link on the login page.",
        steps: [
          "My Clients → Quick Start Guide (top of the page).",
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
