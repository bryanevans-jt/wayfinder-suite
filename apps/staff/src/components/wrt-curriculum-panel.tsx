"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type WrtBlockType,
  type WrtModuleWithLessons,
  youtubeEmbedUrl,
} from "@wayfinder/supabase/staff-wrt-shared";

const BLOCK_TYPES: { value: WrtBlockType; label: string }[] = [
  { value: "rich_text", label: "Text" },
  { value: "youtube", label: "YouTube" },
  { value: "pdf_link", label: "PDF link" },
  { value: "activity", label: "Activity" },
  { value: "quiz", label: "Quiz" },
  { value: "external_link", label: "Link" },
];

export function WrtCurriculumPanel() {
  const [modules, setModules] = useState<WrtModuleWithLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDuration, setLessonDuration] = useState("30");
  const [blockType, setBlockType] = useState<WrtBlockType>("rich_text");
  const [blockTitle, setBlockTitle] = useState("");
  const [blockBody, setBlockBody] = useState("");
  const [blockUrl, setBlockUrl] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wrt/curriculum");
      const data = (await res.json()) as { modules?: WrtModuleWithLessons[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load curriculum.");
      setModules(data.modules ?? []);
      if (!selectedModuleId && data.modules?.[0]) {
        setSelectedModuleId(data.modules[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load curriculum.");
    } finally {
      setLoading(false);
    }
  }, [selectedModuleId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;
  const selectedLesson =
    selectedModule?.lessons.find((l) => l.id === selectedLessonId) ??
    selectedModule?.lessons[0] ??
    null;

  useEffect(() => {
    if (selectedModule && selectedLesson && selectedLesson.module_id === selectedModule.id) return;
    if (selectedModule?.lessons[0]) {
      setSelectedLessonId(selectedModule.lessons[0].id);
    } else {
      setSelectedLessonId(null);
    }
  }, [selectedModule, selectedLesson]);

  async function addModule() {
    if (!moduleTitle.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/wrt/curriculum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: moduleTitle.trim() }),
    });
    const data = (await res.json()) as { module?: { id: string }; error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add module.");
      return;
    }
    setModuleTitle("");
    setMessage("Module added.");
    await refresh();
    if (data.module?.id) setSelectedModuleId(data.module.id);
  }

  async function deleteModule(id: string) {
    if (!confirm("Delete this module and all of its lessons?")) return;
    setBusy(true);
    const res = await fetch(`/api/wrt/curriculum/modules/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete module.");
      return;
    }
    setSelectedModuleId(null);
    setMessage("Module deleted.");
    await refresh();
  }

  async function addLesson() {
    if (!selectedModuleId || !lessonTitle.trim()) return;
    setBusy(true);
    const res = await fetch("/api/wrt/curriculum/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_id: selectedModuleId,
        title: lessonTitle.trim(),
        default_duration_minutes: Number(lessonDuration) || 30,
      }),
    });
    const data = (await res.json()) as { lesson?: { id: string }; error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add lesson.");
      return;
    }
    setLessonTitle("");
    setMessage("Lesson added.");
    await refresh();
    if (data.lesson?.id) setSelectedLessonId(data.lesson.id);
  }

  async function deleteLesson(id: string) {
    if (!confirm("Delete this lesson?")) return;
    setBusy(true);
    const res = await fetch(`/api/wrt/curriculum/lessons/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete lesson.");
      return;
    }
    setSelectedLessonId(null);
    setMessage("Lesson deleted.");
    await refresh();
  }

  async function saveLessonField(patch: Record<string, unknown>) {
    if (!selectedLesson) return;
    setBusy(true);
    const res = await fetch(`/api/wrt/curriculum/lessons/${selectedLesson.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not save lesson.");
      return;
    }
    setMessage("Lesson saved.");
    await refresh();
  }

  async function saveModuleField(patch: Record<string, unknown>) {
    if (!selectedModule) return;
    setBusy(true);
    const res = await fetch(`/api/wrt/curriculum/modules/${selectedModule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not save module.");
      return;
    }
    setMessage("Module saved.");
    await refresh();
  }

  async function addBlock() {
    if (!selectedLesson) return;
    setBusy(true);
    const res = await fetch("/api/wrt/curriculum/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_id: selectedLesson.id,
        block_type: blockType,
        title: blockTitle.trim() || null,
        body: blockBody.trim() || null,
        url: blockUrl.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not add block.");
      return;
    }
    setBlockTitle("");
    setBlockBody("");
    setBlockUrl("");
    setMessage("Block added.");
    await refresh();
  }

  async function deleteBlock(id: string) {
    if (!confirm("Delete this block?")) return;
    setBusy(true);
    const res = await fetch(`/api/wrt/curriculum/blocks/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete block.");
      return;
    }
    setMessage("Block deleted.");
    await refresh();
  }

  return (
    <section className="mt-10 max-w-5xl rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">WRT Curriculum</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
            Admin preview — edit modules and lessons. Not shown to clients or field staff yet.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void refresh()}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-brand-black/60">Loading…</p> : null}
      {message ? <p className="mt-3 text-sm text-brand-green">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_200px_1fr]">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/55">Modules</p>
          <ul className="mt-2 space-y-1">
            {modules.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedModuleId(m.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    selectedModuleId === m.id
                      ? "bg-brand-green text-white"
                      : "hover:bg-neutral-100 text-brand-black"
                  }`}
                >
                  {m.title}
                  {m.is_optional ? " *" : ""}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            <input
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              placeholder="New module title"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !moduleTitle.trim()}
              onClick={() => void addModule()}
              className="w-full rounded-lg bg-brand-green px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Add Module
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/55">Lessons</p>
          {selectedModule ? (
            <>
              <ul className="mt-2 space-y-1">
                {selectedModule.lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedLessonId(l.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        selectedLesson?.id === l.id
                          ? "bg-brand-green text-white"
                          : "hover:bg-neutral-100 text-brand-black"
                      }`}
                    >
                      {l.title}
                      {l.is_optional ? " *" : ""}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                <input
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                  placeholder="New lesson title"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                />
                <input
                  type="number"
                  min={1}
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                  value={lessonDuration}
                  onChange={(e) => setLessonDuration(e.target.value)}
                  title="Duration (minutes)"
                />
                <button
                  type="button"
                  disabled={busy || !lessonTitle.trim()}
                  onClick={() => void addLesson()}
                  className="w-full rounded-lg bg-brand-green px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Add Lesson
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-brand-black/55">Select a module.</p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          {selectedModule && selectedLesson ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-brand-black">{selectedLesson.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-neutral-300 px-2 py-1 text-xs font-semibold"
                    onClick={() => void deleteLesson(selectedLesson.id)}
                  >
                    Delete Lesson
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-800"
                    onClick={() => void deleteModule(selectedModule.id)}
                  >
                    Delete Module
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="font-medium">Module title</span>
                <input
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                  defaultValue={selectedModule.title}
                  key={`mod-title-${selectedModule.id}-${selectedModule.updated_at}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== selectedModule.title) {
                      void saveModuleField({ title: e.target.value.trim() });
                    }
                  }}
                />
              </label>

              <label className="block">
                <span className="font-medium">Lesson title</span>
                <input
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                  defaultValue={selectedLesson.title}
                  key={`les-title-${selectedLesson.id}-${selectedLesson.updated_at}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== selectedLesson.title) {
                      void saveLessonField({ title: e.target.value.trim() });
                    }
                  }}
                />
              </label>

              <label className="block">
                <span className="font-medium">Objectives</span>
                <textarea
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                  rows={2}
                  defaultValue={selectedLesson.objectives ?? ""}
                  key={`obj-${selectedLesson.id}-${selectedLesson.updated_at}`}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedLesson.objectives ?? "")) {
                      void saveLessonField({ objectives: e.target.value });
                    }
                  }}
                />
              </label>

              <label className="block">
                <span className="font-medium">Facilitator notes</span>
                <textarea
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                  rows={3}
                  defaultValue={selectedLesson.facilitator_notes ?? ""}
                  key={`notes-${selectedLesson.id}-${selectedLesson.updated_at}`}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedLesson.facilitator_notes ?? "")) {
                      void saveLessonField({ facilitator_notes: e.target.value });
                    }
                  }}
                />
              </label>

              <label className="block">
                <span className="font-medium">Default minutes</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-32 rounded border border-neutral-300 px-2 py-1.5"
                  defaultValue={selectedLesson.default_duration_minutes}
                  key={`dur-${selectedLesson.id}-${selectedLesson.updated_at}`}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n && n !== selectedLesson.default_duration_minutes) {
                      void saveLessonField({ default_duration_minutes: n });
                    }
                  }}
                />
              </label>

              <div>
                <p className="font-medium">Content blocks</p>
                <ul className="mt-2 space-y-3">
                  {selectedLesson.blocks.map((b) => {
                    const embed = b.block_type === "youtube" && b.url ? youtubeEmbedUrl(b.url) : null;
                    return (
                      <li key={b.id} className="rounded-md border border-neutral-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase text-brand-black/50">
                              {b.block_type}
                            </p>
                            {b.title ? <p className="font-medium">{b.title}</p> : null}
                            {b.body ? (
                              <p className="mt-1 whitespace-pre-wrap text-brand-black/75">{b.body}</p>
                            ) : null}
                            {b.url && b.block_type !== "youtube" ? (
                              <a
                                href={b.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-brand-green underline"
                              >
                                Open link
                              </a>
                            ) : null}
                            {embed ? (
                              <div className="mt-2 aspect-video max-w-lg overflow-hidden rounded-lg border border-neutral-200">
                                <iframe
                                  title={b.title ?? "YouTube"}
                                  src={embed}
                                  className="h-full w-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : null}
                            {b.block_type === "quiz" && Array.isArray(b.meta?.questions) ? (
                              <ol className="mt-2 list-decimal space-y-1 pl-5 text-brand-black/75">
                                {(b.meta.questions as { q: string }[]).map((q, i) => (
                                  <li key={i}>{q.q}</li>
                                ))}
                              </ol>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-xs font-semibold text-red-700"
                            onClick={() => void deleteBlock(b.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-md border border-dashed border-neutral-300 p-3 space-y-2">
                <p className="font-medium">Add block</p>
                <select
                  className="w-full rounded border border-neutral-300 px-2 py-1.5"
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as WrtBlockType)}
                >
                  {BLOCK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded border border-neutral-300 px-2 py-1.5"
                  placeholder="Title (optional)"
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                />
                {(blockType === "youtube" ||
                  blockType === "pdf_link" ||
                  blockType === "external_link") && (
                  <input
                    className="w-full rounded border border-neutral-300 px-2 py-1.5"
                    placeholder={
                      blockType === "youtube" ? "YouTube URL" : "https://…"
                    }
                    value={blockUrl}
                    onChange={(e) => setBlockUrl(e.target.value)}
                  />
                )}
                {(blockType === "rich_text" ||
                  blockType === "activity" ||
                  blockType === "external_link") && (
                  <textarea
                    className="w-full rounded border border-neutral-300 px-2 py-1.5"
                    rows={3}
                    placeholder="Body"
                    value={blockBody}
                    onChange={(e) => setBlockBody(e.target.value)}
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addBlock()}
                  className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Add Block
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-brand-black/55">Select a module and lesson to edit.</p>
          )}
        </div>
      </div>
    </section>
  );
}
