"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  full_name: string;
  position: string;
  city: string | null;
  birthday_display: string | null;
  work_anniversary_display: string | null;
  birthday?: string | null;
  work_start_date?: string | null;
  job_title?: string | null;
  can_edit_job_title?: boolean;
};

export function TeamDirectoryWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    birthday: "",
    work_start_date: "",
    job_title: "",
  });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/team-directory");
    const data = (await res.json()) as {
      members?: Member[];
      can_manage?: boolean;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not load directory");
      return;
    }
    setMembers(data.members ?? []);
    setCanManage(data.can_manage === true);
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function startEdit(m: Member) {
    setEditingId(m.id);
    setDraft({
      birthday: m.birthday ?? "",
      work_start_date: m.work_start_date ?? "",
      job_title: m.job_title ?? "",
    });
    setSaveStatus(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaveStatus(null);
    const res = await fetch("/api/team-directory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: editingId,
        birthday: draft.birthday || null,
        work_start_date: draft.work_start_date || null,
        ...(members.find((m) => m.id === editingId)?.can_edit_job_title
          ? { job_title: draft.job_title || null }
          : {}),
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setSaveStatus(data.error || "Save failed");
      return;
    }
    setEditingId(null);
    await load();
    setSaveStatus("Saved.");
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading Team Directory…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-brand-black">Team Directory</h1>
        <p className="mt-1 text-sm text-brand-black/70">
          Active teammates only. Birthdays and work anniversaries show as month/day — never age.
        </p>
      </header>

      {canManage ? (
        <p className="text-sm text-brand-black/65">
          As HR Director or Super Admin, you can set birthday and work start date (manual — never
          auto-filled on hire). Job title is editable for Admin profiles.
        </p>
      ) : null}

      {saveStatus ? <p className="text-sm text-brand-black/70">{saveStatus}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Position</th>
              <th className="px-3 py-2 font-medium">City</th>
              <th className="px-3 py-2 font-medium">Birthday</th>
              <th className="px-3 py-2 font-medium">Work Anniversary</th>
              {canManage ? <th className="px-3 py-2 font-medium">Edit</th> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium text-brand-black">{m.full_name}</td>
                <td className="px-3 py-2">{m.position}</td>
                <td className="px-3 py-2">{m.city ?? "—"}</td>
                <td className="px-3 py-2">{m.birthday_display ?? "—"}</td>
                <td className="px-3 py-2">{m.work_anniversary_display ?? "—"}</td>
                {canManage ? (
                  <td className="px-3 py-2">
                    {editingId === m.id ? (
                      <div className="flex min-w-[14rem] flex-col gap-2">
                        <label className="text-xs">
                          Birthday
                          <input
                            type="date"
                            value={draft.birthday}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, birthday: e.target.value }))
                            }
                            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
                          />
                        </label>
                        <label className="text-xs">
                          Work Start Date
                          <input
                            type="date"
                            value={draft.work_start_date}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, work_start_date: e.target.value }))
                            }
                            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
                          />
                        </label>
                        {m.can_edit_job_title ? (
                          <label className="text-xs">
                            Job Title
                            <input
                              type="text"
                              value={draft.job_title}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, job_title: e.target.value }))
                              }
                              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
                              placeholder="e.g. COO"
                            />
                          </label>
                        ) : null}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit()}
                            className="rounded bg-brand-green px-2 py-1 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded border border-neutral-300 px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="text-xs font-medium text-brand-green hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 6 : 5}
                  className="px-3 py-6 text-center text-brand-black/55"
                >
                  No active teammates found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
