"use client";

import { useEffect, useId, useRef, useState } from "react";

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
    body: "Clients can use Messages to write to their Employment Specialist. Natural supports can review progress and activity for the people they help. Specialists aim to reply within about two business days.",
  },
  {
    title: "Turn on reminders",
    body: "If you see a prompt to enable notifications, tap Allow so you do not miss meeting reminders on this device.",
  },
] as const;

export function ClientOnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

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

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusable = node?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = [
        ...node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
    // finish is stable enough for close; avoid re-binding every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

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
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-brand-green">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id={titleId} className="mt-2 text-xl font-semibold text-brand-black">
          {current.title}
        </h2>
        <p id={descId} className="mt-3 text-sm text-brand-black/80">
          {current.body}
        </p>
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
