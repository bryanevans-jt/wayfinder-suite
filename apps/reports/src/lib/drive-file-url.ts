/** Build a browser-download URL for a Google Drive file ID or stored URL. */
export function resolveDriveDownloadUrl(stored: string | null | undefined): string | null {
  const value = stored?.trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.includes("/") || value.endsWith(".pdf")) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
    const path = value.startsWith("templates/") ? value : `templates/${value}`;
    return `${baseUrl}/storage/v1/object/public/${path}`;
  }
  return `https://drive.google.com/uc?export=download&id=${value}`;
}
