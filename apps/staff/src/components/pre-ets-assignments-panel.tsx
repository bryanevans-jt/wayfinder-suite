"use client";

import { useCallback, useEffect, useState } from "react";

type School = { id: string; name: string };
type Staff = { id: string; full_name: string | null; role: string };
type Assignment = {
  id: string;
  school_id: string;
  user_id: string;
  assignment_role: string;
  pre_ets_schools: { name: string } | { name: string }[] | null;
  profiles: { full_name: string | null; role: string } | { full_name: string | null; role: string }[] | null;
};

function relationName(
  raw: { name: string } | { name: string }[] | null | undefined
): string {
  if (!raw) return "—";
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw.name;
}

function profileName(
  raw: { full_name: string | null } | { full_name: string | null }[] | null | undefined
): string {
  if (!raw) return "—";
  if (Array.isArray(raw)) return raw[0]?.full_name ?? "—";
  return raw.full_name ?? "—";
}

export function PreEtsAssignmentsPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [userId, setUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"primary" | "co_instructor" | "supervisor">(
    "primary"
  );
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [schoolRes, staffRes, assignRes] = await Promise.all([
      fetch("/api/pre-ets/schools"),
      fetch("/api/pre-ets/instructors"),
      fetch("/api/pre-ets/staff-assignments"),
    ]);
    const schoolData = (await schoolRes.json()) as { schools?: School[] };
    const staffData = (await staffRes.json()) as { staff?: Staff[] };
    const assignData = (await assignRes.json()) as { assignments?: Assignment[] };
    if (schoolRes.ok) setSchools(schoolData.schools ?? []);
    if (staffRes.ok) setStaff(staffData.staff ?? []);
    if (assignRes.ok) setAssignments(assignData.assignments ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAssignment() {
    if (!schoolId || !userId) return;
    setMessage(null);
    const res = await fetch("/api/pre-ets/staff-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, userId, assignmentRole }),
    });
    const data = (await res.json()) as { error?: string };
    setMessage(res.ok ? "Assignment saved." : data.error ?? "Could not save assignment.");
    void load();
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/pre-ets/staff-assignments?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    void load();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Staff school assignments</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Assign instructors and ES staff to schools. When assignments exist, field staff only see
          sessions for their assigned schools.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm md:grid-cols-4">
        <label className="block">
          <span className="font-medium">School</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">Select school…</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Staff member</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Select staff…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.id.slice(0, 8)} ({s.role})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Role</span>
          <select
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5"
            value={assignmentRole}
            onChange={(e) =>
              setAssignmentRole(e.target.value as "primary" | "co_instructor" | "supervisor")
            }
          >
            <option value="primary">Primary instructor</option>
            <option value="co_instructor">Co-instructor</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void addAssignment()}
          >
            Add assignment
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-brand-black/70">{message}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Assignment role</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-brand-black/55">
                  No staff assignments yet. Instructors see all schools until assignments are added.
                </td>
              </tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{relationName(a.pre_ets_schools)}</td>
                  <td className="px-3 py-2">{profileName(a.profiles)}</td>
                  <td className="px-3 py-2 capitalize">{a.assignment_role.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      onClick={() => void removeAssignment(a.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
