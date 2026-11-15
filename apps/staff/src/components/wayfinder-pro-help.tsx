"use client";

import {
  isAdminTierRole,
  isCounselorRole,
  isFieldSpecialistRole,
  isGvraSupervisorRole,
  isHrRole,
  isInstructorRole,
  isSuperAdminRole,
  isSupervisorRole,
  isTransitionSpecialistRole,
  isWrtAdminRole,
} from "@wayfinder/supabase/roles";
import Link from "next/link";

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
          "Tools → Billable Hours, PTO, WRT Preview, Submit Reports, Community Partners.",
          "Help → this guide.",
        ],
      },
      {
        title: "Super Admin Portal",
        body:
          "Clients is the home tab. Team, Offices, Reports, and Settings cover organization control. Setup panels live under Settings — not as extras at the bottom of the page.",
        steps: [
          "Clients → search, add, import, and manage the roster (including View Archived).",
          "Team → Employment Specialists and Regional Supervisors.",
          "Offices → Directory and Counselors; you can hide/show offices.",
          "Reports → Audit Activity (org audit CSV) and Message Audit.",
          "Settings → Feature Toggles (Community Partners, TSE, Job Coaching, GroupMe celebrations), Administrators, Advanced Connections, PTO Settings, WRT Curriculum, Payroll Settings, Demo Training, Error Log.",
          "Account → Team Directory for staff contacts.",
        ],
      },
      {
        title: "Submit Reports vs Download Exports vs Explore Analytics",
        body: "Three different tools — use the one that matches the task.",
        steps: [
          "Submit Reports: Joshua Tree Reports — official PDF submissions to Google Drive.",
          "Explore Analytics: live charts and outcome benchmarking for leadership.",
          "Reports → Audit Activity: administrative audit trails (not client monthly reports).",
          "Billable Hours: review weekly billable timesheets. Pay is based on billable hours. PTO lives under sidebar → PTO.",
        ],
      },
      {
        title: "IJP Billing and Pre-ETS",
        body:
          "Accounts Specialist and Super Admin share Individual Job Placement billing and Pre-ETS accounts tools. Service display name is always Individual Job Placement.",
        steps: [
          "Accounts → IJP Billing — Generate Invoices for the selected service month (weekly is fine; GVRA accepts multiple invoices per client per month). Every client with unbilled Individual Job Placement hours is invoiced, including archived or closed clients and hours logged by any staff role. Non–Individual Job Placement hours never appear on these invoices, and hours are never billed twice.",
          "You, Admins, and Accounts Specialists upload Pre-ETS spreadsheets (Super Admin / Admin: planning path; Accounts: support / auth-match). Regional Supervisors do not upload. You can correct authorization numbers and roster students after finalization.",
          "Pre-ETS settings and role rollout stay under Super Admin Portal when the module is enabled.",
        ],
      },
      {
        title: "WRT Preview",
        body:
          "Workplace Readiness Training curriculum and facilitation are available to Admin, Super Admin, and WRT Admin.",
        steps: [
          "Settings → WRT Curriculum to review modules and lessons.",
          "Tools → WRT Preview (or the link under WRT Curriculum) for facilitation and presentation mode.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "Joshua Tree team members request paid time off from PTO. Days charged default to business days (Mon–Fri); HR and admins can adjust charged days (for holidays) without changing dates. Counselors and clients do not use PTO in Wayfinder Pro. Transition Instructors also use PTO.",
        steps: [
          "Open PTO to submit your own leave and review the org queue.",
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
          "Daily configuration lives in the Admin Portal. Admins also own HR people-ops (the separate HR Director role is retired). Oversight pages show team capacity, compliance gaps, and analytics.",
        steps: [
          "Portal → Admin Portal for clients, offices, services, and team members.",
          "Portal → HR Dashboard for roster, timesheets, activity, and PTO settings.",
          "Oversight → Team Operations, Compliance, Explore Analytics.",
          "Tools → Billable Hours / PTO, WRT Preview, Submit Reports, Referral Queue, Intake Calls, Community Partners (Feature Toggle).",
          "Account → My Profile and Our Team (Team Directory).",
        ],
      },
      {
        title: "Admin Portal Settings",
        body:
          "PTO and WRT curriculum live under Portal → Settings. You cannot assign Admin or Super Admin — only Super Admin can grant those roles.",
        steps: [
          "Settings → PTO Settings for period start and annual PTO days.",
          "Settings → WRT Curriculum (and Open WRT Facilitation Preview) for the admin-only WRT tools.",
          "Settings → Administrators and Advanced Connections for org access (edit names/active status; role grants are Super Admin only).",
          "Reports → Audit Activity for contact/stage audits; restore Closed/Dismissed clients from stage events when needed.",
        ],
      },
      {
        title: "HR work (Admins)",
        body:
          "HR Director is no longer assigned. Admins approve PTO, manage PTO settings, and use the HR Dashboard for people ops and intake support.",
        steps: [
          "HR Dashboard → client roster, timesheets, activity, and staff assignments (view).",
          "HR Dashboard or Settings → PTO Settings for period start and annual PTO days (blank = unlimited).",
          "PTO → approve, deny, amend, or void leave for the organization.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "Team members request PTO from the PTO page. Admins make the final approval, adjust days charged for holidays, and set the org PTO bank.",
        steps: [
          "PTO to submit, review, approve, deny, or amend leave.",
          "Please ask for 14 days’ notice when possible; sick and emergency may be sooner — you make the final call.",
          "Portal → Settings → PTO Settings for period start date and annual PTO days (blank = unlimited).",
        ],
      },
      {
        title: "Team Operations and Compliance",
        body: "Use these when supervising program delivery — you see organization-wide slices as an admin.",
        steps: [
          "Team Operations: ES caseload capacity and billable-hour trends.",
          "Compliance: SE Monthly report gaps for the organization.",
          "Explore Analytics: organization-wide progress and outcome benchmarking.",
          "Submit Reports: open Joshua Tree Reports for official PDFs.",
        ],
      },
      {
        title: "IJP Billing and Pre-ETS (when enabled)",
        body:
          "Admins with Pre-ETS / Accounts access can use Individual Job Placement billing and Pre-ETS accounts workflows alongside Accounts Specialists.",
        steps: [
          "IJP Billing invoices Individual Job Placement hours only. Generate Invoices can run weekly; every client with unbilled IJP hours in the period is included (including archived/closed), and hours are never billed twice.",
          "Pre-ETS: Admins can upload planning worksheets for assigned schools (or any district when testing override is on). Correct authorization numbers and rosters after finalization when you have Accounts access. Regional Supervisors do not upload.",
        ],
      },
    ];
  }

  if (isSupervisorRole(role)) {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Your role displays as Regional Supervisor. Daily work is at the top (portal, messages, billable hours, PTO). Oversight covers your team’s coaching queue and compliance. Check Notifications for SLA alerts and client milestones.",
        steps: [
          "Daily Work → Regional Supervisor Portal, Messages, Billable Hours, PTO.",
          "Oversight → Team Operations, Compliance, Submit Reports, Explore Analytics.",
          "Tools → Download Exports, Community Partners (when enabled in Feature Toggles).",
          "Account → Team Directory for staff contacts; GroupMe celebrations can be toggled by Super Admin.",
        ],
      },
      {
        title: "This Week (Regional Supervisor Portal)",
        body:
          "On Regional Supervisor Portal → Clients, This Week shows open coaching and compliance counts so you can triage before browsing the roster.",
        steps: [
          "Message SLA overdue and thin contact logs open Team Operations.",
          "Report gaps open Compliance; billable time review opens Billable Hours.",
          "Use View Archived on Clients when you need Closed/Dismissed people; restore from Reports → Audit Activity when View Archived is on, or ask an admin.",
        ],
      },
      {
        title: "Billable Hours",
        body:
          "Billable Hours shows client billable service time for your team. Pay is based on billable hours — there is no week submit/approve step.",
        steps: [
          "Open Billable Hours to review weekly timesheets for yourself and supervised Employment Specialists.",
          "Download CSV or PDFs from the weekly timesheet section as needed.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "Request your own PTO from the PTO page. For Employment Specialists and Instructors assigned to you, confirm coverage first (OK — send to HR). HR and admins make the final approval; supervisor OK does not mark leave approved.",
        steps: [
          "PTO: pick dates, choose a reason, add details if needed, and submit.",
          "Please request at least 14 days in advance when possible; sick and emergency may be sooner.",
          "On designated staff requests awaiting supervisor: check coverage, then OK — send to HR or Deny.",
          "Watch status and any explanation from HR/admin on your requests. Cancel while still open if plans change.",
        ],
      },
      {
        title: "Regional Supervisor Portal and Coaching",
        body:
          "Your portal shows team overview. Team Operations adds a coaching queue for overdue message replies and thin contact logs.",
        steps: [
          "Regional Supervisor Portal: see your Employment Specialists and high-level caseload signals.",
          "Team Operations: capacity view plus coaching queue (SLA overdue and fewer than four contacts per month).",
          "Messages: intervene on client threads in your scope.",
          "Compliance: your team’s SE Monthly gaps.",
          "Submit Reports: open Joshua Tree Reports to submit or review official monthly reports.",
        ],
      },
      {
        title: "Pre-ETS and IJP coaching",
        body:
          "When Pre-ETS is enabled for supervisors, coach field staff on released rosters and Employment Specialists on monthly Individual Job Placement client attestation signatures. Worksheet upload is Admin, Accounts Specialist, and Super Admin — Regional Supervisors do not upload.",
        steps: [
          "Pre-ETS → review released rosters and coaching for your assigned schools (Admin, Accounts Specialist, and Super Admin upload spreadsheets — supervisors do not).",
          "Watch IJP client attestation SLA alerts after the 25th when billable Individual Job Placement time exists — coach ESs to Collect IJP signature.",
        ],
      },
    ];
  }

  if (isFieldSpecialistRole(role)) {
    const sections: Section[] = [
      {
        title: "Sidebar Layout",
        body:
          "Clients is your home base. The sidebar groups daily work (clients, messages, billable hours, PTO, reports) and resources (partners when enabled, analytics, exports). Notifications surface message SLA and employment celebrations. Employment Specialists do not have Pre-ETS — that belongs to Transition Specialists.",
        steps: [
          "Daily Work → Clients, Messages, Billable Hours, PTO, Submit Reports.",
          "Resources → Community Partners (Feature Toggle), Explore Analytics, Download Exports.",
          "Account → Team Directory for staff contacts.",
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
        title: "Working with Your Clients",
        body:
          "Log contacts and applications carefully — counselors see your contact notes. Billable time on a contact feeds state billing and payroll from billable hours.",
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
        title: "Billable Hours (Timesheet)",
        body:
          "Billable Hours is for client billable service activities (state billing). Pay is based on these billable hours — there is no week submit/approve step. Individual Job Placement billable hours feed Accounts Specialist IJP invoices.",
        steps: [
          "Open Billable Hours to review billable entries and download CSV or PDFs.",
          "Soft caseload guidance is about 20 active clients — supervisors/HR may allow more when needed.",
        ],
      },
      {
        title: "Individual Job Placement attestation",
        body:
          "For clients on Individual Job Placement, collect the monthly client signature when the caseload prompts Collect IJP signature (typically after the 25th when billable time exists).",
        steps: [
          "Open the client and use Collect IJP signature when Signature needed appears.",
          "Supervisors and admins may see IJP attestation SLA alerts for coaching — dismiss hides the alert only; the caseload still shows Signature needed until capture.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "Request vacation, sick, maternity/paternity, emergency, or other leave from PTO. Remaining days show when HR/admin has set an annual bank. Your request goes to your supervisor for coverage review first, then HR for final approval.",
        steps: [
          "PTO → choose start/end dates and a reason, then submit.",
          "Please request at least 14 days in advance when possible; sick and emergency may be sooner. Status stays unapproved until HR/admin decides.",
          "Track approval or denial (and any explanation) on the same page. You can cancel a request while it is still open.",
        ],
      },
    ];

    if (isTransitionSpecialistRole(role)) {
      sections.push({
        title: "Pre-ETS (Transition Specialist)",
        body:
          "Transition Specialists use the same Employment Specialist caseload shell plus Pre-ETS for released student rosters, sessions, attendance, and CARs. Employment Specialists do not see Pre-ETS. Admin, Accounts Specialist, and Super Admin upload Pre-ETS spreadsheets and enter authorization numbers — field staff work released rosters only.",
        steps: [
          "Open Pre-ETS from the sidebar for schools, students, sessions, and worksheets on released authorizations.",
          "Clients, Messages, Billable Hours, PTO, and Submit Reports work the same as for Employment Specialists on your assigned caseload.",
          "Use Explore Analytics and Download Exports for your own caseload scope.",
          "Help → Pre-ETS training demos (below) for interactive roster signature and CAR walkthroughs.",
        ],
      });
    }

    return sections;
  }

  if (role === "accountant") {
    return [
      {
        title: "Sidebar Layout",
        body:
          "Accounts Specialist tools focus on intake billing, Individual Job Placement (IJP) billing, Pre-ETS authorizations and invoices, billable hours, PTO, and billing exports. Community Partners is shared reference data.",
        steps: [
          "Accounts → Intake Billing (this is your home screen after login).",
          "Accounts → IJP Billing — Individual Job Placement invoices (never labeled “GA IJP” in the product).",
          "Accounts → Pre-ETS — upload the Pre-ETS spreadsheet, enter/correct authorization numbers, manage rosters and invoice packets.",
          "Accounts → Billable Hours, PTO, Download Exports.",
          "Account → My Profile to update your name, city, and contact details.",
          "Reference → Community Partners.",
          "Client names on timesheets and intake billing open a view-only profile.",
        ],
      },
      {
        title: "Individual Job Placement billing",
        body:
          "IJP Billing builds monthly Individual Job Placement invoices from unbilled IJP-attributed billable hours. GVRA accepts multiple invoices per client per month, so running Generate Invoices weekly is fine.",
        steps: [
          "Use Generate Invoices for the selected service month (often weekly) to pick up unbilled Individual Job Placement hours.",
          "Every client with unbilled IJP hours in the period is invoiced — including archived or closed clients, and hours logged by any staff role. Demo clients are excluded.",
          "Non–Individual Job Placement hours never appear on IJP invoices. Hours already stamped on an invoice are never billed twice; late hours create or refresh a draft, or a supplemental draft if the month invoice is already locked.",
          "Line hours round to the nearest half hour; invoice totals round up to whole hours. Draft lines auto-refresh from billable time when you open the month. Editors can add invoice-only manual lines that do not create contact logs; each invoice includes the 2-hour GVRA Reports allowance on the last day of the month (skipped on a supplemental invoice if already billed for that month).",
        ],
      },
      {
        title: "Pre-ETS (Accounts)",
        body:
          "Admin, Accounts Specialist, and Super Admin upload Pre-ETS spreadsheets. Your upload is the support / auth-match path (any district). Admin and Super Admin use the planning path. Regional Supervisors do not upload.",
        steps: [
          "Upload the Pre-ETS spreadsheet/worksheet under Pre-ETS, approve or reject parsed uploads, then commit. Enter or correct GVRA authorization numbers (A&I) under Rosters & authorizations.",
          "Add or remove students on a roster even after it is finalized. You can also change the authorization number after finalization. Use Change log on Rosters & auths for a read-only audit.",
          "Build and manage invoice packets. Ready, submitted, or paid packets are not reset when a roster or auth number changes; draft packet unit totals may refresh from billable attendance.",
        ],
      },
      {
        title: "Billable Exports",
        body:
          "Pay is based on billable hours. Download billable-by-client CSVs for state billing from Download Exports.",
        steps: [
          "Download Exports → Billable hours by client for state billing files.",
          "Pay-period settings are configured by super admin under Portal → Settings → Payroll Settings.",
        ],
      },
      {
        title: "PTO Requests",
        body:
          "You can view all PTO requests for payroll awareness. You cannot approve or deny — that stays with HR and admins.",
        steps: [
          "PTO to see the queue (filters: pending, approved, denied, past).",
          "Submit your own PTO from the same page when you need leave.",
        ],
      },
    ];
  }

  if (isHrRole(role)) {
    return [
      {
        title: "HR Director (legacy)",
        body:
          "The HR Director role is retired for new assignments. Admins now own HR Dashboard, PTO settings, and PTO approvals. Your existing account keeps the same tools until it is converted.",
        steps: [
          "Prefer Admin accounts for new HR work.",
          "HR Dashboard, PTO queue, Referral Queue / Intake Calls, and exports still work for this legacy role.",
          "Ask a Super Admin if your account should be moved to Admin.",
        ],
      },
    ];
  }

  if (isInstructorRole(role)) {
    return [
      {
        title: "Transition Instructor",
        body:
          "Your home is Pre-ETS. You also have My Profile, Our Team (Team Directory, Core Four, Share a Moment), and PTO — not vocational caseload or Billable Hours.",
        steps: [
          "Pre-ETS → worksheets, sessions, rosters, and class activity reports for your schools.",
          "Account → My Profile to keep name and contact details current.",
          "Our Team → Team Directory, Core Four, and Share a Moment.",
          "PTO → request leave (your supervisor confirms coverage before Admin final approval).",
        ],
      },
    ];
  }

  if (isGvraSupervisorRole(role)) {
    return [
      {
        title: "GVRA Supervisor",
        body:
          "Sign in with your agency work email and the magic link on the login page (same flow as counselors). You see counselors in your assigned GVRA offices and their caseloads read-only.",
        steps: [
          "Counselors & Clients → open a counselor in your office to view their client list.",
          "Open a client for the same read-only activity view counselors receive.",
          "You cannot edit client records or message through Wayfinder Pro.",
          "If no offices appear, ask Joshua Tree support to link your account to the correct GVRA office.",
        ],
      },
    ];
  }

  if (role === "hospitality_specialist") {
    return [
      {
        title: "Hospitality Workspace",
        body:
          "Your sidebar includes the Hospitality Dashboard, Intake Calls, Weekly Check-ins, Partner Check-ins, Community Partners, Billable Hours, PTO, and My Profile.",
        steps: [
          "Weekly Check-ins → call every client at least once each week and log the outcome.",
          "Partner Check-ins → contact every Community Partner at least once each month and log the outcome.",
          "Open a client to add internal staff notes (not visible to clients, natural supports, or counselors).",
          "Hospitality Dashboard → client logs, community network, and connections.",
          "Intake Calls → complete hospitality intake for new activations.",
          "Account → My Profile to update your name, city, and contact details.",
          "PTO for your own leave requests.",
        ],
      },
    ];
  }

  if (isWrtAdminRole(role)) {
    return [
      {
        title: "WRT Admin",
        body:
          "Your home screen is WRT Facilitation. You have admin permissions only for WRT (curriculum + facilitation)—not the full Admin portal.",
        steps: [
          "WRT Facilitation → run sessions and presentation mode.",
          "WRT Curriculum → manage modules, lessons, and blocks.",
          "My Profile → keep your name and contact details current.",
          "PTO for your own leave requests.",
          "Community Partners → reference directory (view).",
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
  /** Same flag as sidebar Pre-ETS nav — training demo links only when Pre-ETS is visible. */
  showPreEtsNav?: boolean;
};

export function WayfinderProHelp({ role, showPreEtsNav = false }: Props) {
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

      {showPreEtsNav ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-black">Pre-ETS training demos</h2>
          <p className="mt-2 text-sm text-brand-black/80">
            Interactive walkthroughs with sample data only — nothing writes to production. Use them to
            train supervisors, Accounts, Transition Specialists, and Transition Instructors on
            worksheets, authorization release, in-app student roster signatures, and class activity
            reports (CAR).
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-brand-black/85">
            <li>
              <Link href="/dashboard/pre-ets/demo" className="font-medium text-brand-green hover:underline">
                Pre-ETS authorization process demo
              </Link>
              {" — "}
              Valdosta/Lowndes sample flow for supervisors, Accounts, and field staff (upload
              through roster release).
            </li>
            <li>
              <Link
                href="/dashboard/pre-ets/demo/field-delivery"
                className="font-medium text-brand-green hover:underline"
              >
                TS/TI roster &amp; CAR walkthrough
              </Link>
              {" — "}
              Sessions &amp; reports: collect student signatures on a phone or tablet, save roster to
              Drive, Activity Plan, and submit CAR (login required).
            </li>
            <li>
              <Link
                href="/walkthrough/pre-ets/field-delivery"
                className="font-medium text-brand-green hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Shareable field delivery demo (no login)
              </Link>
              {" — "}
              Same TS/TI roster training for email or conference screens; opens in a new tab.
            </li>
            <li>
              <a
                href="/demo/pre-ets-sample-planning.csv"
                className="font-medium text-brand-green hover:underline"
                download
              >
                Download sample planning CSV
              </a>
              {" — "}
              Example district worksheet for Admin / Accounts Specialist / Super Admin upload training.
            </li>
          </ul>
        </section>
      ) : null}

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
            {isFieldSpecialistRole(role) ? (
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
            {isFieldSpecialistRole(role) || isSupervisorRole(role) ? (
              <li>Employer outreach script — Community Partners folder in training materials</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
