export function driveFileUrl(fileId: string | null | undefined): string | null {
  if (!fileId?.trim()) return null;
  return `https://drive.google.com/file/d/${fileId.trim()}/view`;
}
