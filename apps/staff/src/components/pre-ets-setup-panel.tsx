"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SetupRow = {
  id: string;
  regional_supervisor_name: string | null;
  school_name: string;
  school_id: string | null;
  district_number: string | null;
  transition_specialist_name: string | null;
  class_days: string | null;
  class_time: string | null;
  frequency: string | null;
  service_code: string | null;
  notes: string | null;
};

const EMPTY_FORM = {
  regionalSupervisorName: "",
  schoolName: "",
  districtNumber: "",
  transitionSpecialistName: "",
  classDays: "",
  classTime: "",
  frequency: "",
  serviceCode: "",
  notes: "",
};

export function PreEtsSetupPanel() {
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/setup");
    const data = (await res.json()) as { rows?: SetupRow[]; error?: string };
    if (res.ok) setRows(data.rows ?? []);
    else setError(data.error ?? "Could not load class setup.");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, SetupRow[]>();
    for (const row of rows) {
      const key = row.regional_supervisor_name?.trim() || "Unassigned supervisor";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function startEdit(row: SetupRow) {
    setEditId(row.id);
    setForm({
      regionalSupervisorName: row.regional_supervisor_name ?? "",
      schoolName: row.school_name,
      districtNumber: row.district_number ?? "",
      transitionSpecialistName: row.transition_specialist_name ?? "",
      classDays: row.class_days ?? "",
      classTime: row.class_time ?? "",
      frequency: row.frequency ?? "",
      serviceCode: row.service_code ?? "",
      notes: row.notes ?? "",
    });
  }

  function resetForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  async function saveRow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/pre-ets/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId ?? undefined, ...form }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save row.");
      return;
    }
    setMessage(editId ? "Setup row updated." : "Setup row added.");
    resetForm();
    void load();
  }

  async function removeRow(id: string) {
    setError(null);
    const res = await fetch(`/api/pre-ets/setup?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete row.");
      return;
    }
    if (editId === id) resetForm();
    void load();
  }

  async function importCsv(applyAssignments: boolean) {
    if (!csvText.trim()) {
      setError("Paste CSV rows first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/pre-ets/setup/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText, applyAssignments }),
    });
    const data = (await res.json()) as {
      imported?: number;
      errors?: string[];
      assignmentsApplied?: number;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed.");
      return;
    }
    const errNote =
      data.errors?.length ? ` ${data.errors.length} row(s) skipped.` : "";
    setMessage(
      `Imported ${data.imported ?? 0} row(s).` +
        (applyAssignments ? ` Applied ${data.assignmentsApplied ?? 0} assignment(s).` : "") +
        errNote
    );
    setCsvText("");
    void load();
  }

  async function applyAssignments() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pre-ets/setup/apply-assignments", { method: "POST" });
    const data = (await res.json()) as { applied?: number; error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not apply assignments.");
      return;
    }
    setMessage(`Applied ${data.applied ?? 0} school assignment(s) from linked setup rows.`);
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Class setup</h2>
        <p className="mt-1 max-w-3xl text-sm text-brand-black/65">
          Plan schools, Transition Specialists, and requested class days/times before Accounts
          uploads district worksheets. When a worksheet is committed, matching schools link
          automatically and TS/supervisor assignments can sync to staff assignments.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p className="font-medium text-brand-black">Bulk import CSV</p>
        <p className="mt-1 text-brand-black/60">
          Header row: Regional Supervisor, School, District #, Transition Specialist, Class Days,
          Class Time, Frequency, Service Code, Notes
        </p>
        <textarea
          className="mt-3 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
          rows={5}
          placeholder={`Regional Supervisor,School,District #,Transition Specialist,Class Days,Class Time\nJane Supervisor,Example High,12,Alex Instructor,"Tuesday; Thursday",10:00 AM`}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
            onClick={() => void importCsv(false)}
          >
            Import rows
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white"
            onClick={() => void importCsv(true)}
          >
            Import + apply linked assignments
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-gold"
            onClick={() => void applyAssignments()}
          >
            Apply linked assignments
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold text-brand-black">{editId ? "Edit row" : "Add row"}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(
            [
              ["regionalSupervisorName", "Regional Supervisor"],
              ["schoolName", "School"],
              ["districtNumber", "District #"],
              ["transitionSpecialistName", "Transition Specialist"],
              ["classDays", "Class days"],
              ["classTime", "Class time"],
              ["frequency", "Frequency"],
              ["serviceCode", "Service code"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="font-medium">{label}</span>
              <input
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="block text-sm md:col-span-2">
            <span className="font-medium">Notes</span>
            <textarea
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !form.schoolName.trim()}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void saveRow()}
          >
            {editId ? "Save changes" : "Add row"}
          </button>
          {editId ? (
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-brand-black/55">No class setup rows yet.</p>
      ) : (
        grouped.map(([supervisor, groupRows]) => (
          <div key={supervisor} className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2">
              <h3 className="font-semibold text-brand-black">{supervisor}</h3>
              <p className="text-xs text-brand-black/60">{groupRows.length} school(s)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-brand-black/70">
                  <tr>
                    <th className="px-3 py-2">School</th>
                    <th className="px-3 py-2">Transition Specialist</th>
                    <th className="px-3 py-2">Class days</th>
                    <th className="px-3 py-2">Class time</th>
                    <th className="px-3 py-2">Linked</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => (
                    <tr key={row.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2">
                        {row.school_name}
                        {row.district_number ? (
                          <span className="block text-xs text-brand-black/50">
                            District {row.district_number}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{row.transition_specialist_name ?? "—"}</td>
                      <td className="px-3 py-2">{row.class_days ?? "—"}</td>
                      <td className="px-3 py-2">{row.class_time ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.school_id ? (
                          <span className="text-brand-green">School linked</span>
                        ) : (
                          <span className="text-brand-black/50">Awaiting worksheet</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="mr-3 text-xs font-medium text-brand-green hover:underline"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 hover:underline"
                          onClick={() => void removeRow(row.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {message ? <p className="text-sm text-brand-green">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
