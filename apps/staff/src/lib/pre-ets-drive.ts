import { Readable } from "stream";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-mail";

export function driveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export async function uploadPreEtsFileToDrive(options: {
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; fileName: string; webViewLink: string | null }> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const uploaded = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: options.fileName,
      parents: [options.folderId],
    },
    media: {
      mimeType: options.mimeType,
      body: Readable.from(options.buffer),
    },
  });

  const fileId = uploaded.data.id;
  if (!fileId) {
    throw new Error("Drive upload did not return a file id");
  }

  const link = await drive.files.get({
    supportsAllDrives: true,
    fileId,
    fields: "webViewLink",
  });

  return {
    fileId,
    fileName: options.fileName,
    webViewLink: link.data.webViewLink ?? driveFileViewUrl(fileId),
  };
}
