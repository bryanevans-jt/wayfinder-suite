"use client";

import { useCallback, useEffect, useState } from "react";

type TnReportType = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  requiresSignature: boolean;
  counselorAllowed: boolean;
  templateKind: string;
  googleDocTemplateId: string | null;
  blankPdfFileId: string | null;
  driveFolderId: string | null;
  tagSchema: unknown;
  sortOrder: number;
};

type TnProgram = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  sortOrder: number;
  reportTypes: TnReportType[];
};

type Props = {
  onMessage: (message: string) => void;
};

export function TnCatalogAdmin({ onMessage }: Props) {
  const [programs, setPrograms] = useState<TnProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [newTypeByProgram, setNewTypeByProgram] = useState<
    Record<string, { slug: string; name: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tn-catalog");
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load TN catalog");
      const data = (await res.json()) as { programs?: TnProgram[] };
      setPrograms(data.programs ?? []);
    } catch (err) {
      onMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (payload: {
    programs?: Array<{ id: string; enabled?: boolean }>;
    reportTypes?: Array<Partial<TnReportType> & { id: string }>;
    newReportType?: {
      programId: string;
      slug: string;
      name: string;
      enabled?: boolean;
    };
  }) => {
    setSaving(true);
    onMessage("");
    try {
      const res = await fetch("/api/admin/tn-catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      await load();
      onMessage("Tennessee catalog saved");
    } catch (err) {
      onMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateReportTypeLocal = (programId: string, reportTypeId: string, patch: Partial<TnReportType>) => {
    setPrograms((prev) =>
      prev.map((program) =>
        program.id !== programId
          ? program
          : {
              ...program,
              reportTypes: program.reportTypes.map((rt) =>
                rt.id === reportTypeId ? { ...rt, ...patch } : rt
              ),
            }
      )
    );
  };

  if (loading) {
    return (
      <section className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Tennessee VR Programs</h2>
        <p className="text-sm text-gray-500">Loading catalog…</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-2">Tennessee VR Programs</h2>
      <p className="text-sm text-gray-600 mb-4">
        Enable programs and configure report types for Tennessee offices. Programs stay hidden from staff until enabled and at least one report type is configured.
      </p>

      <div className="space-y-4">
        {programs.map((program) => {
          const expanded = expandedProgramId === program.id;
          const draft = newTypeByProgram[program.id] ?? { slug: "", name: "" };

          return (
            <div key={program.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{program.name}</p>
                  <p className="text-xs text-gray-500">{program.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={program.enabled}
                      disabled={saving}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setPrograms((prev) =>
                          prev.map((p) => (p.id === program.id ? { ...p, enabled } : p))
                        );
                        void save({ programs: [{ id: program.id, enabled }] });
                      }}
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    onClick={() => setExpandedProgramId(expanded ? null : program.id)}
                    className="text-sm text-green-700 hover:text-green-800"
                  >
                    {expanded ? "Hide report types" : "Manage report types"}
                  </button>
                </div>
              </div>

              {expanded ? (
                <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                  {program.reportTypes.length === 0 ? (
                    <p className="text-sm text-gray-500">No report types yet.</p>
                  ) : (
                    program.reportTypes.map((reportType) => (
                      <div key={reportType.id} className="rounded-md bg-gray-50 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{reportType.name}</p>
                            <p className="text-xs text-gray-500">{reportType.slug}</p>
                          </div>
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={reportType.requiresSignature}
                              disabled={saving}
                              onChange={(e) => {
                                updateReportTypeLocal(program.id, reportType.id, {
                                  requiresSignature: e.target.checked,
                                });
                                void save({
                                  reportTypes: [
                                    { id: reportType.id, requiresSignature: e.target.checked },
                                  ],
                                });
                              }}
                            />
                            Requires signature
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={reportType.enabled}
                              disabled={saving}
                              onChange={(e) => {
                                updateReportTypeLocal(program.id, reportType.id, {
                                  enabled: e.target.checked,
                                });
                                void save({
                                  reportTypes: [{ id: reportType.id, enabled: e.target.checked }],
                                });
                              }}
                            />
                            Enabled
                          </label>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          <Field
                            label="Google Doc template ID"
                            value={reportType.googleDocTemplateId ?? ""}
                            onChange={(value) =>
                              updateReportTypeLocal(program.id, reportType.id, {
                                googleDocTemplateId: value || null,
                              })
                            }
                            onBlur={() =>
                              void save({
                                reportTypes: [
                                  {
                                    id: reportType.id,
                                    googleDocTemplateId: reportType.googleDocTemplateId,
                                  },
                                ],
                              })
                            }
                          />
                          <Field
                            label="Drive folder ID"
                            value={reportType.driveFolderId ?? ""}
                            onChange={(value) =>
                              updateReportTypeLocal(program.id, reportType.id, {
                                driveFolderId: value || null,
                              })
                            }
                            onBlur={() =>
                              void save({
                                reportTypes: [
                                  { id: reportType.id, driveFolderId: reportType.driveFolderId },
                                ],
                              })
                            }
                          />
                          <Field
                            label="Blank PDF file ID"
                            value={reportType.blankPdfFileId ?? ""}
                            onChange={(value) =>
                              updateReportTypeLocal(program.id, reportType.id, {
                                blankPdfFileId: value || null,
                              })
                            }
                            onBlur={() =>
                              void save({
                                reportTypes: [
                                  { id: reportType.id, blankPdfFileId: reportType.blankPdfFileId },
                                ],
                              })
                            }
                          />
                          <Field
                            label="Template kind"
                            value={reportType.templateKind}
                            onChange={(value) =>
                              updateReportTypeLocal(program.id, reportType.id, {
                                templateKind: value,
                              })
                            }
                            onBlur={() =>
                              void save({
                                reportTypes: [{ id: reportType.id, templateKind: reportType.templateKind }],
                              })
                            }
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Tag schema (JSON)
                          </label>
                          <textarea
                            rows={3}
                            className="w-full rounded border px-2 py-1 text-sm font-mono"
                            defaultValue={JSON.stringify(reportType.tagSchema ?? [], null, 2)}
                            onBlur={(e) => {
                              try {
                                const tagSchema = JSON.parse(e.target.value || "[]");
                                updateReportTypeLocal(program.id, reportType.id, { tagSchema });
                                void save({ reportTypes: [{ id: reportType.id, tagSchema }] });
                              } catch {
                                onMessage("Tag schema must be valid JSON");
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}

                  <div className="rounded-md border border-dashed border-gray-300 p-3">
                    <p className="text-sm font-medium mb-2">Add report type</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Display name"
                        value={draft.name}
                        className="rounded border px-2 py-1 text-sm"
                        onChange={(e) =>
                          setNewTypeByProgram((prev) => ({
                            ...prev,
                            [program.id]: { ...draft, name: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="slug-like-this"
                        value={draft.slug}
                        className="rounded border px-2 py-1 text-sm"
                        onChange={(e) =>
                          setNewTypeByProgram((prev) => ({
                            ...prev,
                            [program.id]: { ...draft, slug: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      disabled={saving || !draft.name.trim() || !draft.slug.trim()}
                      onClick={() => {
                        void save({
                          newReportType: {
                            programId: program.id,
                            name: draft.name.trim(),
                            slug: draft.slug.trim().toLowerCase().replace(/\s+/g, "-"),
                            enabled: false,
                          },
                        });
                        setNewTypeByProgram((prev) => ({
                          ...prev,
                          [program.id]: { slug: "", name: "" },
                        }));
                      }}
                      className="mt-2 rounded bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-600 disabled:opacity-50"
                    >
                      Add report type
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded border px-2 py-1 text-sm"
      />
    </div>
  );
}
