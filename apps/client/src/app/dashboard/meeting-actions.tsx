"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  meetingId: string;
  status: string;
  startsAt: string;
  location: string;
  title: string;
};

export function MeetingActions({ meetingId, status, startsAt, location, title }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      router.refresh();
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <a
        href={`/api/meetings/ics?id=${encodeURIComponent(meetingId)}`}
        className="rounded-lg border border-brand-green/40 bg-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5"
      >
        Download calendar invite (.ics)
      </a>
      {status === "pending" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("accept")}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("decline")}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50 disabled:opacity-60"
          >
            Decline
          </button>
        </>
      ) : null}
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
      <p className="sr-only">
        {title} at {startsAt} in {location}
      </p>
    </div>
  );
}
