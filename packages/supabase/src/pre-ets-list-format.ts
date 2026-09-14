/** Oxford-style list: "A", "A and B", "A, B, and C". */
export function formatEnglishList(items: string[]): string {
  const trimmed = items.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) return "";
  if (trimmed.length === 1) return trimmed[0]!;
  if (trimmed.length === 2) return `${trimmed[0]} and ${trimmed[1]}`;
  return `${trimmed.slice(0, -1).join(", ")}, and ${trimmed[trimmed.length - 1]}`;
}
