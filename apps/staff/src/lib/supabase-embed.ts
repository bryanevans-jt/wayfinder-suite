/** Supabase FK embeds may return one row or an array depending on schema inference. */
export function supabaseEmbedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export function supabaseEmbedName(
  embed: { name: string } | { name: string }[] | null | undefined
): string | null {
  return supabaseEmbedOne(embed)?.name ?? null;
}
