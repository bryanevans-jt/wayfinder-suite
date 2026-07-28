"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type WrtDeliveryMode,
  type WrtLessonBlockRow,
  type WrtLessonWithBlocks,
  type WrtModuleWithLessons,
  youtubeEmbedUrl,
} from "@wayfinder/supabase/staff-wrt-shared";

export type PresentationAttendee = {
  clientId: string;
  name: string;
  enrollmentId: string | null;
  attendance: "present" | "absent";
};

type QuizQuestion = {
  q: string;
  options: string[];
  answer: number;
};

type PresentScreen =
  | "modules"
  | "lessons"
  | "player"
  | "quiz"
  | "complete"
  | "finishDay";

type Props = {
  curriculum: WrtModuleWithLessons[];
  completedLessonIds: string[];
  attendees: PresentationAttendee[];
  deliveryMode: WrtDeliveryMode;
  onExit: () => void;
  onCompletedLessonsChange: (ids: string[]) => void;
  onFinishDayLogged: () => void;
};

function parseQuizQuestions(blocks: WrtLessonBlockRow[]): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const block of blocks) {
    if (block.block_type !== "quiz") continue;
    const raw = block.meta?.questions;
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const q = typeof row.q === "string" ? row.q : "";
      const options = Array.isArray(row.options)
        ? row.options.filter((o): o is string => typeof o === "string")
        : [];
      const answer = typeof row.answer === "number" ? row.answer : -1;
      if (q && options.length > 0 && answer >= 0 && answer < options.length) {
        out.push({ q, options, answer });
      }
    }
  }
  return out;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="w-full" aria-label={label}>
      <div className="mb-1 flex justify-between text-sm font-medium text-brand-black/70">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-brand-black/10">
        <div
          className="h-full rounded-full bg-brand-green transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function WrtPresentationMode({
  curriculum,
  completedLessonIds,
  attendees,
  deliveryMode,
  onExit,
  onCompletedLessonsChange,
  onFinishDayLogged,
}: Props) {
  const presentAttendees = useMemo(
    () => attendees.filter((a) => a.attendance === "present"),
    [attendees]
  );

  const [screen, setScreen] = useState<PresentScreen>("modules");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [blockIndex, setBlockIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const [finishMinutes, setFinishMinutes] = useState("30");
  const [finishStart, setFinishStart] = useState("");
  const [finishEnd, setFinishEnd] = useState("");

  const selectedModule = useMemo(
    () => curriculum.find((m) => m.id === moduleId) ?? null,
    [curriculum, moduleId]
  );

  const selectedLesson = useMemo(
    () => selectedModule?.lessons.find((l) => l.id === lessonId) ?? null,
    [selectedModule, lessonId]
  );

  const contentBlocks = useMemo(
    () => (selectedLesson?.blocks ?? []).filter((b) => b.block_type !== "quiz"),
    [selectedLesson]
  );

  const quizQuestions = useMemo(
    () => parseQuizQuestions(selectedLesson?.blocks ?? []),
    [selectedLesson]
  );

  const moduleProgress = useCallback(
    (mod: WrtModuleWithLessons) => {
      const total = mod.lessons.length || 1;
      const done = mod.lessons.filter((l) => completedLessonIds.includes(l.id)).length;
      return done / total;
    },
    [completedLessonIds]
  );

  const isModuleComplete = useCallback(
    (mod: WrtModuleWithLessons) =>
      mod.lessons.length > 0 && mod.lessons.every((l) => completedLessonIds.includes(l.id)),
    [completedLessonIds]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (screen === "player" || screen === "quiz") {
          setScreen(moduleId ? "lessons" : "modules");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, moduleId]);

  function openModule(id: string) {
    setModuleId(id);
    setLessonId(null);
    setScreen("lessons");
  }

  function openLesson(lesson: WrtLessonWithBlocks) {
    setLessonId(lesson.id);
    setBlockIndex(0);
    setQuizIndex(0);
    setSelectedOption(null);
    setAnsweredCorrect(false);
    setError(null);
    const content = lesson.blocks.filter((b) => b.block_type !== "quiz");
    const questions = parseQuizQuestions(lesson.blocks);
    if (content.length === 0 && questions.length > 0) {
      setScreen("quiz");
      return;
    }
    setScreen("player");
  }

  function goNextBlock() {
    if (blockIndex < contentBlocks.length - 1) {
      setBlockIndex((i) => i + 1);
      return;
    }
    if (quizQuestions.length > 0) {
      setQuizIndex(0);
      setSelectedOption(null);
      setAnsweredCorrect(false);
      setScreen("quiz");
      return;
    }
    void finishLessonWithoutQuiz();
  }

  function goPrevBlock() {
    if (blockIndex > 0) setBlockIndex((i) => i - 1);
  }

  async function markCompleteForPresent(lesson: string) {
    const clientIds = presentAttendees.map((a) => a.clientId);
    const res = await fetch("/api/wrt/facilitation/lessons/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson, clientIds }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Could not mark lesson complete.");
    const next = Array.from(new Set([...completedLessonIds, lesson]));
    onCompletedLessonsChange(next);
  }

  async function finishLessonWithoutQuiz() {
    if (!lessonId) return;
    setBusy(true);
    setError(null);
    try {
      await markCompleteForPresent(lessonId);
      setScreen("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete lesson.");
    } finally {
      setBusy(false);
    }
  }

  async function completeQuizLesson() {
    if (!lessonId) return;
    setBusy(true);
    setError(null);
    try {
      await markCompleteForPresent(lessonId);
      setScreen("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete lesson.");
    } finally {
      setBusy(false);
    }
  }

  function pickQuizOption(index: number) {
    if (answeredCorrect) return;
    setSelectedOption(index);
    const q = quizQuestions[quizIndex];
    if (!q) return;
    if (index === q.answer) {
      setAnsweredCorrect(true);
    }
  }

  async function continueAfterQuiz() {
    if (!answeredCorrect) return;
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex((i) => i + 1);
      setSelectedOption(null);
      setAnsweredCorrect(false);
      return;
    }
    await completeQuizLesson();
  }

  async function submitFinishDay() {
    if (presentAttendees.length === 0) return;
    const minutes = Number(finishMinutes) || 0;
    if (minutes <= 0) {
      setError("Enter session duration in minutes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wrt/facilitation/sessions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lessonId,
          deliveryMode,
          attendees: presentAttendees.map((a) => ({
            clientId: a.clientId,
            enrollmentId: a.enrollmentId,
            attendance: "present" as const,
            durationMinutes: minutes,
            startTime: finishStart || null,
            endTime: finishEnd || null,
            lessonCompleted: false,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not log session.");
      onFinishDayLogged();
      onExit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish day.");
    } finally {
      setBusy(false);
    }
  }

  const currentBlock = contentBlocks[blockIndex] ?? null;
  const currentQuestion = quizQuestions[quizIndex] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[radial-gradient(ellipse_at_top,_#f4f7f0_0%,_#e8efe3_45%,_#dfe8d8_100%)] text-brand-black"
      role="dialog"
      aria-modal="true"
      aria-label="WRT presentation"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-black/10 bg-brand-white/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
            Workplace Readiness
          </p>
          <p className="truncate text-sm text-brand-black/70">
            {presentAttendees.map((a) => a.name).join(", ") || "Session"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedLesson?.facilitator_notes ? (
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="rounded-lg border border-brand-black/15 bg-white px-3 py-2 text-sm font-medium"
            >
              {notesOpen ? "Hide notes" : "Facilitator notes"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg border border-brand-black/20 bg-white px-3 py-2 text-sm font-semibold"
          >
            Exit presentation
          </button>
        </div>
      </header>

      {notesOpen && selectedLesson?.facilitator_notes ? (
        <div className="border-b border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm sm:px-6">
          <p className="font-semibold text-brand-black">Facilitator notes</p>
          <p className="mt-1 whitespace-pre-wrap text-brand-black/80">
            {selectedLesson.facilitator_notes}
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-6 sm:px-8 sm:py-8">
        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        {screen === "modules" ? (
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose a module</h1>
            <p className="mt-2 max-w-2xl text-lg text-brand-black/70">
              Pick a module to open its lessons. Completed modules stay available for review.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {curriculum.map((mod) => {
                const done = isModuleComplete(mod);
                const progress = moduleProgress(mod);
                return (
                  <li key={mod.id}>
                    <button
                      type="button"
                      onClick={() => openModule(mod.id)}
                      className="group flex h-full w-full flex-col rounded-2xl border border-brand-black/10 bg-white/90 p-5 text-left shadow-sm transition hover:border-brand-green/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold leading-snug">{mod.title}</h2>
                        {done ? (
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-white"
                            aria-label="Module completed"
                          >
                            ✓
                          </span>
                        ) : null}
                      </div>
                      {mod.description ? (
                        <p className="mt-2 line-clamp-3 text-sm text-brand-black/65">
                          {mod.description}
                        </p>
                      ) : null}
                      <div className="mt-auto pt-4">
                        <ProgressBar
                          value={progress}
                          label={`${mod.lessons.filter((l) => completedLessonIds.includes(l.id)).length} of ${mod.lessons.length} lessons`}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {screen === "lessons" && selectedModule ? (
          <div className="mx-auto w-full max-w-3xl">
            <button
              type="button"
              onClick={() => {
                setScreen("modules");
                setModuleId(null);
              }}
              className="text-sm font-semibold text-brand-green underline-offset-2 hover:underline"
            >
              ← All modules
            </button>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {selectedModule.title}
            </h1>
            <p className="mt-2 text-lg text-brand-black/70">
              Choose a lesson. Completed lessons can be opened again for review.
            </p>
            <div className="mt-4">
              <ProgressBar
                value={moduleProgress(selectedModule)}
                label="Module progress"
              />
            </div>
            <ol className="mt-8 space-y-3">
              {selectedModule.lessons.map((lesson, i) => {
                const done = completedLessonIds.includes(lesson.id);
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => openLesson(lesson)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-brand-black/10 bg-white/90 px-4 py-4 text-left shadow-sm transition hover:border-brand-green/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-base font-semibold text-brand-green">
                        {done ? "✓" : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold">{lesson.title}</p>
                        <p className="text-sm text-brand-black/60">
                          About {lesson.default_duration_minutes} minutes
                          {done ? " · Completed" : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {screen === "player" && selectedLesson && currentBlock ? (
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
            <button
              type="button"
              onClick={() => setScreen("lessons")}
              className="self-start text-sm font-semibold text-brand-green underline-offset-2 hover:underline"
            >
              ← Lessons
            </button>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{selectedLesson.title}</h1>
            <div className="mt-4">
              <ProgressBar
                value={(blockIndex + 1) / Math.max(contentBlocks.length, 1)}
                label={`Step ${blockIndex + 1} of ${contentBlocks.length}`}
              />
            </div>

            <div className="mt-6 flex-1 rounded-3xl border border-brand-black/10 bg-white/95 p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/45">
                {currentBlock.block_type.replace("_", " ")}
              </p>
              {currentBlock.title ? (
                <h2 className="mt-2 text-2xl font-semibold leading-snug">{currentBlock.title}</h2>
              ) : null}
              {currentBlock.body ? (
                <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-brand-black/85">
                  {currentBlock.body}
                </p>
              ) : null}
              {currentBlock.block_type === "youtube" && currentBlock.url ? (
                <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-brand-black/10 bg-black">
                  {youtubeEmbedUrl(currentBlock.url) ? (
                    <iframe
                      title={currentBlock.title ?? "Video"}
                      src={youtubeEmbedUrl(currentBlock.url)!}
                      className="h-full w-full"
                      allowFullScreen
                    />
                  ) : (
                    <p className="p-4 text-white">Video unavailable.</p>
                  )}
                </div>
              ) : null}
              {(currentBlock.block_type === "pdf_link" ||
                currentBlock.block_type === "external_link") &&
              currentBlock.url ? (
                <a
                  href={currentBlock.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex rounded-xl bg-brand-green px-5 py-3 text-base font-semibold text-white"
                >
                  Open resource
                </a>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                disabled={blockIndex === 0}
                onClick={goPrevBlock}
                className="rounded-xl border border-brand-black/20 bg-white px-5 py-3 text-base font-semibold disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void goNextBlock()}
                className="rounded-xl bg-brand-green px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                {blockIndex >= contentBlocks.length - 1
                  ? quizQuestions.length > 0
                    ? "Review quiz"
                    : "Complete lesson"
                  : "Next"}
              </button>
            </div>
          </div>
        ) : null}

        {screen === "player" && selectedLesson && !currentBlock ? (
          <div className="mx-auto max-w-xl text-center">
            <h1 className="text-2xl font-semibold">{selectedLesson.title}</h1>
            <p className="mt-3 text-lg text-brand-black/70">
              {quizQuestions.length > 0
                ? "This lesson is ready for the review quiz."
                : "No content steps in this lesson yet."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-brand-black/20 bg-white px-5 py-3 font-semibold"
                onClick={() => setScreen("lessons")}
              >
                Back to lessons
              </button>
              {quizQuestions.length > 0 ? (
                <button
                  type="button"
                  className="rounded-xl bg-brand-green px-5 py-3 font-semibold text-white"
                  onClick={() => {
                    setQuizIndex(0);
                    setSelectedOption(null);
                    setAnsweredCorrect(false);
                    setScreen("quiz");
                  }}
                >
                  Start review quiz
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl bg-brand-green px-5 py-3 font-semibold text-white disabled:opacity-50"
                  onClick={() => void finishLessonWithoutQuiz()}
                >
                  Complete lesson
                </button>
              )}
            </div>
          </div>
        ) : null}

        {screen === "quiz" && currentQuestion ? (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
            <h1 className="text-2xl font-semibold sm:text-3xl">Quick review</h1>
            <div className="mt-4">
              <ProgressBar
                value={(quizIndex + 1) / Math.max(quizQuestions.length, 1)}
                label={`Question ${quizIndex + 1} of ${quizQuestions.length}`}
              />
            </div>
            <div className="mt-6 rounded-3xl border border-brand-black/10 bg-white/95 p-6 shadow-sm sm:p-8">
              <p className="text-xl font-semibold leading-snug sm:text-2xl">{currentQuestion.q}</p>
              <ul className="mt-6 space-y-3">
                {currentQuestion.options.map((opt, i) => {
                  const picked = selectedOption === i;
                  const isCorrect = i === currentQuestion.answer;
                  let style =
                    "border-brand-black/15 bg-white hover:border-brand-green/50";
                  if (selectedOption != null) {
                    if (isCorrect && (answeredCorrect || picked)) {
                      style = "border-brand-green bg-brand-green/10";
                    } else if (picked && !isCorrect) {
                      style = "border-red-400 bg-red-50";
                    } else {
                      style = "border-brand-black/10 bg-white opacity-70";
                    }
                  }
                  return (
                    <li key={`${quizIndex}-${i}`}>
                      <button
                        type="button"
                        disabled={answeredCorrect}
                        onClick={() => pickQuizOption(i)}
                        className={`w-full rounded-2xl border-2 px-4 py-4 text-left text-lg font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green disabled:cursor-default ${style}`}
                      >
                        {opt}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selectedOption != null && !answeredCorrect ? (
                <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-base text-brand-black/85">
                  <p className="font-semibold">Not quite.</p>
                  <p className="mt-1">
                    The correct answer is:{" "}
                    <span className="font-semibold">
                      {currentQuestion.options[currentQuestion.answer]}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-brand-black/65">
                    Try again — select the correct answer to continue.
                  </p>
                </div>
              ) : null}

              {answeredCorrect ? (
                <div className="mt-5 rounded-xl bg-brand-green/10 px-4 py-3 text-base">
                  <p className="font-semibold text-brand-green">That&apos;s right.</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void continueAfterQuiz()}
                    className="mt-4 rounded-xl bg-brand-green px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
                  >
                    {quizIndex < quizQuestions.length - 1 ? "Continue" : "Finish lesson"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {screen === "complete" ? (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-green text-2xl font-bold text-white">
              ✓
            </div>
            <h1 className="mt-5 text-3xl font-semibold">Lesson complete</h1>
            <p className="mt-2 text-lg text-brand-black/70">
              Nice work. Choose what to do next.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setScreen("modules");
                  setModuleId(null);
                  setLessonId(null);
                }}
                className="rounded-2xl bg-brand-green px-6 py-4 text-lg font-semibold text-white"
              >
                Continue to next lesson
              </button>
              <button
                type="button"
                onClick={() => setScreen("finishDay")}
                className="rounded-2xl border border-brand-black/20 bg-white px-6 py-4 text-lg font-semibold"
              >
                Finish for the day
              </button>
            </div>
          </div>
        ) : null}

        {screen === "finishDay" ? (
          <div className="mx-auto w-full max-w-lg">
            <h1 className="text-3xl font-semibold">Finish for the day</h1>
            <p className="mt-2 text-lg text-brand-black/70">
              Enter the session time. The same duration will be applied to everyone marked
              present.
            </p>
            <div className="mt-6 space-y-4 rounded-3xl border border-brand-black/10 bg-white/95 p-6">
              <label className="block text-sm font-semibold">
                Duration (minutes)
                <input
                  type="number"
                  min={1}
                  className="mt-2 w-full rounded-xl border border-brand-black/20 px-4 py-3 text-lg"
                  value={finishMinutes}
                  onChange={(e) => setFinishMinutes(e.target.value)}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Begin (optional)
                  <input
                    type="time"
                    className="mt-2 w-full rounded-xl border border-brand-black/20 px-4 py-3 text-lg"
                    value={finishStart}
                    onChange={(e) => setFinishStart(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  End (optional)
                  <input
                    type="time"
                    className="mt-2 w-full rounded-xl border border-brand-black/20 px-4 py-3 text-lg"
                    value={finishEnd}
                    onChange={(e) => setFinishEnd(e.target.value)}
                  />
                </label>
              </div>
              <p className="text-sm text-brand-black/60">
                Present: {presentAttendees.map((a) => a.name).join(", ")}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitFinishDay()}
                className="w-full rounded-xl bg-brand-gold px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                Save time and exit
              </button>
              <button
                type="button"
                onClick={() => setScreen("complete")}
                className="w-full rounded-xl border border-brand-black/15 px-6 py-3 text-base font-semibold"
              >
                Back
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
