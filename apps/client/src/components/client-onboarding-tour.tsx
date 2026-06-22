"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wayfinder_client_onboarding_v1";

const STEPS = [
  {
    title: "Welcome to Wayfinder",
    body: "This is your personal dashboard. Here you can see your progress, upcoming meetings, and job applications.",
  },
  {
    title: "Your success path",
    body: "The steps at the top show where you are in your employment journey. Your Employment Specialist updates these as you move forward.",
  },
  {
    title: "Stay in touch",
    body: "Use Messages to write to your Employment Specialist. They aim to reply within about two business days.",
  },
  {
    title: "Turn on reminders",
    body: "If you see a prompt to enable notifications, tap Allow so you do not miss meeting reminders on this device.",
  },
] as const;

export function ClientOnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "done") {
        return;
      }
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) {
    return null;
  }

  const current = STEPS[step]!;
  const isLast = step >= STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-green">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="onboarding-title" className="mt-2 text-xl font-semibold text-brand-black">
          {current.title}
        </h2>
        <p className="mt-3 text-sm text-brand-black/80">{current.body}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={finish}
            className="rounded-lg px-3 py-2 text-sm font-medium text-brand-black/60 hover:text-brand-black"
          >
            Skip tour
          </button>
          <div className="flex-1" />
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
