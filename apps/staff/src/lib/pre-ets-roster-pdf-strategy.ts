/** Legacy numbered {{PID1}}… placeholders / practical Docs table expansion size. */
export const MAX_ROSTER_TEMPLATE_ROWS = 30;

/**
 * Google Doc roster expansion inserts rows via the Docs API one at a time.
 * Large classes (e.g. Fitzgerald Inclusion ≈ 64) time out the serverless request
 * before fallback can run — use the built-in pdf-lib roster instead.
 */
export function shouldUseBuiltInRosterPdf(studentCount: number): boolean {
  return studentCount > MAX_ROSTER_TEMPLATE_ROWS;
}
