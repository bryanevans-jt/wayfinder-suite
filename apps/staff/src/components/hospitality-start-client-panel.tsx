"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  HospitalityCounselorOption,
  HospitalityOfficeOption,
  HospitalitySupervisorOption,
} from "@/lib/hospitality-intake-options";

type Props = {
  clientId: string;
  initialOfficeId: string | null;
  initialCounselorId: string | null;
  supervisors: HospitalitySupervisorOption[];
  offices: HospitalityOfficeOption[];
  counselors: HospitalityCounselorOption[];
};

export function HospitalityStartClientPanel({
  clientId,
  initialOfficeId,
  initialCounselorId,
  supervisors,
  offices,
  counselors,
}: Props) {
  const router = useRouter();
  const inferredSupervisorId =
    supervisors.find((s) => s.primaryOfficeId && s.primaryOfficeId === initialOfficeId)?.id ?? "";

  const [supervisorQuery, setSupervisorQuery] = useState("");
  const [supervisorUserId, setSupervisorUserId] = useState(inferredSupervisorId);
  const [officeId, setOfficeId] = useState(initialOfficeId ?? "");
  const [counselorId, setCounselorId] = useState(initialCounselorId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filteredSupervisors = useMemo(() => {
    const q = supervisorQuery.trim().toLowerCase();
    if (!q) return supervisors;
    return supervisors.filter((s) => s.name.toLowerCase().includes(q));
  }, [supervisors, supervisorQuery]);

  function pickSupervisor(id: string) {
    setSupervisorUserId(id);
    const match = supervisors.find((s) => s.id === id);
    if (match?.primaryOfficeId) {
      setOfficeId(match.primaryOfficeId);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          action: "update_info",
          info: {
            supervisorUserId: supervisorUserId || null,
            officeId: officeId || null,
            counselorId: counselorId || null,
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-brand-black">Start Client</h3>
        <p className="mt-1 text-sm text-brand-black/65">
          Assign a supervisor (sets their office), then adjust office or counselor if needed.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Search supervisors</span>
        <input
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={supervisorQuery}
          onChange={(e) => setSupervisorQuery(e.target.value)}
          placeholder="Type a name…"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Supervisor</span>
        <select
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={supervisorUserId}
          onChange={(e) => pickSupervisor(e.target.value)}
        >
          <option value="">Select a supervisor</option>
          {filteredSupervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {!s.primaryOfficeId ? " (no office)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">Office</span>
        <select
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
        >
          <option value="">No office</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.state ? ` · ${o.state}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">Counselor</span>
        <select
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={counselorId}
          onChange={(e) => setCounselorId(e.target.value)}
        >
          <option value="">No counselor</option>
          {counselors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.email ? ` · ${c.email}` : ""}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-brand-green">Assignment saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save assignment"}
      </button>
    </form>
  );
}
