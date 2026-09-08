import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-mail";

/** Download a Google Drive file as PDF bytes (export Docs; fetch binary for PDF/uploads). */
export async function downloadDriveFileBytes(fileId: string): Promise<Uint8Array | null> {
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({
      supportsAllDrives: true,
      fileId,
      fields: "id, mimeType, name",
    });
    const mime = meta.data.mimeType ?? "";

    if (mime === "application/vnd.google-apps.document") {
      const exported = await drive.files.export(
        { supportsAllDrives: true, fileId, mimeType: "application/pdf" } as {
          fileId: string;
          mimeType: string;
        },
        { responseType: "arraybuffer" }
      );
      return new Uint8Array(exported.data as ArrayBuffer);
    }

    const media = await drive.files.get(
      { supportsAllDrives: true, fileId, alt: "media" } as {
        fileId: string;
        alt: string;
      },
      { responseType: "arraybuffer" }
    );
    return new Uint8Array(media.data as ArrayBuffer);
  } catch {
    return null;
  }
}
