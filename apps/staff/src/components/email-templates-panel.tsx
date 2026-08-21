"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TemplateRow = {
  key: string;
  name: string;
  category: string;
  kind: "flat" | "referral_sectional";
  description: string;
  mergeTags: { tag: string; label: string }[];
  defaults: { subject: string; body?: string; intro?: string; closing?: string };
  subject: string;
  body: string;
  intro: string;
  closing: string;
  isCustomized: boolean;
  updatedAt: string | null;
};

export function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [intro, setIntro] = useState("");
  const [closing, setClosing] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/email-templates");
      const data = (await res.json()) as { templates?: TemplateRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load templates");
      const rows = data.templates ?? [];
      setTemplates(rows);
      setSelectedKey((prev) => prev ?? rows[0]?.key ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => templates.find((t) => t.key === selectedKey) ?? null,
    [templates, selectedKey]
  );

  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject);
    setBody(selected.body);
    setIntro(selected.intro);
    setClosing(selected.closing);
    setStatus(null);
    setError(null);
  }, [selected]);

  const categories = useMemo(() => {
    const map = new Map<string, TemplateRow[]>();
    for (const t of templates) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()];
  }, [templates]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/portal/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selected.key,
          subject,
          body: selected.kind === "flat" ? body : undefined,
          intro: selected.kind === "referral_sectional" ? intro : undefined,
          closing: selected.kind === "referral_sectional" ? closing : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    if (!selected) return;
    if (!window.confirm(`Reset “${selected.name}” to the built-in default?`)) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/portal/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selected.key, reset: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setStatus("Reset to default.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!selected) return;
    setTesting(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/portal/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selected.key,
          subject,
          bodyText: selected.kind === "flat" ? body : undefined,
          intro: selected.kind === "referral_sectional" ? intro : undefined,
          closing: selected.kind === "referral_sectional" ? closing : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; to?: string };
      if (!res.ok) throw new Error(data.error || "Test send failed");
      setStatus(`Test email sent to ${data.to}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading email templates…</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Email Templates</h2>
        <p className="mt-1 max-w-3xl text-sm text-brand-black/75">
          Edit subject lines and body copy for automated emails. Use merge tags like{" "}
          <code className="rounded bg-neutral-100 px-1">{"{{client_name}}"}</code>. Referral
          confirmation emails keep the auto-filled details block fixed — only subject, intro, and
          closing are editable there.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3">
          {categories.map(([category, rows]) => (
            <div key={category} className="mb-3">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-brand-black/45">
                {category}
              </p>
              <ul className="mt-1 space-y-0.5">
                {rows.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(t.key)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                        selectedKey === t.key
                          ? "bg-brand-green/10 font-semibold text-brand-green"
                          : "text-brand-black/80 hover:bg-neutral-50"
                      }`}
                    >
                      {t.name}
                      {t.isCustomized ? (
                        <span className="ml-1 text-[10px] font-medium uppercase text-brand-gold">
                          edited
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          {!selected ? (
            <p className="text-sm text-brand-black/60">Select a template.</p>
          ) : (
            <>
              <div>
                <h3 className="text-base font-semibold text-brand-black">{selected.name}</h3>
                <p className="mt-1 text-sm text-brand-black/70">{selected.description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/45">
                  Merge tags
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selected.mergeTags.map((tag) => (
                    <button
                      key={tag.tag}
                      type="button"
                      title={tag.label}
                      onClick={() => {
                        const snippet = `{{${tag.tag}}}`;
                        void navigator.clipboard?.writeText(snippet);
                        setStatus(`Copied ${snippet}`);
                      }}
                      className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-brand-black/80 hover:bg-neutral-100"
                    >
                      {`{{${tag.tag}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm">
                <span className="font-medium">Subject</span>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>

              {selected.kind === "referral_sectional" ? (
                <>
                  <label className="block text-sm">
                    <span className="font-medium">Intro / thank-you</span>
                    <textarea
                      className="mt-1 min-h-[6rem] w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm"
                      value={intro}
                      onChange={(e) => setIntro(e.target.value)}
                    />
                  </label>
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm text-brand-black/65">
                    <p className="font-medium text-brand-black/80">Fixed referral details block</p>
                    <p className="mt-1">
                      Counselor, client, service, and uploaded-file fields are inserted automatically
                      here and cannot be edited in this template.
                    </p>
                  </div>
                  <label className="block text-sm">
                    <span className="font-medium">Closing</span>
                    <textarea
                      className="mt-1 min-h-[4rem] w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm"
                      value={closing}
                      onChange={(e) => setClosing(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <label className="block text-sm">
                  <span className="font-medium">Body</span>
                  <textarea
                    className="mt-1 min-h-[16rem] w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save template"}
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => void sendTest()}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50 disabled:opacity-60"
                >
                  {testing ? "Sending…" : "Send test to my email"}
                </button>
                <button
                  type="button"
                  disabled={saving || !selected.isCustomized}
                  onClick={() => void resetToDefault()}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black/70 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Reset to default
                </button>
              </div>

              {status ? <p className="text-sm text-emerald-800">{status}</p> : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
