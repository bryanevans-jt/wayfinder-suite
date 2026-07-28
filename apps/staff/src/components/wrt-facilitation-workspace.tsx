"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type WrtDeliveryMode,
  type WrtEnrollmentRow,
  type WrtModuleWithLessons,
  type WrtSessionRow,
  youtubeEmbedUrl,
} from "@wayfinder/supabase/staff-wrt-shared";

type ClientOption = { id: string; name: string };

type Snapshot = {
  enrollment: WrtEnrollmentRow | null;
  moduleIds: string[];
  completedLessonIds: string[];
  completedHours: number;
  remainingHours: number | null;
  curriculum: WrtModuleWithLessons[];
  upcomingSessions: Array<
    WrtSessionRow & { lesson_title: string | null; attendance: string | null }
  >;
  clientName: string;
};

type GroupMember = {
  clientId: string;
  name: string;
  enrollmentId: string | null;
  attendance: "present" | "absent";
  durationMinutes: string;
  startTime: string;
  endTime: string;
  lessonCompleted: boolean;
};

export function WrtFacilitationWorkspace() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deliveryMode, setDeliveryMode] = useState<WrtDeliveryMode>("in_person");
  const [requestedHours, setRequestedHours] = useState("20");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const [moduleId, setModuleId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  const [sessionMinutes, setSessionMinutes] = useState("30");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [markComplete, setMarkComplete] = useState(true);

  const [scheduleStart, setScheduleStart] = useState("");
  const [zoomUrl, setZoomUrl] = useState("");

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupQuery, setGroupQuery] = useState("");

  const loadClients = useCallback(async (q: string) => {
    const res = await fetch(`/api/wrt/facilitation?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as { clients?: ClientOption[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Could not load clients.");
    setClients(data.clients ?? []);
  }, []);

  const loadSnapshot = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wrt/facilitation?clientId=${encodeURIComponent(id)}`);
      const data = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load client WRT data.");
      setSnap(data);
      setSelectedModules(data.moduleIds ?? []);
      setDeliveryMode(data.enrollment?.delivery_mode ?? "in_person");
      setRequestedHours(
        data.enrollment ? String(data.enrollment.requested_hours) : "20"
      );
      const firstAssigned =
        data.curriculum.find((m) => data.moduleIds.includes(m.id)) ?? data.curriculum[0];
      setModuleId(firstAssigned?.id ?? null);
      setLessonId(firstAssigned?.lessons[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients("").catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load clients.")
    );
  }, [loadClients]);

  useEffect(() => {
    if (!clientId) {
      setSnap(null);
      return;
    }
    void loadSnapshot(clientId);
  }, [clientId, loadSnapshot]);

  const selectedModule = useMemo(
    () => snap?.curriculum.find((m) => m.id === moduleId) ?? null,
    [snap, moduleId]
  );
  const selectedLesson = useMemo(
    () => selectedModule?.lessons.find((l) => l.id === lessonId) ?? null,
    [selectedModule, lessonId]
  );

  const assignedCurriculum = useMemo(() => {
    if (!snap?.enrollment) return snap?.curriculum ?? [];
    return (snap.curriculum ?? []).filter((m) => snap.moduleIds.includes(m.id));
  }, [snap]);

  async function enroll() {
    if (!clientId) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/wrt/facilitation/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        deliveryMode,
        requestedHours: Number(requestedHours) || 0,
        moduleIds: selectedModules,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not enroll.");
      return;
    }
    setMessage("WRT enrollment created (preview).");
    await loadSnapshot(clientId);
  }

  async function saveEnrollment() {
    if (!snap?.enrollment) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/wrt/facilitation/enroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: snap.enrollment.id,
        moduleIds: selectedModules,
        requestedHours: Number(requestedHours) || 0,
        deliveryMode,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    setMessage("Enrollment updated.");
    await loadSnapshot(clientId!);
  }

  async function endEnrollment() {
    if (!snap?.enrollment) return;
    if (!confirm("End this WRT enrollment?")) return;
    setBusy(true);
    const res = await fetch("/api/wrt/facilitation/enroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId: snap.enrollment.id, action: "end" }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not end enrollment.");
      return;
    }
    setMessage("Enrollment ended.");
    await loadSnapshot(clientId!);
  }

  function buildAttendees(): GroupMember[] {
    if (groupMembers.length > 0) return groupMembers;
    if (!clientId || !snap) return [];
    return [
      {
        clientId,
        name: snap.clientName,
        enrollmentId: snap.enrollment?.id ?? null,
        attendance: "present",
        durationMinutes: sessionMinutes,
        startTime,
        endTime,
        lessonCompleted: markComplete,
      },
    ];
  }

  async function runSession() {
    if (!clientId || !snap?.enrollment) return;
    const attendees = buildAttendees();
    if (attendees.length === 0) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/wrt/facilitation/sessions/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId,
        deliveryMode: snap.enrollment.delivery_mode,
        attendees: attendees.map((a) => ({
          clientId: a.clientId,
          enrollmentId: a.enrollmentId,
          attendance: a.attendance,
          durationMinutes: Number(a.durationMinutes) || 30,
          startTime: a.startTime || null,
          endTime: a.endTime || null,
          lessonCompleted: a.attendance === "present" && a.lessonCompleted,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string; warnings?: string[] };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not log session.");
      return;
    }
    setMessage(
      data.warnings?.length
        ? `Session logged. ${data.warnings.join(" ")}`
        : "Session logged (contact log + hours)."
    );
    await loadSnapshot(clientId);
  }

  async function scheduleUpcoming() {
    if (!clientId || !snap?.enrollment || !scheduleStart) return;
    setBusy(true);
    setMessage(null);
    const attendees = buildAttendees().map((a) => ({
      clientId: a.clientId,
      enrollmentId: a.enrollmentId,
    }));
    const res = await fetch("/api/wrt/facilitation/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId,
        scheduledStart: new Date(scheduleStart).toISOString(),
        deliveryMode: snap.enrollment.delivery_mode,
        zoomUrl: zoomUrl.trim() || null,
        attendees,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not schedule.");
      return;
    }
    setMessage("Session scheduled.");
    setScheduleStart("");
    await loadSnapshot(clientId);
  }

  function addGroupMember(c: ClientOption) {
    if (groupMembers.some((m) => m.clientId === c.id)) return;
    setGroupMembers((prev) => [
      ...prev,
      {
        clientId: c.id,
        name: c.name,
        enrollmentId: null,
        attendance: "present",
        durationMinutes: sessionMinutes,
        startTime,
        endTime,
        lessonCompleted: markComplete,
      },
    ]);
  }

  return (
    <section className="mt-10 max-w-5xl rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">WRT Facilitation Preview</h2>
        <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
          Admin-only preview of the Employment Specialist / Transition Specialist experience.
          Enrollments are opt-in and do not change a client&apos;s service assignment.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          placeholder="Search clients…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            void loadClients(e.target.value).catch(() => undefined);
          }}
        />
        <select
          className="min-w-[220px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          value={clientId ?? ""}
          onChange={(e) => setClientId(e.target.value || null)}
        >
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="mt-4 text-sm text-brand-black/60">Loading…</p> : null}
      {message ? <p className="mt-3 text-sm text-brand-green">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {snap && clientId ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="font-semibold text-brand-black">{snap.clientName}</h3>
            {!snap.enrollment ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium">Delivery</span>
                  <select
                    className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value as WrtDeliveryMode)}
                  >
                    <option value="in_person">In person</option>
                    <option value="virtual">Virtual</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium">Requested hours</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                    value={requestedHours}
                    onChange={(e) => setRequestedHours(e.target.value)}
                  />
                </label>
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">Modules</p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {(snap.curriculum ?? [])
                      .filter((m) => !m.is_optional || true)
                      .map((m) => (
                        <label key={m.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedModules.includes(m.id)}
                            onChange={(e) => {
                              setSelectedModules((prev) =>
                                e.target.checked
                                  ? [...prev, m.id]
                                  : prev.filter((id) => id !== m.id)
                              );
                            }}
                          />
                          {m.title}
                          {m.is_optional ? " (optional)" : ""}
                        </label>
                      ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void enroll()}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
                >
                  Start WRT Enrollment
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <p>
                    <span className="font-medium">Delivery:</span>{" "}
                    {snap.enrollment.delivery_mode === "virtual" ? "Virtual" : "In person"}
                  </p>
                  <p>
                    <span className="font-medium">Hours:</span> {snap.completedHours} completed /{" "}
                    {snap.enrollment.requested_hours} requested
                    {snap.remainingHours != null ? ` (${snap.remainingHours} remaining)` : ""}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="font-medium">Delivery</span>
                    <select
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                      value={deliveryMode}
                      onChange={(e) => setDeliveryMode(e.target.value as WrtDeliveryMode)}
                    >
                      <option value="in_person">In person</option>
                      <option value="virtual">Virtual</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Requested hours</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                      value={requestedHours}
                      onChange={(e) => setRequestedHours(e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium">Assigned modules</p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {snap.curriculum.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedModules.includes(m.id)}
                          onChange={(e) => {
                            setSelectedModules((prev) =>
                              e.target.checked
                                ? [...prev, m.id]
                                : prev.filter((id) => id !== m.id)
                            );
                          }}
                        />
                        {m.title}
                        {m.is_optional ? " (optional)" : ""}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveEnrollment()}
                    className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save Enrollment
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void endEnrollment()}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold"
                  >
                    End Enrollment
                  </button>
                </div>
              </div>
            )}
          </div>

          {snap.enrollment ? (
            <>
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <h3 className="font-semibold text-brand-black">Upcoming sessions</h3>
                {snap.upcomingSessions.length === 0 ? (
                  <p className="mt-2 text-sm text-brand-black/60">None scheduled.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {snap.upcomingSessions.map((s) => (
                      <li key={s.id} className="rounded border border-neutral-100 px-3 py-2">
                        {new Date(s.scheduled_start).toLocaleString()} ·{" "}
                        {s.lesson_title ?? "Lesson TBD"} ·{" "}
                        {s.delivery_mode === "virtual" ? "Virtual" : "In person"}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="font-medium">Schedule start</span>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Zoom URL (optional)</span>
                    <input
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
                      value={zoomUrl}
                      onChange={(e) => setZoomUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || !scheduleStart}
                  onClick={() => void scheduleUpcoming()}
                  className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                >
                  Schedule Session
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[200px_200px_1fr]">
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-brand-black/55">Modules</p>
                  <ul className="mt-2 space-y-1">
                    {assignedCurriculum.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setModuleId(m.id);
                            setLessonId(m.lessons[0]?.id ?? null);
                          }}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                            moduleId === m.id
                              ? "bg-brand-green text-white"
                              : "text-brand-black hover:bg-neutral-100"
                          }`}
                        >
                          {m.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-brand-black/55">Lessons</p>
                  <ul className="mt-2 space-y-1">
                    {(selectedModule?.lessons ?? []).map((l) => {
                      const done = snap.completedLessonIds.includes(l.id);
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => setLessonId(l.id)}
                            className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                              lessonId === l.id
                                ? "bg-brand-green text-white"
                                : "text-brand-black hover:bg-neutral-100"
                            }`}
                          >
                            {done ? "✓ " : ""}
                            {l.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
                  {selectedLesson ? (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-semibold text-brand-black">
                          {selectedLesson.title}
                        </h3>
                        <p className="text-xs text-brand-black/55">
                          Default {selectedLesson.default_duration_minutes} min
                          {snap.completedLessonIds.includes(selectedLesson.id)
                            ? " · Completed"
                            : ""}
                        </p>
                      </div>
                      {selectedLesson.objectives ? (
                        <p>
                          <span className="font-medium">Objectives: </span>
                          {selectedLesson.objectives}
                        </p>
                      ) : null}
                      {selectedLesson.facilitator_notes ? (
                        <p className="rounded bg-neutral-50 px-3 py-2 text-brand-black/80">
                          {selectedLesson.facilitator_notes}
                        </p>
                      ) : null}
                      <ul className="space-y-3">
                        {selectedLesson.blocks.map((b) => {
                          const embed =
                            b.block_type === "youtube" && b.url
                              ? youtubeEmbedUrl(b.url)
                              : null;
                          return (
                            <li key={b.id} className="rounded border border-neutral-100 p-3">
                              <p className="text-xs font-semibold uppercase text-brand-black/45">
                                {b.block_type}
                              </p>
                              {b.title ? <p className="font-medium">{b.title}</p> : null}
                              {b.body ? (
                                <p className="mt-1 whitespace-pre-wrap text-brand-black/75">
                                  {b.body}
                                </p>
                              ) : null}
                              {b.url && b.block_type !== "youtube" ? (
                                <a
                                  href={b.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-block text-brand-green underline"
                                >
                                  Open
                                </a>
                              ) : null}
                              {embed ? (
                                <div className="mt-2 aspect-video max-w-lg overflow-hidden rounded border">
                                  <iframe
                                    title={b.title ?? "YouTube"}
                                    src={embed}
                                    className="h-full w-full"
                                    allowFullScreen
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="border-t border-neutral-100 pt-3 space-y-2">
                        <p className="font-medium">Log session (1:1 or group)</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label>
                            Minutes
                            <input
                              type="number"
                              min={0}
                              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                              value={sessionMinutes}
                              onChange={(e) => setSessionMinutes(e.target.value)}
                            />
                          </label>
                          <label>
                            Begin
                            <input
                              type="time"
                              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                            />
                          </label>
                          <label>
                            End
                            <input
                              type="time"
                              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                            />
                          </label>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={markComplete}
                            onChange={(e) => setMarkComplete(e.target.checked)}
                          />
                          Mark lesson complete (present attendees only)
                        </label>

                        <div className="rounded border border-dashed border-neutral-300 p-2">
                          <p className="text-xs font-semibold text-brand-black/55">
                            Group attendees (optional)
                          </p>
                          <input
                            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                            placeholder="Search to add…"
                            value={groupQuery}
                            onChange={(e) => {
                              setGroupQuery(e.target.value);
                              void loadClients(e.target.value).catch(() => undefined);
                            }}
                          />
                          {groupQuery ? (
                            <ul className="mt-1 max-h-28 overflow-auto text-sm">
                              {clients.slice(0, 8).map((c) => (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    className="w-full px-1 py-0.5 text-left hover:bg-neutral-50"
                                    onClick={() => addGroupMember(c)}
                                  >
                                    + {c.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {groupMembers.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {groupMembers.map((m) => (
                                <li
                                  key={m.clientId}
                                  className="flex flex-wrap items-center gap-2 rounded bg-neutral-50 px-2 py-1"
                                >
                                  <span className="font-medium">{m.name}</span>
                                  <select
                                    className="rounded border border-neutral-300 text-xs"
                                    value={m.attendance}
                                    onChange={(e) =>
                                      setGroupMembers((prev) =>
                                        prev.map((x) =>
                                          x.clientId === m.clientId
                                            ? {
                                                ...x,
                                                attendance: e.target.value as
                                                  | "present"
                                                  | "absent",
                                              }
                                            : x
                                        )
                                      )
                                    }
                                  >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                  </select>
                                  <input
                                    type="number"
                                    className="w-16 rounded border border-neutral-300 px-1 text-xs"
                                    value={m.durationMinutes}
                                    onChange={(e) =>
                                      setGroupMembers((prev) =>
                                        prev.map((x) =>
                                          x.clientId === m.clientId
                                            ? { ...x, durationMinutes: e.target.value }
                                            : x
                                        )
                                      )
                                    }
                                  />
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={m.lessonCompleted}
                                      onChange={(e) =>
                                        setGroupMembers((prev) =>
                                          prev.map((x) =>
                                            x.clientId === m.clientId
                                              ? { ...x, lessonCompleted: e.target.checked }
                                              : x
                                          )
                                        )
                                      }
                                    />
                                    Complete
                                  </label>
                                  <button
                                    type="button"
                                    className="text-xs text-red-700"
                                    onClick={() =>
                                      setGroupMembers((prev) =>
                                        prev.filter((x) => x.clientId !== m.clientId)
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-brand-black/50">
                              Leave empty for 1:1 with {snap.clientName}.
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runSession()}
                          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Log Session Now
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-brand-black/55">Select a lesson.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
