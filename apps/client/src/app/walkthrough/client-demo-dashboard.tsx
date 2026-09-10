"use client";

import {
  applicationStatusLabel,
  ClientActivityTimeline,
  formatPortalDateTime,
  isGoldApplicationStatus,
  WAYFINDER_LOGO_PATH,
} from "@wayfinder/branding";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DesertTrail } from "@/app/dashboard/desert-trail";
import { CLIENT_DASHBOARD_SECTION_IDS as IDS } from "@/lib/dashboard-section-ids";
import { CLIENT_DASHBOARD_SECTIONS as LABELS } from "@/lib/dashboard-section-labels";
import {
  DEMO_ACTIVITY_FEED,
  DEMO_APPLICATIONS,
  DEMO_CLIENT_NAME,
  DEMO_MEETING,
  DEMO_MESSAGES,
  DEMO_MILESTONES,
  DEMO_SERVICE,
} from "./lib/client-mock-data";
import { DemoInlineNotice, showDemoActionNotice } from "./components/demo-notice";

type DemoMessage = (typeof DEMO_MESSAGES)[number];

export function ClientDemoDashboard() {
  const [meetingStatus, setMeetingStatus] = useState<"pending" | "accepted" | "declined">(
    DEMO_MEETING.status
  );
  const [messages, setMessages] = useState<DemoMessage[]>(DEMO_MESSAGES);
  const [draft, setDraft] = useState("");
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  function acceptMeeting() {
    setMeetingStatus("accepted");
    showDemoActionNotice();
  }

  function declineMeeting() {
    setMeetingStatus("declined");
    showDemoActionNotice();
  }

  function sendMessage() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        body: trimmed,
        sender_role: "client",
        sender_name: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");
    showDemoActionNotice();
  }

  const shellClass = [
    "mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-16",
    largeText ? "text-lg" : "",
    highContrast ? "bg-white text-black" : "bg-brand-white",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main id="demo-dashboard-main" className={shellClass}>
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-green sm:text-sm">
          Wayfinder · Client Dashboard
        </p>
        <h1 className="text-2xl font-semibold text-brand-green sm:text-3xl">Welcome</h1>
        <p className="text-brand-black/85">
          Signed in as <span className="font-medium text-brand-green">{DEMO_CLIENT_NAME}</span>
          {" · "}
          <Link href="/quick-start" className="font-medium text-brand-green hover:underline">
            Help
          </Link>
        </p>
        <nav
          aria-label="On this page"
          className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-sm text-brand-black/70"
        >
          <a href={`#${IDS.today}`} className="font-medium text-brand-green hover:underline">
            Today
          </a>
          <span aria-hidden="true">·</span>
          <a href={`#${IDS.yourPath}`} className="font-medium text-brand-green hover:underline">
            {LABELS.yourPath}
          </a>
          <span aria-hidden="true">·</span>
          <a href={`#${IDS.messages}`} className="font-medium text-brand-green hover:underline">
            Messages
          </a>
          <span aria-hidden="true">·</span>
          <a href={`#${IDS.applications}`} className="font-medium text-brand-green hover:underline">
            {LABELS.applications}
          </a>
          <span aria-hidden="true">·</span>
          <a href={`#${IDS.activity}`} className="font-medium text-brand-green hover:underline">
            {LABELS.yourActivity}
          </a>
          <span aria-hidden="true">·</span>
          <a href={`#${IDS.account}`} className="font-medium text-brand-green hover:underline">
            {LABELS.account}
          </a>
        </nav>
      </header>

      <section
        id={IDS.celebrating}
        aria-labelledby={IDS.celebratingHeading}
        className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4"
      >
        <h2 id={IDS.celebratingHeading} className="text-sm font-semibold text-brand-green">
          {LABELS.celebrating}
        </h2>
        <p className="mt-1 text-sm text-brand-black/80">
          Sample: You reached a <strong>30-day employment milestone</strong> — celebrations like this
          appear on your live dashboard when you hit employment milestones.
        </p>
      </section>

      <section
        id={IDS.yourPath}
        aria-labelledby={IDS.yourPathHeading}
        className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col items-center border-b border-neutral-200 pb-6">
          <Image
            src={WAYFINDER_LOGO_PATH}
            alt="Wayfinder"
            width={360}
            height={108}
            className="h-auto w-full max-w-[min(320px,85vw)] object-contain"
            priority
            sizes="(max-width: 640px) 85vw, 320px"
          />
        </div>
        <div className="mt-6">
          <h2 id={IDS.yourPathHeading} className="text-lg font-semibold text-brand-green">
            {LABELS.yourPath}
          </h2>
          <p className="mt-1 text-sm text-brand-black/70">{DEMO_SERVICE.name}</p>
          <p className="mt-3 text-base font-semibold text-brand-black">
            Current stage:{" "}
            <span className="text-brand-green">{DEMO_SERVICE.currentStageTitle}</span>
          </p>
        </div>
        <div className="mt-6 bg-white pt-2">
          <DesertTrail
            milestones={DEMO_MILESTONES}
            currentStageId={DEMO_SERVICE.currentStageId}
            readOnly={false}
          />
        </div>
      </section>

      <section
        id={IDS.today}
        aria-labelledby={IDS.todayHeading}
        className="scroll-mt-6 rounded-2xl border-2 border-brand-green/30 bg-gradient-to-br from-brand-white to-brand-green/5 p-6 shadow-sm"
      >
        <h2 id={IDS.todayHeading} className="text-lg font-semibold text-brand-green">
          {LABELS.nextMeeting}
        </h2>
        {meetingStatus === "declined" ? (
          <p className="mt-2 text-sm text-brand-black/70">
            You declined this meeting in the demo. In your live dashboard, your Employment Specialist
            can send a new invite.
          </p>
        ) : meetingStatus === "accepted" ? (
          <div className="mt-3 space-y-1 text-sm text-brand-black/85">
            <p className="font-semibold text-brand-black">{DEMO_MEETING.service_name}</p>
            <p>{formatPortalDateTime(DEMO_MEETING.starts_at)}</p>
            <p>{DEMO_MEETING.location}</p>
            <p>With {DEMO_MEETING.es_name}</p>
            <DemoInlineNotice className="mt-4" />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-brand-black/70">
              <span className="font-semibold text-brand-black">Pending invite</span> — review and
              respond below.
            </p>
            <div className="mt-3 space-y-1 text-sm text-brand-black/85">
              <p className="font-semibold text-brand-black">{DEMO_MEETING.service_name}</p>
              <p>{formatPortalDateTime(DEMO_MEETING.starts_at)}</p>
              <p>{DEMO_MEETING.location}</p>
              <p>With {DEMO_MEETING.es_name}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={showDemoActionNotice}
                className="rounded-lg border border-brand-green/40 bg-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5"
              >
                Download calendar invite (.ics)
              </button>
              <button
                type="button"
                onClick={acceptMeeting}
                className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={declineMeeting}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50"
              >
                Decline
              </button>
            </div>
          </>
        )}
      </section>

      <section
        id={IDS.applications}
        aria-labelledby={IDS.applicationsHeading}
        className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h2 id={IDS.applicationsHeading} className="text-lg font-semibold text-brand-green">
          {LABELS.applications}
        </h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Job applications your Employment Specialist has logged for you.
        </p>
        <ul className="mt-4 space-y-3">
          {DEMO_APPLICATIONS.map((app) => {
            const gold = isGoldApplicationStatus(app.status);
            return (
              <li
                key={app.id}
                className="rounded-xl border border-neutral-200 bg-brand-white px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-brand-black">{app.company_name}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      gold
                        ? "bg-brand-gold/15 text-brand-gold"
                        : "bg-brand-green/10 text-brand-green"
                    }`}
                  >
                    {applicationStatusLabel(app.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-black/50">
                  Updated {formatPortalDateTime(app.updated_at)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        id={IDS.activity}
        aria-labelledby={IDS.activityHeading}
        className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h2 id={IDS.activityHeading} className="text-lg font-semibold text-brand-green">
          {LABELS.yourActivity}
        </h2>
        <p className="mt-1 text-sm text-brand-black/70">
          A read-only timeline of notes and applications from your team.
        </p>
        <ClientActivityTimeline feed={DEMO_ACTIVITY_FEED} />
      </section>

      <section
        id={IDS.messages}
        aria-labelledby={IDS.messagesHeading}
        className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h2 id={IDS.messagesHeading} className="text-lg font-semibold text-brand-green">
          {LABELS.messageEs}
        </h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Conversation with {DEMO_MEETING.es_name}. Replies typically arrive within two business
          days.
        </p>
        <div
          className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50/50 p-3"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Message conversation"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.sender_role === "client"
                  ? "ml-8 bg-brand-green/10 text-brand-black"
                  : "mr-8 border border-neutral-200 bg-white text-brand-black"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/50">
                {m.sender_role === "client" ? "You" : (m.sender_name ?? "Employment Specialist")}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              <time className="mt-1 block text-xs text-brand-black/45" dateTime={m.created_at}>
                {formatPortalDateTime(m.created_at)}
              </time>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="flex min-h-[2.75rem] flex-1 flex-col text-sm font-medium text-brand-black">
            <span className="sr-only">Message to your Employment Specialist</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Type your message…"
              aria-label="Message to your Employment Specialist"
              className="min-h-[2.75rem] w-full flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={sendMessage}
            disabled={!draft.trim()}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </section>

      <section
        id={IDS.account}
        aria-labelledby={IDS.accountHeading}
        className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h2 id={IDS.accountHeading} className="text-lg font-semibold text-brand-green">
          {LABELS.account}
        </h2>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={largeText}
              onChange={(e) => setLargeText(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-green"
            />
            Larger text (demo preview)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-green"
            />
            High contrast (demo preview)
          </label>
          <button
            type="button"
            onClick={showDemoActionNotice}
            className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 font-semibold text-brand-black hover:bg-neutral-50"
          >
            Enable push notifications
          </button>
          <button
            type="button"
            onClick={showDemoActionNotice}
            className="block rounded-lg border border-neutral-300 px-4 py-2 font-semibold text-brand-black hover:bg-neutral-50"
          >
            Register a passkey
          </button>
        </div>
      </section>

      <section
        id={IDS.displayAccessibility}
        aria-labelledby={IDS.displayAccessibilityHeading}
        className="rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 id={IDS.displayAccessibilityHeading} className="text-sm font-semibold text-brand-black/60">
          {LABELS.displayAccessibility}
        </h2>
        <p className="mt-2 text-sm text-brand-black/70">
          On the live dashboard, display preferences are saved to your account.
        </p>
      </section>
    </main>
  );
}
