/** Invoice / attestation PDF header blanks: empty → seven spaces for manual fill-in. */
export const IJP_PDF_EMPTY_HEADER_SPACES = "       ";

export function ijpPdfHeaderField(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : IJP_PDF_EMPTY_HEADER_SPACES;
}

/** Apply empty→7-spaces to every string value in a placeholder map (headers only). */
export function withIjpPdfEmptyHeaderSpaces(
  placeholders: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(placeholders)) {
    out[key] = ijpPdfHeaderField(value);
  }
  return out;
}
