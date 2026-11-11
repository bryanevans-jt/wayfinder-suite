/**
 * Build a safe PostgREST `.or()` clause for ilike matches across columns.
 * Values are double-quoted so commas / operators in `q` cannot reshape the filter.
 */
export function buildPreEtsSearchIlikeOrFilter(columns: string[], q: string): string {
  const escaped = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const pattern = `"%${escaped}%"`;
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
