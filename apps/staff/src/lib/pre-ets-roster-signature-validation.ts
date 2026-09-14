const MAX_SIGNATURE_DATA_LENGTH = 500_000;

export function validateRosterSignatureDataUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return "Signature must be a PNG image.";
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/png;base64,")) {
    return "Student roster signatures must be saved as PNG.";
  }
  if (trimmed.length > MAX_SIGNATURE_DATA_LENGTH) {
    return "Signature image is too large. Clear and sign again.";
  }
  return null;
}
