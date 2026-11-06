-- Replace published WRT curriculum with the next seed from the staff app (GVRA 10-unit framework).
-- Clears lesson-linked progress and session rows; keeps client enrollments so ES can re-select modules after reseed.

delete from public.wrt_session_attendees;
delete from public.wrt_sessions;
delete from public.wrt_lesson_progress;
delete from public.wrt_enrollment_modules;
delete from public.wrt_lesson_blocks;
delete from public.wrt_lessons;
delete from public.wrt_modules;
